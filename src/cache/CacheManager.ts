import { CodeChunk } from '../interfaces/parser.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config.js';

interface CacheEntry {
  value: CodeChunk;
  timestamp: number; // LRUのために最終アクセス時刻を記録
}

interface FileMetadata {
  hash: string;
  lastParsed: number;
  chunkIds: string[]; // このファイルから生成されたチャンクのリスト（物理削除用）
}

interface ProjectMetadata {
  [filePath: string]: FileMetadata;
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry>;
  private metadata: ProjectMetadata | null = null;
  private cacheDir: string;
  private metadataFile: string;

  constructor(cacheDir: string = config.cacheDir) {
    this.memoryCache = new Map<string, CacheEntry>();
    this.cacheDir = cacheDir;
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
  }

  /**
   * 現在使用しているキャッシュディレクトリを取得する（テスト用）
   */
  public getCacheDir(): string {
    return this.cacheDir;
  }

  private async ensureCacheDirExists(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create cache directory: ${this.cacheDir}`, error);
    }
  }

  private toSafeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_.]/g, '_');
  }

  public async set(key: string, value: CodeChunk): Promise<void> {
    this.memoryCache.set(key, { value, timestamp: Date.now() });

    const MAX_MEMORY_CACHE_SIZE = 100;
    if (this.memoryCache.size > MAX_MEMORY_CACHE_SIZE) {
      let oldestKey: string | undefined;
      let oldestTimestamp = Infinity;

      for (const [k, entry] of this.memoryCache.entries()) {
        if (entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    await this.saveToFile(key, value);
  }

  public async get(key: string): Promise<CodeChunk | undefined> {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      memoryEntry.timestamp = Date.now();
      return memoryEntry.value;
    }

    const fileChunk = await this.loadFromFile(key);
    if (fileChunk) {
      this.memoryCache.set(key, { value: fileChunk, timestamp: Date.now() });
    }
    return fileChunk;
  }

  private async saveToFile(key: string, value: CodeChunk): Promise<void> {
    await this.ensureCacheDirExists();
    const safeKey = this.toSafeFileName(key);
    const filePath = path.join(this.cacheDir, `${safeKey}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to save chunk to file: ${filePath}`, error);
    }
  }

  private async loadFromFile(key: string): Promise<CodeChunk | undefined> {
    const safeKey = this.toSafeFileName(key);
    const filePath = path.join(this.cacheDir, `${safeKey}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as CodeChunk;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return undefined;
      }
      console.error(`Failed to load chunk from file: ${filePath}`, error);
      return undefined;
    }
  }

  public async listAllChunkIds(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.cacheDir);
      return files
        .filter((file) => file.endsWith('.json') && file !== 'metadata.json')
        .map((file) => file.replace(/\.json$/, ''));
    } catch (error) {
      return [];
    }
  }

  // --- メタデータ管理 ---

  private async loadMetadata(): Promise<ProjectMetadata> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      this.metadata = JSON.parse(data) as ProjectMetadata;
      return this.metadata!;
    } catch (error: any) {
      this.metadata = {};
      return this.metadata;
    }
  }

  private async saveMetadata(): Promise<void> {
    if (!this.metadata) return;
    await this.ensureCacheDirExists();
    try {
      await fs.writeFile(this.metadataFile, JSON.stringify(this.metadata, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to save metadata: ${this.metadataFile}`, error);
    }
  }

  public async isFileChanged(filePath: string, currentHash: string): Promise<boolean> {
    const metadata = await this.loadMetadata();
    const entry = metadata[filePath];
    return !entry || entry.hash !== currentHash;
  }

  public async updateFileMetadata(
    filePath: string,
    hash: string,
    chunkIds: string[],
  ): Promise<void> {
    const metadata = await this.loadMetadata();
    metadata[filePath] = {
      hash,
      lastParsed: Date.now(),
      chunkIds,
    };
    await this.saveMetadata();
  }

  public async clearCacheForFile(filePath: string): Promise<void> {
    const metadata = await this.loadMetadata();
    const entry = metadata[filePath];

    if (entry) {
      for (const chunkId of entry.chunkIds) {
        const safeKey = this.toSafeFileName(chunkId);
        const chunkFilePath = path.join(this.cacheDir, `${safeKey}.json`);
        try {
          await fs.unlink(chunkFilePath);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            console.warn(`Failed to delete stale chunk file: ${chunkFilePath}`, error);
          }
        }
        this.memoryCache.delete(chunkId);
      }

      delete metadata[filePath];
      await this.saveMetadata();
    }
  }
}

// デフォルトインスタンス
export const cacheManager = new CacheManager();
