import { CodeChunk, IParser } from './interfaces/parser.js';
import { ParserFactory } from './parserFactory.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import logger from './utils/logger.js';
import { CacheManager } from './cache/CacheManager.js';
import { calculateHash } from './utils/hash.js';
import { config } from './config.js';
import { AnalysisAdapter } from './interfaces/AnalysisAdapter.js';
import { GraphNode } from './types.js';

const MAX_CHUNK_LINES = 50; // ページングを適用する閾値（行数）

interface PagingInfo {
  filePath: string;
  chunkId: string;
  startLine: number;
  endLine: number;
  pageSize: number;
  totalLines: number;
}

function generatePageToken(pagingInfo: PagingInfo): string {
  return Buffer.from(JSON.stringify(pagingInfo)).toString('base64');
}

function parsePageToken(token: string): PagingInfo | null {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
  } catch (e) {
    logger.error(
      'Failed to parse page token',
      e instanceof Error ? { message: e.message, stack: e.stack } : e,
    );
    return null;
  }
}

// Helper to apply paging to a chunk
function applyPaging(
  originalChunk: CodeChunk,
  pageSize: number,
  requestedPageToken?: string,
): CodeChunk {
  const lines = originalChunk.content.split('\n');
  const totalLines = lines.length;
  const totalPages = Math.ceil(totalLines / pageSize);

  let currentChunkStartLine = 0;
  let currentPage = 1;

  if (requestedPageToken) {
    const pagingInfo = parsePageToken(requestedPageToken);
    if (pagingInfo && pagingInfo.chunkId === originalChunk.id) {
      // pageToken から開始行とページ番号を設定
      currentChunkStartLine = pagingInfo.startLine;
      currentPage = Math.floor(currentChunkStartLine / pageSize) + 1;
    }
  }

  const currentChunkEndLine = Math.min(currentChunkStartLine + pageSize, totalLines);

  const paginatedContent = lines.slice(currentChunkStartLine, currentChunkEndLine).join('\n');

  const nextPageToken =
    currentChunkEndLine < totalLines // endLine が totalLines より小さい場合のみ次ページあり
      ? generatePageToken({
          filePath: originalChunk.filePath,
          chunkId: originalChunk.id,
          startLine: currentChunkEndLine, // 次のページの開始行
          endLine: Math.min(currentChunkEndLine + pageSize, totalLines),
          pageSize,
          totalLines,
        })
      : undefined;

  const prevPageToken =
    currentChunkStartLine > 0 // 開始行が0より大きい場合のみ前ページあり
      ? generatePageToken({
          filePath: originalChunk.filePath,
          chunkId: originalChunk.id,
          startLine: Math.max(0, currentChunkStartLine - pageSize),
          endLine: currentChunkStartLine, // 前のページの終了行
          pageSize,
          totalLines,
        })
      : undefined;

  return {
    ...originalChunk,
    content: paginatedContent,
    isPartial: totalLines > pageSize, // Mark as partial if original was larger than one page
    totalLines: totalLines,
    currentPage: currentPage,
    totalPages: totalPages,
    nextPageToken: nextPageToken,
    prevPageToken: prevPageToken,
    startLine: originalChunk.startLine + currentChunkStartLine, // Adjust startLine relative to original file
    endLine: originalChunk.startLine + currentChunkEndLine - 1, // Adjust endLine relative to original file (inclusive)
  };
}

export class AnalysisService {
  private chunksDir: string;
  private cache: CacheManager;
  private adapter?: AnalysisAdapter;

  constructor(chunksDir: string = config.cacheDir, adapter?: AnalysisAdapter) {
    this.chunksDir = chunksDir;
    this.cache = new CacheManager(this.chunksDir);
    this.adapter = adapter;
  }

  /**
   * アダプタを設定する
   */
  setAdapter(adapter: AnalysisAdapter): void {
    this.adapter = adapter;
  }

