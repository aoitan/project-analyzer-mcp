import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AnalysisService } from '../../analysisService.js';
import { cacheManager } from '../../cache/CacheManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, './lazy_test_project');
const CHUNKS_DIR = path.resolve(__dirname, '../../../data/chunks_test');

describe('Lazy Update Integration', () => {
  let service: AnalysisService;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(CHUNKS_DIR, { recursive: true });
    service = new AnalysisService(CHUNKS_DIR);
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.rm(CHUNKS_DIR, { recursive: true, force: true });
  });

  it('ファイル変更時に get_chunk が自動的に再パースを行うこと', async () => {
    const swiftFile = path.join(TEST_DIR, 'Lazy.swift');
    const initialContent = 'func hello() { print("v1") }';
    await fs.writeFile(swiftFile, initialContent);

    // 初回解析
    await service.analyzeProject(TEST_DIR);

    // 初回取得
    const chunkV1 = await service.getChunk('func hello()');
    expect(chunkV1?.codeContent).toContain('v1');

    // ファイル書き換え
    const updatedContent = 'func hello() { print("v2") }';
    await fs.writeFile(swiftFile, updatedContent);

    // analyzeProject を呼ばずに getChunk を呼ぶ
    const chunkV2 = await service.getChunk('func hello()');

    // 自動更新されて v2 が返ってくるはず
    expect(chunkV2?.codeContent).toContain('v2');
  });
});
