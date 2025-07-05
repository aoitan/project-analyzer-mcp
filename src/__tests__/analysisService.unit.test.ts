import { AnalysisService } from '../analysisService.js';
import { CodeChunk } from '../interfaces/parser.js';
import { ParserFactory } from '../parserFactory.js';
import { IParser } from '../interfaces/parser.js';
import { vi } from 'vitest';
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

vi.mock('fs/promises');
vi.mock('glob');

const mockFs = vi.mocked(fs);
const mockGlob = vi.mocked(glob);

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
    filePath: dummyKotlinFilePath,
    startLine: 1,
    endLine: 5,
    offset: 0,
    length: 100,
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
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(dummySwiftChunk));

    // Mock glob
    mockGlob.mockResolvedValue([dummySwiftFilePath]);
  });

  it('analyzeProject should parse Swift files and save chunks', async () => {
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.swift', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummySwiftFilePath, 'swift');
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      `./data/chunks/${analysisService['toSafeFileName'](dummySwiftChunk.id)}.json`,
      JSON.stringify(dummySwiftChunk, null, 2),
    );
  });

  it('analyzeProject should parse Kotlin files and save chunks', async () => {
    const projectPath = '/test/project';
    mockGlob.mockResolvedValueOnce([dummyKotlinFilePath]); // Kotlinファイルのみを返すようにモック
    mockParseFile.mockResolvedValueOnce([dummyKotlinChunk]); // Kotlinチャンクを返すようにモック

    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.kt', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummyKotlinFilePath, 'kotlin');
    expect(mockParseFile).toHaveBeenCalledWith(dummyKotlinFilePath);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      `./data/chunks/${analysisService['toSafeFileName'](dummyKotlinChunk.id)}.json`,
      JSON.stringify(dummyKotlinChunk, null, 2),
    );
  });

  it('getChunk should return chunk from cache if available', async () => {
    // Populate cache first
    analysisService['parsedProjects'].set('/test/project', [dummySwiftChunk]);

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);
    expect(chunk).toEqual({ content: dummySwiftChunk.content });
    expect(mockFs.readFile).not.toHaveBeenCalled(); // Should not read from disk
  });

  it('getChunk should load chunk from disk if not in cache', async () => {
    analysisService['parsedProjects'].clear(); // Ensure cache is empty

    const chunk = await analysisService.getChunk(dummySwiftChunk.id);
    expect(mockFs.readFile).toHaveBeenCalledWith(
      `./data/chunks/${analysisService['toSafeFileName'](dummySwiftChunk.id)}.json`,
      'utf-8',
    );
    expect(chunk).toEqual({ content: dummySwiftChunk.content });
  });

  it('listFunctionsInFile should return list of functions for Swift file', async () => {
    // analyzeProject内でglobがファイル形式の数だけ呼ばれるので.swiftが複数回積まれないようにする必要がある
    mockGlob.mockResolvedValueOnce([dummyKotlinFilePath]); // Kotlinファイルのみを返すようにモック
    mockParseFile.mockResolvedValueOnce([dummyKotlinChunk]); // Kotlinチャンクを返すようにモック
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);
    const functions = await analysisService.listFunctionsInFile(dummySwiftFilePath);
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummySwiftFilePath, 'swift');
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(functions).toEqual([{ id: dummySwiftChunk.id, signature: dummySwiftChunk.signature }]);
  });

  it('listFunctionsInFile should return list of functions for Kotlin file', async () => {
    mockGlob.mockResolvedValueOnce([dummyKotlinFilePath]); // Kotlinファイルのみを返すようにモック
    mockParseFile.mockResolvedValueOnce([dummyKotlinChunk]); // Kotlinチャンクを返すようにモック
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);
    const functions = await analysisService.listFunctionsInFile(dummyKotlinFilePath);
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummyKotlinFilePath, 'kotlin');
    expect(mockParseFile).toHaveBeenCalledWith(dummyKotlinFilePath);
    expect(functions).toEqual([{ id: dummyKotlinChunk.id, signature: dummyKotlinChunk.signature }]);
  });

  it('getFunctionChunk should return function content for Swift file', async () => {
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);
    const content = await analysisService.getFunctionChunk(
      dummySwiftFilePath,
      dummySwiftChunk.signature,
    );
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummySwiftFilePath, 'swift');
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    expect(content).toEqual({ content: dummySwiftChunk.content });
  });

  it('getFunctionChunk should return function content for Kotlin file', async () => {
    mockGlob.mockResolvedValueOnce([dummyKotlinFilePath]); // Kotlinファイルのみを返すようにモック
    mockParseFile.mockResolvedValueOnce([dummyKotlinChunk]); // Kotlinチャンクを返すようにモック
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);
    const content = await analysisService.getFunctionChunk(
      dummyKotlinFilePath,
      dummyKotlinChunk.signature,
    );
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummyKotlinFilePath, 'kotlin');
    expect(mockParseFile).toHaveBeenCalledWith(dummyKotlinFilePath);
    expect(content).toEqual({ content: dummyKotlinChunk.content });
  });
});