  private toSafeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_.\/]/g, '_');
  }

  /**
   * プロジェクト全体を解析する。
   */
  async analyzeProject(projectPath: string): Promise<void> {
    logger.info(`AnalysisService: Analyzing project: ${projectPath}`);
    // 既存のチャンクファイルを削除して、常に最新の解析結果を保存するようにする
    // ディレクトリごとの再帰削除は危険なため、CacheManager の clearAll (JSONファイルのみ削除) を使用する
    await this.cache.clearAll();
    // キャッシュディレクトリの存在を保証する（CacheManager 内部でも行われるが、明示的に）
    await fs.mkdir(this.chunksDir, { recursive: true });

    const swiftFiles = await glob('**/*.swift', { cwd: projectPath, absolute: true });

    const kotlinFiles = await glob('**/*.kt', { cwd: projectPath, absolute: true });
    const allFiles = [...swiftFiles, ...kotlinFiles];

    for (const file of allFiles) {
      await this.analyzeFile(file);
    }
  }

  /**
   * 特定のファイルを解析し、キャッシュを更新する。
   * @returns 生成されたチャンクIDのリスト
   */
  private async analyzeFile(filePath: string): Promise<string[]> {
    logger.debug(`Analyzing file: ${filePath}`);
    let parser: IParser;
    if (filePath.endsWith('.swift')) {
      parser = ParserFactory.getParser(filePath, 'swift');
    } else if (filePath.endsWith('.kt')) {
      parser = ParserFactory.getParser(filePath, 'kotlin');
    } else {
      logger.warn(`Unsupported file type: ${filePath}`);
      return [];
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const hash = calculateHash(content);

    const chunks = await parser.parseFile(filePath);
    // 各チャンクに言語情報を付与
    const chunksWithLanguage = chunks.map((chunk) => ({
      ...chunk,
      language: filePath.endsWith('.swift') ? 'swift' : 'kotlin',
    }));

    const chunkIds: string[] = [];
    const processAndSaveChunks = async (chunkList: CodeChunk[]) => {
      for (const chunk of chunkList) {
        chunkIds.push(chunk.id);
        await this.cache.set(chunk.id, chunk);
        if (chunk.children && chunk.children.length > 0) {
          await processAndSaveChunks(chunk.children);
        }
      }
    };

    await processAndSaveChunks(chunksWithLanguage);
    await this.cache.updateFileMetadata(filePath, hash, chunkIds);
    return chunkIds;
  }

  /**
   * ファイルが変更されているか確認し、必要なら再パースする（Lazy Update）。
   */
  private async ensureLatestFileAnalysis(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = calculateHash(content);

      if (await this.cache.isFileChanged(filePath, hash)) {
        logger.info(`AnalysisService: File changed, updating on-demand: ${filePath}`);
        // 古いキャッシュをクリア
        await this.cache.clearCacheForFile(filePath);
        // 再解析
        await this.analyzeFile(filePath);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`AnalysisService: File not found, clearing cache: ${filePath}`);
        await this.cache.clearCacheForFile(filePath);
      } else {
        logger.error(
          `Failed to ensure latest analysis for ${filePath}`,
          error instanceof Error ? { message: error.message, stack: error.stack } : error,
        );
      }
    }
  }

  async getChunk(
    chunkId: string,
    pageSize: number = MAX_CHUNK_LINES,
    pageToken?: string,
  ): Promise<{
    codeContent: string; // 純粋なコードコンテンツ
    message?: string; // 自然言語の補足メッセージ
    language?: string; // コードの言語
    isPartial?: boolean;
    totalLines?: number;
    currentPage?: number;
    totalPages?: number;
    nextPageToken?: string;
    prevPageToken?: string;
    startLine?: number;
    endLine?: number;
  } | null> {
    logger.info(`AnalysisService: Getting chunk: ${chunkId}`);
    const chunk = await this.cache.get(chunkId);
    if (!chunk) {
      return null;
    }

    // 取得前に対象ファイルの最新状態を確認
    await this.ensureLatestFileAnalysis(chunk.filePath);

    // 再パース後に再度取得（変更があった場合や削除された場合のため）
    const latestChunk = await this.cache.get(chunkId);
    if (!latestChunk) {
      return null; // ファイルが削除されたか、再パースでIDが変わった場合
    }

    const lines = latestChunk.content.split('\n');
    if (lines.length > pageSize || pageToken) {
      const paginatedChunk = applyPaging(latestChunk, pageSize, pageToken);
      const message = paginatedChunk.isPartial
        ? `このチャンクは巨大なため、一部のみを表示しています。\n(${paginatedChunk.currentPage}/${paginatedChunk.totalPages}ページ目、${paginatedChunk.startLine}-${paginatedChunk.endLine}行目)\n${paginatedChunk.nextPageToken ? `次の部分を取得するには、get_chunk ツールに pageToken: "${paginatedChunk.nextPageToken}" を指定してリクエストしてください。` : ''}\n${paginatedChunk.prevPageToken ? `前の部分を取得するには、get_chunk ツールに pageToken: "${paginatedChunk.prevPageToken}" を指定してリクエストしてください。` : ''}\n\n`
        : undefined;

      return {
        codeContent: paginatedChunk.content,
        message: message,
        isPartial: paginatedChunk.isPartial,
        totalLines: paginatedChunk.totalLines,
        currentPage: paginatedChunk.currentPage,
        totalPages: paginatedChunk.totalPages,
        nextPageToken: paginatedChunk.nextPageToken,
        prevPageToken: paginatedChunk.prevPageToken,
        startLine: paginatedChunk.startLine,
        endLine: paginatedChunk.endLine,
      };
    }

    return {
      codeContent: latestChunk.content,
      isPartial: false,
      totalLines: lines.length,
      currentPage: 1,
      totalPages: 1,
      nextPageToken: undefined,
      prevPageToken: undefined,
      startLine: latestChunk.startLine,
      endLine: latestChunk.endLine,
    };
  }

  async findFiles(pattern: string): Promise<string[]> {
    const files = await glob(pattern, { absolute: true });
    return files;
  }

  async findFunctions(
    filePath: string,
    functionQuery: string,
  ): Promise<{ id: string; signature: string }[]> {
    // クエリ前に対象ファイルの最新状態を確認
    await this.ensureLatestFileAnalysis(filePath);

    const allChunkIds = await this.cache.listAllChunkIds();
    const allChunksInFile: CodeChunk[] = [];

    for (const chunkId of allChunkIds) {
      const chunk = await this.cache.get(chunkId);
      if (chunk && chunk.filePath === filePath) {
        allChunksInFile.push(chunk);
      }
    }

    const matchingFunctions = allChunksInFile.filter(
      (chunk) => chunk.type.includes('function') && chunk.signature.includes(functionQuery),
    );
    return matchingFunctions.map((chunk) => ({ id: chunk.id, signature: chunk.signature }));
  }

  async getClassArchitecture(className: string): Promise<{
    name: string;
    type: string;
    signature: string;
    filePath: string;
    superTypes?: string[];
    interfaces?: string[];
    properties?: { name: string; type: string }[];
    message?: string;
  } | null> {
    logger.info(`AnalysisService: Getting class architecture: ${className}`);

    const findInCache = async () => {
      const allChunkIds = await this.cache.listAllChunkIds();
      for (const chunkId of allChunkIds) {
        const chunk = await this.cache.get(chunkId);
        if (
          chunk &&
          (chunk.type.includes('class') ||
            chunk.type.includes('struct') ||
            chunk.type.includes('protocol') ||
            chunk.type.includes('interface')) &&
          chunk.name === className
        ) {
          return chunk;
        }
      }
      return null;
    };

    // 1. まずキャッシュから探す
    let foundChunk = await findInCache();

    // 2. 見つからない、または見つかっても Lazy Update を実行して最新化
    if (foundChunk) {
      await this.ensureLatestFileAnalysis(foundChunk.filePath);
      // 再パース後に再度検索（IDが変わっている可能性があるため）
      foundChunk = await findInCache();
    } else {
      // 全く見つからない場合、全ファイルをチェックして最新化してから再度探す
      // (新規追加されたクラスに対応するため)
      const filePaths = await this.cache.getTrackedFiles();
      for (const filePath of filePaths) {
        await this.ensureLatestFileAnalysis(filePath);
      }
      foundChunk = await findInCache();
    }

    if (foundChunk) {
      const message = `クラス \`${className}\` のアーキテクチャ情報です。
- 親クラス: ${foundChunk.superTypes?.join(', ') || 'なし'}
- 実装インターフェース/プロトコル: ${foundChunk.interfaces?.join(', ') || 'なし'}
- プロパティ数: ${foundChunk.properties?.length || 0}`;

      return {
        name: foundChunk.name,
        type: foundChunk.type,
        signature: foundChunk.signature,
        filePath: foundChunk.filePath,
        superTypes: foundChunk.superTypes,
        interfaces: foundChunk.interfaces,
        properties: foundChunk.properties,
        message: message,
      };
    }

    return null;
  }

  async listFunctionsInFile(filePath: string): Promise<{ id: string; signature: string }[]> {
    logger.info(`AnalysisService: Listing functions in file: ${filePath}`);

    // リスト取得前に対象ファイルの最新状態を確認
    await this.ensureLatestFileAnalysis(filePath);

    const allChunkIds = await this.cache.listAllChunkIds();
    const allChunksInFile: CodeChunk[] = [];

    for (const chunkId of allChunkIds) {
      const chunk = await this.cache.get(chunkId);
      if (chunk && chunk.filePath === filePath) {
        allChunksInFile.push(chunk);
      }
    }

    return allChunksInFile
      .filter((chunk) => chunk.type.includes('function'))
      .map((chunk) => ({
        id: chunk.id,
        signature: chunk.signature,
      }));
  }

  async getFunctionChunk(
    filePath: string,
    functionSignature: string,
    pageSize: number = MAX_CHUNK_LINES,
    pageToken?: string,
  ): Promise<{
    codeContent: string; // 純粋なコードコンテンツ
    message?: string; // 自然言語の補足メッセージ
    language?: string; // コードの言語
    isPartial?: boolean;
    totalLines?: number;
    currentPage?: number;
    totalPages?: number;
    nextPageToken?: string;
    prevPageToken?: string;
    startLine?: number;
    endLine?: number;
  } | null> {
    logger.info(`AnalysisService: Getting function chunk for ${functionSignature} in ${filePath}`);

    // 取得前に対象ファイルの最新状態を確認
    await this.ensureLatestFileAnalysis(filePath);

    const allChunkIds = await this.cache.listAllChunkIds();
    for (const chunkId of allChunkIds) {
      const chunk = await this.cache.get(chunkId);
      if (chunk && chunk.filePath === filePath && chunk.signature === functionSignature) {
        const lines = chunk.content.split('\n');
        if (lines.length > pageSize || pageToken) {
          const paginatedChunk = applyPaging(chunk, pageSize, pageToken);
          const message = paginatedChunk.isPartial
            ? `この関数は巨大なため、一部のみを表示しています。\n(${paginatedChunk.currentPage}/${paginatedChunk.totalPages}ページ目、${paginatedChunk.startLine}-${paginatedChunk.endLine}行目)\n${paginatedChunk.nextPageToken ? `次の部分を取得するには、get_function_chunk ツールに pageToken: "${paginatedChunk.nextPageToken}" を指定してリクエストしてください。` : ''}\n${paginatedChunk.prevPageToken ? `前の部分を取得するには、get_function_chunk ツールに pageToken: "${paginatedChunk.prevPageToken}" を指定してリクエストしてください。` : ''}\n\n`
            : undefined;

          return {
            codeContent: paginatedChunk.content,
            message: message,
            isPartial: paginatedChunk.isPartial,
            totalLines: paginatedChunk.totalLines,
            currentPage: paginatedChunk.currentPage,
            totalPages: paginatedChunk.totalPages,
            nextPageToken: paginatedChunk.nextPageToken,
            prevPageToken: paginatedChunk.prevPageToken,
            startLine: paginatedChunk.startLine,
            endLine: paginatedChunk.endLine,
          };
        }
        return {
          codeContent: chunk.content,
          isPartial: false,
          totalLines: lines.length,
          currentPage: 1,
          totalPages: 1,
          nextPageToken: undefined,
          prevPageToken: undefined,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
        };
      }
    }
    return null;
  }

  async getCallGraph(
    filePath: string,
    line: number,
    column: number,
    depth: number = 1,
  ): Promise<{ nodes: GraphNode[]; edges: { from: string; to: string }[] }> {
    if (!this.adapter) throw new Error('AnalysisAdapter is not configured');

    const nodes = new Map<string, GraphNode>();
    const edges: { from: string; to: string }[] = [];
    const visited = new Set<string>();

    const rootSymbol = await this.adapter.getSymbolAtPoint(filePath, line, column);
    if (!rootSymbol || !rootSymbol.id) {
      return { nodes: [], edges: [] };
    }

    const traverse = async (symbol: GraphNode, currentDepth: number) => {
      if (visited.has(symbol.id) || currentDepth >= depth) return;
      visited.add(symbol.id);
      if (!nodes.has(symbol.id)) nodes.set(symbol.id, symbol);

      // 呼び出し元 (Caller) の取得
      const callers = await this.adapter!.getReferences(symbol.id);
      for (const caller of callers) {
        if (!nodes.has(caller.id)) nodes.set(caller.id, caller);
        edges.push({ from: caller.id, to: symbol.id });
        await traverse(caller, currentDepth + 1);
      }

      // 呼び出し先 (Callee) の取得
      const callees = await this.adapter!.getOutgoingCalls(symbol.id);
      for (const callee of callees) {
        if (!nodes.has(callee.id)) nodes.set(callee.id, callee);
        edges.push({ from: symbol.id, to: callee.id });
        await traverse(callee, currentDepth + 1);
      }
    };

    // ルートシンボルを nodes に追加
    nodes.set(rootSymbol.id, rootSymbol);
    await traverse(rootSymbol, 0);

    // 重複エッジの除去
    const uniqueEdges = Array.from(new Set(edges.map((e) => JSON.stringify(e)))).map((s) =>
      JSON.parse(s),
    );

    return {
      nodes: Array.from(nodes.values()),
      edges: uniqueEdges,
    };
  }
}
