import { CodeChunk, IParser } from './interfaces/parser.js';
import { ParserFactory } from './parserFactory.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import logger from './utils/logger.js';

export class AnalysisService {
  private parsedProjects: Map<string, CodeChunk[]>; // Cache for parsed projects
  private chunksDir: string;

  constructor(chunksDir: string = './data/chunks') {
    this.parsedProjects = new Map<string, CodeChunk[]>();
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
    const allChunks: CodeChunk[] = [];

    const processAndSaveChunks = async (chunkList: CodeChunk[]) => {
      for (const chunk of chunkList) {
        allChunks.push(chunk);
        await this.saveChunk(chunk);
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
    //console.log(`allChunks: ${JSON.stringify(allChunks)}`);
    this.parsedProjects.set(projectPath, allChunks);
  }

  async getChunk(chunkId: string): Promise<{ content: string } | null> {
    logger.info(`AnalysisService: Getting chunk: ${chunkId}`);
    // Try to get from cache first
    for (const projectChunks of this.parsedProjects.values()) {
      const cachedChunk = projectChunks.find((chunk) => chunk.id === chunkId);
      if (cachedChunk) {
        return { content: cachedChunk.content };
      }
    }
    // If not in cache, try to load from disk
    return this.loadChunk(chunkId);
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
    const allChunksInFile: CodeChunk[] = [];

    for (const projectChunks of this.parsedProjects.values()) {
      const chunksInFile = projectChunks.filter((chunk) => chunk.filePath === filePath);
      allChunksInFile.push(...chunksInFile);
    }

    const matchingFunctions = allChunksInFile.filter(
      (chunk) => chunk.type.includes('function') && chunk.signature.includes(functionQuery), // signature で完全一致を試みる
    );
    return matchingFunctions.map((chunk) => ({ id: chunk.id, signature: chunk.signature }));
  }

  private async saveChunk(chunk: CodeChunk): Promise<void> {
    const safeChunkId = this.toSafeFileName(chunk.id);
    const chunkFilePath = `${this.chunksDir}/${safeChunkId}.json`;
    await fs.mkdir(this.chunksDir, { recursive: true });
    await fs.writeFile(chunkFilePath, JSON.stringify(chunk, null, 2));
    logger.info(`Saved chunk: ${chunk.id} to ${chunkFilePath}`);
  }

  private async loadChunk(chunkId: string): Promise<{ content: string } | null> {
    const safeChunkId = this.toSafeFileName(chunkId);
    const chunkFilePath = `${this.chunksDir}/${safeChunkId}.json`;
    try {
      const fileContent = await fs.readFile(chunkFilePath, 'utf-8');
      const chunk = JSON.parse(fileContent);
      logger.info(`Loaded chunk: ${chunk.id} from ${chunkFilePath}`);
      return { content: chunk.content };
    } catch (error) {
      logger.error(`Error loading chunk ${chunkId}: ${error}`);
      return null;
    }
  }

  async listFunctionsInFile(filePath: string): Promise<{ id: string; signature: string }[]> {
    logger.info(`AnalysisService: Listing functions in file: ${filePath}`);
    const allChunksInFile: CodeChunk[] = [];

    for (const projectChunks of this.parsedProjects.values()) {
      const chunksInFile = projectChunks.filter((chunk) => chunk.filePath === filePath);
      allChunksInFile.push(...chunksInFile);
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
    for (const projectChunks of this.parsedProjects.values()) {
      const targetFunction = projectChunks.find(
        (chunk) => chunk.filePath === filePath && chunk.signature === functionSignature,
      );
      if (targetFunction) {
        return { content: targetFunction.content };
      }
    }
    return null;
  }
}
