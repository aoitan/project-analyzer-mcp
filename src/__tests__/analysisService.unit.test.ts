import { AnalysisService } from '../analysisService.js';
import { CodeChunk } from '../interfaces/parser.js';
import { ParserFactory } from '../parserFactory.js';
import { IParser } from '../interfaces/parser.js';
import { vi } from 'vitest';
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
    language: 'swift', // 追加
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
    language: 'kotlin', // 追加
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

    // Mock ParserFactory.getParser が MockSwiftParser を返すように設定
    // これは vi.mock('../parserFactory.js') で既に設定済み

    // MockSwiftParser の parseFile メソッドの振る舞いを設定
    mockParseFile.mockResolvedValue([dummySwiftChunk]);

    // Mock fs/promises methods
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);

    // Mock glob
    mockGlob.mockResolvedValue([dummySwiftFilePath]);

    // Mock CacheManager methods
    mockCacheManager.set.mockResolvedValue(undefined);
    mockCacheManager.get.mockResolvedValue(undefined);
    mockCacheManager.listAllChunkIds.mockResolvedValue([]);
  });

  it('analyzeProject should parse Swift files and save chunks', async () => {
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.swift', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummySwiftFilePath, 'swift');
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(mockCacheManager.set).toHaveBeenCalledWith(dummySwiftChunk.id, { ...dummySwiftChunk, language: 'swift' });
  });

  it('analyzeProject should parse Kotlin files and save chunks', async () => {
    const projectPath = '/test/project';
    mockGlob.mockResolvedValueOnce([dummyKotlinFilePath]); // Kotlinファイルのみを返すようにモック
    mockParseFile.mockResolvedValueOnce([dummyKotlinChunk]); // Kotlinチャンクを返すようにモック

    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.kt', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummyKotlinFilePath, 'kotlin');
    expect(mockParseFile).toHaveBeenCalledWith(dummyKotlinFilePath);
    expect(mockCacheManager.set).toHaveBeenCalledWith(dummyKotlinChunk.id, { ...dummyKotlinChunk, language: 'kotlin' });
  });

  it('getChunk should return chunk from cache if available', async () => {
    mockCacheManager.get.mockResolvedValueOnce(dummySwiftChunk);

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);
    expect(chunk).toEqual({
      codeContent: dummySwiftChunk.content,
      isPartial: false,
      totalLines: dummySwiftChunk.content.split('\n').length,
      currentPage: 1,
      totalPages: 1,
      nextPageToken: undefined,
      prevPageToken: undefined,
      startLine: dummySwiftChunk.startLine,
      endLine: dummySwiftChunk.endLine,
    });
    expect(mockCacheManager.get).toHaveBeenCalledWith(dummySwiftChunk.id);
  });

  it('getChunk should load chunk from disk if not in cache', async () => {
    mockCacheManager.get.mockResolvedValueOnce(dummySwiftChunk);

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);
    expect(mockCacheManager.get).toHaveBeenCalledWith(dummySwiftChunk.id);
    expect(chunk).toEqual({
      codeContent: dummySwiftChunk.content,
      isPartial: false,
      totalLines: dummySwiftChunk.content.split('\n').length,
      currentPage: 1,
      totalPages: 1,
      nextPageToken: undefined,
      prevPageToken: undefined,
      startLine: dummySwiftChunk.startLine,
      endLine: dummySwiftChunk.endLine,
    });
  });

  it('getChunk should return paginated chunk if content is large', async () => {
    mockCacheManager.get.mockResolvedValueOnce(dummyLargeChunk);

    const chunk = await analysisService.getChunk(dummyLargeChunk.id, 10); // pageSize = 10
    expect(chunk?.isPartial).toBe(true);
    expect(chunk?.codeContent.split('\n').length).toBe(10);
    expect(chunk?.totalLines).toBe(100);
    expect(chunk?.currentPage).toBe(1);
    expect(chunk?.totalPages).toBe(10);
    expect(chunk?.nextPageToken).toBeDefined();
    expect(chunk?.prevPageToken).toBeUndefined();
  });

  it('getChunk should return next page with pageToken', async () => {
    mockCacheManager.get.mockResolvedValueOnce(dummyLargeChunk);

    const firstPage = await analysisService.getChunk(dummyLargeChunk.id, 10); // pageSize = 10
    expect(firstPage?.nextPageToken).toBeDefined();

    mockCacheManager.get.mockResolvedValueOnce(dummyLargeChunk);
    const secondPage = await analysisService.getChunk(
      dummyLargeChunk.id,
      10,
      firstPage?.nextPageToken,
    );
    expect(secondPage?.isPartial).toBe(true);
    expect(secondPage?.codeContent.split('\n').length).toBe(10);
    expect(secondPage?.currentPage).toBe(2);
    expect(secondPage?.prevPageToken).toBeDefined();
  });

  it('listFunctionsInFile should return list of functions for Swift file', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummySwiftChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummySwiftChunk);

    const functions = await analysisService.listFunctionsInFile(dummySwiftFilePath);
    expect(mockCacheManager.listAllChunkIds).toHaveBeenCalled();
    expect(mockCacheManager.get).toHaveBeenCalledWith(dummySwiftChunk.id);
    expect(functions).toEqual([{ id: dummySwiftChunk.id, signature: dummySwiftChunk.signature }]);
  });

  it('listFunctionsInFile should return list of functions for Kotlin file', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummyKotlinChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummyKotlinChunk);

    const functions = await analysisService.listFunctionsInFile(dummyKotlinFilePath);
    expect(mockCacheManager.listAllChunkIds).toHaveBeenCalled();
    expect(mockCacheManager.get).toHaveBeenCalledWith(dummyKotlinChunk.id);
    expect(functions).toEqual([{ id: dummyKotlinChunk.id, signature: dummyKotlinChunk.signature }]);
  });

  it('getFunctionChunk should return function content for Swift file', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummySwiftChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummySwiftChunk);

    const content = await analysisService.getFunctionChunk(
      dummySwiftFilePath,
      dummySwiftChunk.signature,
    );
    expect(mockCacheManager.listAllChunkIds).toHaveBeenCalled();
    expect(mockCacheManager.get).toHaveBeenCalledWith(dummySwiftChunk.id);
    expect(content).toEqual({
      codeContent: dummySwiftChunk.content,
      isPartial: false,
      totalLines: dummySwiftChunk.content.split('\n').length,
      currentPage: 1,
      totalPages: 1,
      nextPageToken: undefined,
      prevPageToken: undefined,
      startLine: dummySwiftChunk.startLine,
      endLine: dummySwiftChunk.endLine,
    });
  });

  it('getFunctionChunk should return function content for Kotlin file', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummyKotlinChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummyKotlinChunk);

    const content = await analysisService.getFunctionChunk(
      dummyKotlinFilePath,
      dummyKotlinChunk.signature,
    );
    expect(mockCacheManager.listAllChunkIds).toHaveBeenCalled();
    expect(mockCacheManager.get).toHaveBeenCalledWith(dummyKotlinChunk.id);
    expect(content).toEqual({
      codeContent: dummyKotlinChunk.content,
      isPartial: false,
      totalLines: dummyKotlinChunk.content.split('\n').length,
      currentPage: 1,
      totalPages: 1,
      nextPageToken: undefined,
      prevPageToken: undefined,
      startLine: dummyKotlinChunk.startLine,
      endLine: dummyKotlinChunk.endLine,
    });
  });

  it('getFunctionChunk should return paginated chunk if content is large', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummyLargeChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummyLargeChunk);

    const chunk = await analysisService.getFunctionChunk(
      dummyLargeChunk.filePath,
      dummyLargeChunk.signature,
      10,
    ); // pageSize = 10
    expect(chunk?.isPartial).toBe(true);
    expect(chunk?.codeContent.split('\n').length).toBe(10);
    expect(chunk?.totalLines).toBe(100);
    expect(chunk?.currentPage).toBe(1);
    expect(chunk?.totalPages).toBe(10);
    expect(chunk?.nextPageToken).toBeDefined();
    expect(chunk?.prevPageToken).toBeUndefined();
  });

  it('getFunctionChunk should return next page with pageToken', async () => {
    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummyLargeChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummyLargeChunk);

    const firstPage = await analysisService.getFunctionChunk(
      dummyLargeChunk.filePath,
      dummyLargeChunk.signature,
      10,
    ); // pageSize = 10
    expect(firstPage?.nextPageToken).toBeDefined();

    mockCacheManager.listAllChunkIds.mockResolvedValueOnce([dummyLargeChunk.id]);
    mockCacheManager.get.mockResolvedValueOnce(dummyLargeChunk);
    const secondPage = await analysisService.getFunctionChunk(
      dummyLargeChunk.filePath,
      dummyLargeChunk.signature,
      10,
      firstPage?.nextPageToken,
    );
    expect(secondPage?.isPartial).toBe(true);
    expect(secondPage?.codeContent.split('\n').length).toBe(10); // 補足行 + 10行
    expect(secondPage?.currentPage).toBe(2);
    expect(secondPage?.prevPageToken).toBeDefined();
  });
});
