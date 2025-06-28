import { SwiftParser, CodeChunk } from './parser.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';

export class AnalysisService {
  private swiftParser: SwiftParser;
  private parsedProjects: Map<string, CodeChunk[]>; // Cache for parsed projects
  private chunksDir: string = './data/chunks';

  constructor() {
    this.swiftParser = new SwiftParser();
    this.parsedProjects = new Map<string, CodeChunk[]>();
  }

  private toSafeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_.]/g, '_');
  }

  async analyzeProject(projectPath: string): Promise<void> {
    console.log(`AnalysisService: Analyzing project: ${projectPath}`);
    const files = await this.getSwiftFiles(projectPath);
    const allChunks: CodeChunk[] = [];

    for (const file of files) {
      const chunks = await this.swiftParser.parseFile(file);
      for (const chunk of chunks) {
        const content = await this.swiftParser.getFunctionContent(file, chunk.signature);
        if (content) {
          chunk.content = content;
        }
        allChunks.push(chunk);
        await this.saveChunk(chunk);
      }
    }
    this.parsedProjects.set(projectPath, allChunks);
  }

  async getChunk(chunkId: string): Promise<any | null> {
    console.log(`AnalysisService: Getting chunk: ${chunkId}`);
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
    const swiftFiles = await glob('**/*.swift', { cwd: projectPath, absolute: true });
    return swiftFiles;
  }

  async findFiles(pattern: string): Promise<string[]> {
    const files = await glob(pattern, { absolute: true });
    return files;
  }

  async findFunctions(
    filePath: string,
    functionQuery: string,
  ): Promise<{ id: string; signature: string }[]> {
    const codeChunks = await this.swiftParser.parseFile(filePath);
    const matchingFunctions = codeChunks.filter(
      (chunk) =>
        chunk.type.includes('function') &&
        (chunk.name.includes(functionQuery) || chunk.signature.includes(functionQuery)),
    );
    return matchingFunctions.map((chunk) => ({ id: chunk.id, signature: chunk.signature }));
  }

  private async saveChunk(chunk: CodeChunk): Promise<void> {
    const safeChunkId = this.toSafeFileName(chunk.id);
    const chunkFilePath = `${this.chunksDir}/${safeChunkId}.json`;
    await fs.mkdir(this.chunksDir, { recursive: true });
    await fs.writeFile(chunkFilePath, JSON.stringify(chunk, null, 2));
    console.log(`Saved chunk: ${chunk.id} to ${chunkFilePath}`);
  }

  private async loadChunk(chunkId: string): Promise<any | null> {
    const safeChunkId = this.toSafeFileName(chunkId);
    const chunkFilePath = `${this.chunksDir}/${safeChunkId}.json`;
    try {
      const fileContent = await fs.readFile(chunkFilePath, 'utf-8');
      const chunk = JSON.parse(fileContent);
      console.log(`Loaded chunk: ${chunk.id} from ${chunkFilePath}`);
      return { content: chunk.content };
    } catch (error) {
      console.error(`Error loading chunk ${chunkId}: ${error}`);
      return null;
    }
  }

  async listFunctionsInFile(filePath: string): Promise<{ signature: string }[]> {
    console.log(`AnalysisService: Listing functions in file: ${filePath}`);
    const codeChunks = await this.swiftParser.parseFile(filePath);
    return codeChunks
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
    console.log(`AnalysisService: Getting function chunk for ${functionSignature} in ${filePath}`);
    const content = await this.swiftParser.getFunctionContent(filePath, functionSignature);
    if (content) {
      return { content };
    } else {
      return null;
    }
  }
}
