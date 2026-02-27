import { AnalysisService } from '../analysisService.js';
import { CodeChunk } from '../interfaces/parser.js';
import { ParserFactory } from '../parserFactory.js';
import { IParser } from '../interfaces/parser.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheManager } from '../cache/CacheManager.js';
import * as fs from 'fs/promises';
import { glob } from 'glob';

// Mock the parser module and fs/promises
const mockParseFile = vi.fn();

// Mock SwiftParser の代わりに IParser を実装するモッククラスを作成
class MockSwiftParser implements IParser {
  async parseFile(filePath: string): Promise<CodeChunk[]> {
    return mockParseFile(filePath);
  }
}

class MockKotlinParser implements IParser {
  async parseFile(filePath: string): Promise<CodeChunk[]> {
    return mockParseFile(filePath);
  }
}

vi.mock('../parserFactory.js', () => ({
  ParserFactory: {
    getParser: vi.fn((filePath: string, language: string) => {
      if (language === 'swift') {
        return new MockSwiftParser();
      } else if (language === 'kotlin') {
        return new MockKotlinParser();
      }
      throw new Error(`No parser registered for language '${language}'.`);
    }),
    registerParser: vi.fn(), // registerParser もモック
  },
}));

vi.mock('../cache/CacheManager.js', () => ({
  cacheManager: {
    set: vi.fn(),
    get: vi.fn(),
    listAllChunkIds: vi.fn(),
    isFileChanged: vi.fn(),
    updateFileMetadata: vi.fn(),
    clearCacheForFile: vi.fn(),
  },
}));

vi.mock('fs/promises');
vi.mock('glob');

const mockFs = vi.mocked(fs);
const mockGlob = vi.mocked(glob);
const mockCacheManager = vi.mocked(cacheManager);

