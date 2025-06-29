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

vi.mock('../parserFactory.js', () => ({
  ParserFactory: {
    getParser: vi.fn((language: string) => {
      if (language === 'swift') {
        return new MockSwiftParser();
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
  const dummyFilePath = '/test/project/dummy.swift';
  const dummyChunk: CodeChunk = {
    name: 'dummyFunction1(param:)',
    type: 'source.lang.swift.decl.function.free',
    signature: 'func dummyFunction1(param:) -> Int',
    id: 'func dummyFunction1(param:) -> Int',
    content: 'return 1',
    startLine: 1,
    endLine: 3,
    filePath: dummyFilePath, // CodeChunk に filePath を追加
    offset: 0,
    length: 0,
    calls: [],
  };

  beforeEach(() => {
    analysisService = new AnalysisService();
    vi.clearAllMocks();

    // Mock ParserFactory.getParser が MockSwiftParser を返すように設定
    // これは vi.mock('../parserFactory.js') で既に設定済み

    // MockSwiftParser の parseFile メソッドの振る舞いを設定
    mockParseFile.mockResolvedValue([dummyChunk]);

    // Mock fs/promises methods
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(dummyChunk));

    // Mock glob
    mockGlob.mockResolvedValue([dummyFilePath]);
  });

  it('analyzeProject should parse files and save chunks', async () => {
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.swift', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith('swift'); // getParser が呼ばれたことを確認
    expect(mockParseFile).toHaveBeenCalledWith(dummyFilePath);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      `./data/chunks/${analysisService['toSafeFileName'](dummyChunk.id)}.json`,
      JSON.stringify(dummyChunk, null, 2),
    );
  });

  it('getChunk should return chunk from cache if available', async () => {
    // Populate cache first
    analysisService['parsedProjects'].set('/test/project', [dummyChunk]);

    const chunk = await analysisService.getChunk(dummyChunk.id);
    expect(chunk).toEqual({ content: dummyChunk.content });
    expect(mockFs.readFile).not.toHaveBeenCalled(); // Should not read from disk
  });

  it('getChunk should load chunk from disk if not in cache', async () => {
    analysisService['parsedProjects'].clear(); // Ensure cache is empty

    const chunk = await analysisService.getChunk(dummyChunk.id);
    expect(mockFs.readFile).toHaveBeenCalledWith(
      `./data/chunks/${analysisService['toSafeFileName'](dummyChunk.id)}.json`,
      'utf-8',
    );
    expect(chunk).toEqual({ content: dummyChunk.content });
  });

  it('listFunctionsInFile should return list of functions', async () => {
    const functions = await analysisService.listFunctionsInFile(dummyFilePath);
    expect(ParserFactory.getParser).toHaveBeenCalledWith('swift'); // getParser が呼ばれたことを確認
    expect(mockParseFile).toHaveBeenCalledWith(dummyFilePath);
    expect(functions).toEqual([{ id: dummyChunk.id, signature: dummyChunk.signature }]);
  });

  it('getFunctionChunk should return function content', async () => {
    const content = await analysisService.getFunctionChunk(dummyFilePath, dummyChunk.signature);
    expect(ParserFactory.getParser).toHaveBeenCalledWith('swift'); // getParser が呼ばれたことを確認
    expect(mockParseFile).toHaveBeenCalledWith(dummyFilePath);
    expect(content).toEqual({ content: dummyChunk.content });
  });
});
