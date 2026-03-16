import { AnalysisService } from '../analysisService.js';
import { CodeChunk } from '../interfaces/parser.js';
import { ParserFactory } from '../parserFactory.js';
import { IParser } from '../interfaces/parser.js';
import { AnalysisAdapter } from '../interfaces/AnalysisAdapter.js';
import { GraphNode } from '../types.js';
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

const mockAdapter: AnalysisAdapter = {
  initialized: true,
  initialize: vi.fn(),
  shutdown: vi.fn(),
  getSymbolAtPoint: vi.fn(),
  getReferences: vi.fn(),
  getOutgoingCalls: vi.fn(),
};

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
    // fs/promises を使っている場合はモックの影響を受ける。

    analysisService = new AnalysisService(TEST_CHUNKS_DIR, mockAdapter);

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.mkdir.mockResolvedValue(undefined as any);
    mockFs.rm.mockResolvedValue(undefined as any);
    mockFs.writeFile.mockResolvedValue(undefined as any);
    mockFs.unlink.mockResolvedValue(undefined as any);
    mockFs.readFile.mockResolvedValue('dummy content');

    mockParseFile.mockResolvedValue([dummySwiftChunk]);

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

  it('getClassArchitecture should return class info and its relations', async () => {
    const mockClassChunk: CodeChunk = {
      id: 'class DerivedClass',
      name: 'DerivedClass',
      signature: 'class DerivedClass: BaseClass',
      type: 'source.lang.swift.decl.class',
      content: 'class DerivedClass: BaseClass { val prop: String = "test" }',
      filePath: '/test/project/DerivedClass.kt',
      startLine: 1,
      endLine: 3,
      offset: 0,
      length: 0,
      calls: [],
      superTypes: ['BaseClass'],
      properties: [{ name: 'prop', type: 'String' }],
    };

    // CacheManager の mock 挙動を制御
    // ここでは AnalysisService が内部で CacheManager を使っているので、
    // CacheManager のメソッドをモックするか、fs を通じて挙動を制御する。
    // 現状 AnalysisService.unit.test.ts は CacheManager をモックしていない。

    // モックの readdir で全てのチャンクIDを返す
    mockFs.readdir.mockResolvedValue(['class_DerivedClass.json'] as any);
    mockFs.readFile.mockImplementation((path: any) => {
      if (path.includes('class_DerivedClass.json')) {
        return Promise.resolve(JSON.stringify(mockClassChunk));
      }
      if (path.includes('DerivedClass.kt')) {
        return Promise.resolve('class DerivedClass: BaseClass { val prop: String = "test" }');
      }
      return Promise.resolve('{}');
    });

    const result = await analysisService.getClassArchitecture('DerivedClass');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('DerivedClass');
    expect(result?.superTypes).toContain('BaseClass');
    expect(result?.properties).toHaveLength(1);
    expect(result?.properties[0].name).toBe('prop');
  });

  describe('getCallGraph', () => {
    const dummySymbol: GraphNode = {
      id: 'file:///path/to/Def.swift#15#4',
      name: 'DefFunction',
      kind: 'function',
      filePath: '/path/to/Def.swift',
    };

    const callerSymbol: GraphNode = {
      id: 'file:///path/to/Caller.swift#20#8',
      name: 'CallerFunction',
      kind: 'function',
      filePath: '/path/to/Caller.swift',
    };

    const calleeSymbol: GraphNode = {
      id: 'file:///path/to/Callee.swift#30#2',
      name: 'CalleeFunction',
      kind: 'function',
      filePath: '/path/to/Callee.swift',
    };

    it('指定した位置のシンボルから Caller/Callee を取得できること', async () => {
      vi.mocked(mockAdapter.getSymbolAtPoint).mockResolvedValue(dummySymbol);
      vi.mocked(mockAdapter.getReferences).mockResolvedValue([callerSymbol]);
      vi.mocked(mockAdapter.getOutgoingCalls).mockResolvedValue([calleeSymbol]);

      const result = await (analysisService as any).getCallGraph('/path/to/file.swift', 10, 5, 1);

      expect(result).not.toBeNull();
      expect(result.nodes).toContainEqual(dummySymbol);
      expect(result.nodes).toContainEqual(callerSymbol);
      expect(result.nodes).toContainEqual(calleeSymbol);
      expect(result.edges).toHaveLength(2); // 1 caller edge, 1 callee edge
    });

    it('アダプタが設定されていない場合にエラーを投げること', async () => {
      const serviceWithoutAdapter = new AnalysisService(TEST_CHUNKS_DIR);
      await expect(
        (serviceWithoutAdapter as any).getCallGraph('/path.swift', 1, 1),
      ).rejects.toThrow('AnalysisAdapter is not configured');
    });
  });
});
