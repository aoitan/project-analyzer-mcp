import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { CacheManager } from '../cache/CacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_CACHE_DIR = path.join(__dirname, '../../data/chunks_test_cache');

describe('CacheManager Metadata', () => {
  let testCacheManager: CacheManager;

  beforeEach(async () => {
    // テスト前にキャッシュディレクトリをクリーンアップ
    await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
    testCacheManager = new CacheManager(TEST_CACHE_DIR);
  });

  it('ファイルハッシュを保存し、不一致を検知できること', async () => {
    const filePath = '/test/file.swift';
    const hash = 'abc123hash';

    expect(await testCacheManager.isFileChanged(filePath, hash)).toBe(true);

    await testCacheManager.updateFileMetadata(filePath, hash, ['chunk1']);

    expect(await testCacheManager.isFileChanged(filePath, hash)).toBe(false);
    expect(await testCacheManager.isFileChanged(filePath, 'different-hash')).toBe(true);
  });

  it('メタデータがファイルに永続化されること', async () => {
    const filePath = '/test/file.kt';
    const hash = 'xyz789hash';

    await testCacheManager.updateFileMetadata(filePath, hash, ['chunk2']);

    const metadataPath = path.join(TEST_CACHE_DIR, 'metadata.json');
    await expect(fs.access(metadataPath)).resolves.toBeUndefined();

    const data = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    expect(data[filePath].hash).toBe(hash);
    expect(data[filePath].chunkIds).toEqual(['chunk2']);
  });

  it('clearCacheForFile で関連するチャンクファイルを物理削除すること', async () => {
    const filePath = '/test/physical.swift';
    const chunkId = 'test-chunk-id';
    const chunk: any = { id: chunkId, filePath, content: 'test' };

    await testCacheManager.set(chunkId, chunk);
    await testCacheManager.updateFileMetadata(filePath, 'hash1', [chunkId]);

    const safeKey = chunkId.replace(/[^a-zA-Z0-9-_.]/g, '_');
    const chunkFilePath = path.join(TEST_CACHE_DIR, `${safeKey}.json`);
    await expect(fs.access(chunkFilePath)).resolves.toBeUndefined();

    await testCacheManager.clearCacheForFile(filePath);

    await expect(fs.access(chunkFilePath)).rejects.toThrow();
    expect(await testCacheManager.isFileChanged(filePath, 'hash1')).toBe(true);
  });
});
