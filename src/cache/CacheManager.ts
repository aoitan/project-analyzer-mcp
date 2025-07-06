import { CodeChunk } from '../interfaces/parser.js';
import * as fs from 'fs/promises';
import * as path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../../data/chunks');
const MAX_MEMORY_CACHE_SIZE = 100; // メモリキャッシュの最大サイズ（例として100エントリ）

interface CacheEntry {
  value: CodeChunk;
  timestamp: number; // LRUのために最終アクセス時刻を記録
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry>;

  constructor() {
    this.memoryCache = new Map<string, CacheEntry>();
    this.ensureCacheDirExists();
  }

  private async ensureCacheDirExists(): Promise<void> {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      console.error(`Failed to create cache directory: ${CACHE_DIR}`, error);
    }
  }

  public async set(key: string, value: CodeChunk): Promise<void> {
    // メモリキャッシュに保存
    this.memoryCache.set(key, { value, timestamp: Date.now() });

    // LRUに基づいてメモリキャッシュを破棄
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

    // ファイルキャッシュに保存（非同期）
    await this.saveToFile(key, value);
  }

  public async get(key: string): Promise<CodeChunk | undefined> {
    // メモリキャッシュから取得
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      // アクセスされたのでタイムスタンプを更新
      memoryEntry.timestamp = Date.now();
      return memoryEntry.value;
    }

    // メモリキャッシュにない場合はファイルキャッシュから読み込み
    const fileChunk = await this.loadFromFile(key);
    if (fileChunk) {
      // ファイルから読み込んだ場合はメモリキャッシュにも追加
      this.memoryCache.set(key, { value: fileChunk, timestamp: Date.now() });
    }
    return fileChunk;
  }

  private async saveToFile(key: string, value: CodeChunk): Promise<void> {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to save chunk to file: ${filePath}`, error);
    }
  }

  private async loadFromFile(key: string): Promise<CodeChunk | undefined> {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as CodeChunk;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // ファイルが存在しない場合はundefinedを返す
        return undefined;
      }
      console.error(`Failed to load chunk from file: ${filePath}`, error);
      return undefined;
    }
  }

  public async listAllChunkIds(): Promise<string[]> {
    try {
      const files = await fs.readdir(CACHE_DIR);
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace(/\.json$/, ''));
    } catch (error) {
      console.error(`Failed to list chunk IDs from directory: ${CACHE_DIR}`, error);
      return [];
    }
  }
}

export const cacheManager = new CacheManager();
