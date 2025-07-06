import { CodeChunk, IParser } from './interfaces/parser.js';
import { ParserFactory } from './parserFactory.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import logger from './utils/logger.js';
import { cacheManager } from './cache/CacheManager.js'; // CacheManagerをインポート

export class AnalysisService {
  private chunksDir: string;

  constructor(chunksDir: string = './data/chunks') {
    this.chunksDir = chunksDir;
  }

  private toSafeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_.]/g, '_');
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

  async getChunk(chunkId: string): Promise<{ content: string } | null> {
    logger.info(`AnalysisService: Getting chunk: ${chunkId}`);
    const chunk = await cacheManager.get(chunkId); // CacheManager経由で取得
    return chunk ? { content: chunk.content } : null;
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
  ): Promise<{ content: string } | null> {
    logger.info(`AnalysisService: Getting function chunk for ${functionSignature} in ${filePath}`);
    const allChunkIds = await cacheManager.listAllChunkIds();
    for (const chunkId of allChunkIds) {
      const chunk = await cacheManager.get(chunkId);
      if (chunk && chunk.filePath === filePath && chunk.signature === functionSignature) {
        return { content: chunk.content };
      }
    }
    return null;
  }
}