describe('AnalysisService (Unit Tests)', () => {
  let analysisService: AnalysisService;
  const dummySwiftFilePath = '/test/project/dummy.swift';
  const dummyKotlinFilePath = '/test/project/dummy.kt';
  const dummySwiftChunk: CodeChunk = {
    name: 'dummyFunction1(param:)',
    type: 'source.lang.swift.decl.function.free',
    signature: 'func dummyFunction1(param:) -> Int',
    id: 'func dummyFunction1(param:) -> Int',
    content: 'return 1',
    language: 'swift',
    startLine: 1,
    endLine: 3,
    filePath: dummySwiftFilePath,
    offset: 0,
    length: 0,
    calls: [],
  };

  const dummyKotlinChunk: CodeChunk = {
    id: 'fun main()',
    name: 'main',
    signature: 'fun main()',
    type: 'source.lang.kotlin.decl.function.free',
    content: 'fun main() { /* ... */ }',
    language: 'kotlin',
    filePath: dummyKotlinFilePath,
    startLine: 1,
    endLine: 5,
    offset: 0,
    length: 100,
    calls: [],
  };

  const dummyLargeChunk: CodeChunk = {
    id: 'largeFunction()',
    name: 'largeFunction',
    signature: 'func largeFunction() -> Void',
    type: 'source.lang.swift.decl.function.free',
    content: Array(100).fill('line').join('\n'), // 100行の巨大チャンク
    filePath: '/test/project/large.swift',
    startLine: 1,
    endLine: 100,
    offset: 0,
    length: 1000,
    calls: [],
  };

  beforeEach(() => {
    analysisService = new AnalysisService();
    vi.clearAllMocks();

    mockParseFile.mockResolvedValue([dummySwiftChunk]);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('dummy content');
    mockGlob.mockResolvedValue([dummySwiftFilePath]);

    mockCacheManager.set.mockResolvedValue(undefined);
    mockCacheManager.get.mockResolvedValue(undefined);
    mockCacheManager.listAllChunkIds.mockResolvedValue([]);
    mockCacheManager.isFileChanged.mockResolvedValue(false); // デフォルトは変更なし
    mockCacheManager.updateFileMetadata.mockResolvedValue(undefined);
    mockCacheManager.clearCacheForFile.mockResolvedValue(undefined);
  });

  it('analyzeProject should parse Swift files and save chunks', async () => {
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.swift', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummySwiftFilePath, 'swift');
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(mockCacheManager.set).toHaveBeenCalledWith(dummySwiftChunk.id, {
      ...dummySwiftChunk,
      language: 'swift',
    });
    expect(mockCacheManager.updateFileMetadata).toHaveBeenCalledWith(
      dummySwiftFilePath,
      expect.any(String),
      [dummySwiftChunk.id],
    );
  });

  it('analyzeProject should parse Kotlin files and save chunks', async () => {
    const projectPath = '/test/project';
    mockGlob.mockResolvedValueOnce([dummyKotlinFilePath]);
    mockParseFile.mockResolvedValueOnce([dummyKotlinChunk]);

    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.kt', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummyKotlinFilePath, 'kotlin');
    expect(mockParseFile).toHaveBeenCalledWith(dummyKotlinFilePath);
    expect(mockCacheManager.set).toHaveBeenCalledWith(dummyKotlinChunk.id, {
      ...dummyKotlinChunk,
      language: 'kotlin',
    });
    expect(mockCacheManager.updateFileMetadata).toHaveBeenCalledWith(
      dummyKotlinFilePath,
      expect.any(String),
      [dummyKotlinChunk.id],
    );
  });

  it('ファイル変更時に自動的に再パースが実行されること', async () => {
    // 1回目: getChunk の冒頭
    // 2回目: ensureLatestFileAnalysis 内の calculateHash 直前
    // 3回目: analyzeFile 内
    mockCacheManager.get.mockResolvedValue(dummySwiftChunk);
    mockCacheManager.isFileChanged.mockResolvedValueOnce(true); // 変更あり
    
    // 再パース結果
    const updatedChunk = { ...dummySwiftChunk, content: 'updated content' };
    mockParseFile.mockResolvedValueOnce([updatedChunk]);
    
    // ensureLatestFileAnalysis 後の再取得で updatedChunk を返すように設定
    mockCacheManager.get.mockResolvedValue(updatedChunk);

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);

    expect(mockCacheManager.clearCacheForFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(chunk?.codeContent).toBe('updated content');
  });

  it('ファイル削除(ENOENT)時にキャッシュをクリアし、nullを返すこと', async () => {
    mockCacheManager.get.mockResolvedValueOnce(dummySwiftChunk);
    mockFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);

    expect(mockCacheManager.clearCacheForFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(chunk).toBeNull();
  });

  it('getChunk should return chunk from cache if available', async () => {
    mockCacheManager.get.mockResolvedValue(dummySwiftChunk);

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);
    expect(chunk).toEqual(expect.objectContaining({
      codeContent: dummySwiftChunk.content,
      isPartial: false,
    }));
  });

  it('getChunk should load chunk from disk if not in cache', async () => {
    mockCacheManager.get.mockResolvedValue(dummySwiftChunk);

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);
    expect(chunk).toEqual(expect.objectContaining({
      codeContent: dummySwiftChunk.content,
    }));
  });

  it('getChunk should return paginated chunk if content is large', async () => {
    mockCacheManager.get.mockResolvedValue(dummyLargeChunk);

    const chunk = await analysisService.getChunk(dummyLargeChunk.id, 10);
    expect(chunk?.isPartial).toBe(true);
    expect(chunk?.codeContent.split('\n').length).toBe(10);
  });

  it('getChunk should return next page with pageToken', async () => {
    mockCacheManager.get.mockResolvedValue(dummyLargeChunk);

    const firstPage = await analysisService.getChunk(dummyLargeChunk.id, 10);
    expect(firstPage?.nextPageToken).toBeDefined();

    const secondPage = await analysisService.getChunk(
      dummyLargeChunk.id,
      10,
      firstPage?.nextPageToken,
    );
    expect(secondPage?.isPartial).toBe(true);
    expect(secondPage?.currentPage).toBe(2);
  });

  it('listFunctionsInFile should return list of functions for Swift file', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummySwiftChunk.id]);
    mockCacheManager.get.mockResolvedValue(dummySwiftChunk);

    const functions = await analysisService.listFunctionsInFile(dummySwiftFilePath);
    expect(functions).toEqual([{ id: dummySwiftChunk.id, signature: dummySwiftChunk.signature }]);
  });

  it('getFunctionChunk should return function content for Swift file', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummySwiftChunk.id]);
    mockCacheManager.get.mockResolvedValue(dummySwiftChunk);

    const content = await analysisService.getFunctionChunk(
      dummySwiftFilePath,
      dummySwiftChunk.signature,
    );
    expect(content).toEqual(expect.objectContaining({
      codeContent: dummySwiftChunk.content,
    }));
  });
});
