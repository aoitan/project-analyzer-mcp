import { CodeChunk, IParser } from './interfaces/parser.js';
import { ParserFactory } from './parserFactory.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import logger from './utils/logger.js';
import { cacheManager } from './cache/CacheManager.js'; // CacheManagerをインポート

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
    logger.error(`Failed to parse page token: ${token}`, e);
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

  let currentPage = 1;
  let startLine = 0;
  let endLine = totalLines;

  if (requestedPageToken) {
    const pagingInfo = parsePageToken(requestedPageToken);
    if (pagingInfo && pagingInfo.chunkId === originalChunk.id) {
      currentPage = Math.floor(pagingInfo.startLine / pageSize) + 1;
      startLine = pagingInfo.startLine;
      endLine = pagingInfo.endLine;
    }
  }

  // Adjust start/end lines based on current page and page size
  startLine = (currentPage - 1) * pageSize;
  endLine = Math.min(startLine + pageSize, totalLines);

  const paginatedContent = lines.slice(startLine, endLine).join('\n');

  const nextPageToken =
    currentPage < totalPages
      ? generatePageToken({
          filePath: originalChunk.filePath,
          chunkId: originalChunk.id,
          startLine: endLine,
          endLine: Math.min(endLine + pageSize, totalLines),
          pageSize,
          totalLines,
        })
      : undefined;

  const prevPageToken =
    currentPage > 1
      ? generatePageToken({
          filePath: originalChunk.filePath,
          chunkId: originalChunk.id,
          startLine: Math.max(0, startLine - pageSize),
          endLine: startLine,
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
    startLine: originalChunk.startLine + startLine, // Adjust startLine relative to original file
    endLine: originalChunk.startLine + endLine -1, // Adjust endLine relative to original file
  };
}

export class AnalysisService {
  private chunksDir: string;

  constructor(chunksDir: string = './data/chunks') {
    this.chunksDir = chunksDir;
  }

  private toSafeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_.\/]/g, '_');
  }

  async analyzeProject(projectPath: string): Promise<void> {
    logger.info(`AnalysisService: Analyzing project: ${projectPath}`);
    // 既存のチャンクファイルを削除して、常に最新の解析結果を保存するようにする
    await fs.rm(this.chunksDir, { recursive: true, force: true });
    await fs.mkdir(this.chunksDir, { recursive: true });

    const swiftFiles = await glob('**/*.swift', { cwd: projectPath, absolute: true });
    const kotlinFiles = await glob('**/*.kt', { cwd: projectPath, absolute: true });
    const allFiles = [...swiftFiles, ...kotlinFiles];

    const processAndSaveChunks = async (chunkList: CodeChunk[]) => {
      for (const chunk of chunkList) {
        await cacheManager.set(chunk.id, chunk); // CacheManager経由で保存
        if (chunk.children && chunk.children.length > 0) {
          await processAndSaveChunks(chunk.children);
        }
      }
    };

    console.log(`files: ${allFiles}`);
    for (const file of allFiles) {
      console.log(`file: ${file}`);
      let parser: IParser;
      if (file.endsWith('.swift')) {
        parser = ParserFactory.getParser(file, 'swift');
      } else if (file.endsWith('.kt')) {
        parser = ParserFactory.getParser(file, 'kotlin');
      } else {
        logger.warn(`Unsupported file type: ${file}`);
        continue;
      }
      const chunks = await parser.parseFile(file);
      await processAndSaveChunks(chunks);
    }
  }

  async getChunk(
    chunkId: string,
    pageSize: number = MAX_CHUNK_LINES,
    pageToken?: string,
  ): Promise<{ content: string; isPartial?: boolean; totalLines?: number; currentPage?: number; totalPages?: number; nextPageToken?: string; prevPageToken?: string; } | null> {
    logger.info(`AnalysisService: Getting chunk: ${chunkId}`);
    const chunk = await cacheManager.get(chunkId);
    if (!chunk) {
      return null;
    }

    const lines = chunk.content.split('\n');
    if (lines.length > pageSize || pageToken) {
      const paginatedChunk = applyPaging(chunk, pageSize, pageToken);
      return {
        content: paginatedChunk.content,
        isPartial: paginatedChunk.isPartial,
        totalLines: paginatedChunk.totalLines,
        currentPage: paginatedChunk.currentPage,
        totalPages: paginatedChunk.totalPages,
        nextPageToken: paginatedChunk.nextPageToken,
        prevPageToken: paginatedChunk.prevPageToken,
      };
    }

    return { content: chunk.content };
  }

  private async getSwiftFiles(projectPath: string): Promise<string[]> {
    // このメソッドはもはや不要だが、既存のコードとの互換性のため残す
    return glob('**/*.swift', { cwd: projectPath, absolute: true });
  }

  async findFiles(pattern: string): Promise<string[]> {
    const files = await glob(pattern, { absolute: true });
    return files;
  }

  async findFunctions(
    filePath: string,
    functionQuery: string,
  ): Promise<{ id: string; signature: string }[]> {
    const allChunkIds = await cacheManager.listAllChunkIds();
    const allChunksInFile: CodeChunk[] = [];

    for (const chunkId of allChunkIds) {
      const chunk = await cacheManager.get(chunkId);
      if (chunk && chunk.filePath === filePath) {
        allChunksInFile.push(chunk);
      }
    }

    const matchingFunctions = allChunksInFile.filter(
      (chunk) => chunk.type.includes('function') && chunk.signature.includes(functionQuery),
    );
    return matchingFunctions.map((chunk) => ({ id: chunk.id, signature: chunk.signature }));
  }

  async listFunctionsInFile(filePath: string): Promise<{ id: string; signature: string }[]> {
    logger.info(`AnalysisService: Listing functions in file: ${filePath}`);
    const allChunkIds = await cacheManager.listAllChunkIds();
    const allChunksInFile: CodeChunk[] = [];

    for (const chunkId of allChunkIds) {
      const chunk = await cacheManager.get(chunkId);
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
  ): Promise<{ content: string; isPartial?: boolean; totalLines?: number; currentPage?: number; totalPages?: number; nextPageToken?: string; prevPageToken?: string; } | null> {
    logger.info(`AnalysisService: Getting function chunk for ${functionSignature} in ${filePath}`);
    const allChunkIds = await cacheManager.listAllChunkIds();
    for (const chunkId of allChunkIds) {
      const chunk = await cacheManager.get(chunkId);
      if (chunk && chunk.filePath === filePath && chunk.signature === functionSignature) {
        const lines = chunk.content.split('\n');
        if (lines.length > pageSize || pageToken) {
          const paginatedChunk = applyPaging(chunk, pageSize, pageToken);
          return {
            content: paginatedChunk.content,
            isPartial: paginatedChunk.isPartial,
            totalLines: paginatedChunk.totalLines,
            currentPage: paginatedChunk.currentPage,
            totalPages: paginatedChunk.totalPages,
            nextPageToken: paginatedChunk.nextPageToken,
            prevPageToken: paginatedChunk.prevPageToken,
          };
        }
        return { content: chunk.content };
      }
    }
    return null;
  }
}
