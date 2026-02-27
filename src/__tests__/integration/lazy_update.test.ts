import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, './lazy_test_project');
const TEST_CHUNKS_DIR = path.resolve(__dirname, '../../../data/chunks_integration_test');

// config.cacheDir を上書き
process.env.CACHE_DIR = TEST_CHUNKS_DIR;

import { AnalysisService } from '../../analysisService.js';

describe('Lazy Update Integration', () => {
  let service: AnalysisService;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(TEST_CHUNKS_DIR, { recursive: true });
    service = new AnalysisService();
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.rm(TEST_CHUNKS_DIR, { recursive: true, force: true });
  });

  it('ファイル変更時に get_chunk が自動的に再パースを行うこと', async () => {
    const swiftFile = path.join(TEST_DIR, 'Lazy.swift');
    const initialContent = 'func hello() { print("v1") }';
    await fs.writeFile(swiftFile, initialContent);

    // 初回解析
    await service.analyzeProject(TEST_DIR);

    // listFunctionsInFile で動的にIDを取得（ハードコードを避ける）
    const functions = await service.listFunctionsInFile(swiftFile);
    const helloFunc = functions.find(f => f.signature.includes('hello'));
    expect(helloFunc).toBeDefined();
    const chunkId = helloFunc!.id;

    // 初回取得
    const chunkV1 = await service.getChunk(chunkId);
    expect(chunkV1?.codeContent).toContain('v1');

    // ファイル書き換え
    const updatedContent = 'func hello() { print("v2") }';
    await fs.writeFile(swiftFile, updatedContent);

    // analyzeProject を呼ばずに getChunk を呼ぶ
    const chunkV2 = await service.getChunk(chunkId);

    // 自動更新されて v2 が返ってくるはず
    expect(chunkV2?.codeContent).toContain('v2');
  });

  it('ファイル削除時にキャッシュがクリアされ、nullが返ること', async () => {
    const tempFile = path.join(TEST_DIR, 'Temp.swift');
    await fs.writeFile(tempFile, 'func temp() {}');
    
    await service.analyzeProject(TEST_DIR);
    const functions = await service.listFunctionsInFile(tempFile);
    const chunkId = functions[0].id;

    // 削除
    await fs.unlink(tempFile);

    // getChunk を呼ぶと削除を検知して null になるはず
    const chunk = await service.getChunk(chunkId);
    expect(chunk).toBeNull();
  });
});
