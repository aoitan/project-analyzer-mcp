import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cacheManager } from '../cache/CacheManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = path.join(__dirname, '../../data/chunks');

describe('CacheManager Metadata', () => {
  beforeEach(async () => {
    // テスト前にキャッシュディレクトリをクリーンアップ
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
  });

  it('ファイルハッシュを保存し、不一致を検知できること', async () => {
    const filePath = '/test/file.swift';
    const hash = 'abc123hash';

    // まだ保存されていないので変更ありとみなされる
    expect(await cacheManager.isFileChanged(filePath, hash)).toBe(true);

    // ハッシュを保存
    await cacheManager.updateFileMetadata(filePath, hash);

    // 同じハッシュなら変更なし
    expect(await cacheManager.isFileChanged(filePath, hash)).toBe(false);

    // 別のハッシュなら変更あり
    expect(await cacheManager.isFileChanged(filePath, 'different-hash')).toBe(true);
  });

  it('メタデータがファイルに永続化されること', async () => {
    const filePath = '/test/file.kt';
    const hash = 'xyz789hash';

    await cacheManager.updateFileMetadata(filePath, hash);

    // メタデータファイルが存在することを確認
    const metadataPath = path.join(CACHE_DIR, 'metadata.json');
    await expect(fs.access(metadataPath)).resolves.toBeUndefined();

    const data = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    expect(data[filePath].hash).toBe(hash);
  });

  it('clearCacheForFile で関連するチャンクファイルを物理削除すること', async () => {
    const filePath = '/test/physical.swift';
    const chunkId = 'test-chunk-id';
    const chunk: any = { id: chunkId, filePath, content: 'test' };

    // チャンクを保存（これによりファイルが作成される）
    await cacheManager.set(chunkId, chunk);
    await cacheManager.updateFileMetadata(filePath, 'hash1', [chunkId]);

    const chunkFilePath = path.join(CACHE_DIR, 'test-chunk-id.json');
    await expect(fs.access(chunkFilePath)).resolves.toBeUndefined();

    // キャッシュをクリア
    await cacheManager.clearCacheForFile(filePath);

    // 物理ファイルが削除されていることを確認
    await expect(fs.access(chunkFilePath)).rejects.toThrow();
    // メタデータも消えていること
    expect(await cacheManager.isFileChanged(filePath, 'hash1')).toBe(true);
  });
});
