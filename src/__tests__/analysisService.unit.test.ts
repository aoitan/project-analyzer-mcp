import { AnalysisService } from '../analysisService.js';
import { SwiftParser } from '../parser.js';
import { CodeChunk } from '../types.js';
import { vi } from 'vitest';
import * as fs from 'fs/promises';
import { glob } from 'glob';

// Mock the parser module and fs/promises
const mockParseFile = vi.fn();
const mockGetFunctionContent = vi.fn();

vi.mock('../parser.js', () => ({
  SwiftParser: vi.fn(() => ({
    parseFile: mockParseFile,
    getFunctionContent: mockGetFunctionContent,
  })),
}));
vi.mock('fs/promises');
vi.mock('glob');

const mockSwiftParser = vi.mocked(SwiftParser);
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
  };

  beforeEach(() => {
    analysisService = new AnalysisService();
    vi.clearAllMocks();

    // Mock SwiftParser methods
    mockParseFile.mockResolvedValue([dummyChunk]);
    mockGetFunctionContent.mockResolvedValue(dummyChunk.content);

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
    expect(mockParseFile).toHaveBeenCalledWith(dummyFilePath);
    expect(functions).toEqual([{ id: dummyChunk.id, signature: dummyChunk.signature }]);
  });

  it('getFunctionChunk should return function content', async () => {
    const content = await analysisService.getFunctionChunk(dummyFilePath, dummyChunk.signature);
    expect(content).toEqual({ content: dummyChunk.content });
  });
});
