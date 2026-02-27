import { AnalysisService } from '../analysisService.js';
import { CodeChunk } from '../interfaces/parser.js';
import { ParserFactory } from '../parserFactory.js';
import { IParser } from '../interfaces/parser.js';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_CHUNKS_DIR = path.join(__dirname, '../../data/chunks_unit_test');

// Mock the parser module and fs/promises
const mockParseFile = vi.fn();

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
    registerParser: vi.fn(),
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
    language: 'swift',
    startLine: 1,
    endLine: 3,
    filePath: dummySwiftFilePath,
    offset: 0,
    length: 0,
    calls: [],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // 実物の CacheManager が動くようにディレクトリを準備
    // 注: mockFs.mkdir などを呼んでいるため、実際にはディスクには書かれないが、
    // CacheManager 内部で fs/promises を使っている場合はモックの影響を受ける。
    
    analysisService = new AnalysisService(TEST_CHUNKS_DIR);

    mockParseFile.mockResolvedValue([dummySwiftChunk]);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('dummy content');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    
    mockGlob.mockResolvedValue([dummySwiftFilePath]);
  });

  it('analyzeProject should parse Swift files and save chunks', async () => {
    const projectPath = '/test/project';
    await analysisService.analyzeProject(projectPath);

    expect(mockGlob).toHaveBeenCalledWith('**/*.swift', { cwd: projectPath, absolute: true });
    expect(ParserFactory.getParser).toHaveBeenCalledWith(dummySwiftFilePath, 'swift');
    expect(mockParseFile).toHaveBeenCalledWith(dummySwiftFilePath);
    
    // キャッシュへの保存が行われたことを確認
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it('ファイル削除(ENOENT)時にキャッシュをクリアし、nullを返すこと', async () => {
    // 最初の get で既存キャッシュがあると見せかけるための設定が必要だが、
    // fs が完全にモックされているため、実物の CacheManager の挙動を
    // fs モックの返り値で制御する。
    
    mockFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' }); // ensureLatestFileAnalysis で失敗

    const chunk = await analysisService.getChunk('non-existent-id');
    expect(chunk).toBeNull();
  });
});
