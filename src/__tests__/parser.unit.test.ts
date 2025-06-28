import { SwiftParser, CodeChunk } from '../parser.js';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { vi } from 'vitest';

// Mock child_process.exec and fs.readFile
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

const mockExec = vi.mocked(exec);
const mockReadFile = vi.mocked(fs.readFile);

describe('SwiftParser (Unit Tests)', () => {
  let parser: SwiftParser;

  beforeEach(() => {
    console.log('[Test] beforeEach: Start');
    parser = new SwiftParser(mockExec, mockReadFile);
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(mockFileContent);
    mockExec.mockResolvedValue({ stdout: mockSourceKittenOutput, stderr: '' });
    console.log('[Test] beforeEach: End');
  });

  // Mock SourceKitten's successful output for a dummy Swift file
  const mockSourceKittenOutput = JSON.stringify({
    'key.diagnostic_stage': 'source.diagnostic.stage.swift.parse',
    'key.length': 105,
    'key.offset': 0,
    'key.substructure': [
      {
        'key.accessibility': 'source.lang.swift.accessibility.internal',
        'key.bodylength': 14,
        'key.bodyoffset': 43,
        'key.kind': 'source.lang.swift.decl.function.free',
        'key.length': 58,
        'key.name': 'dummyFunction1(param:)',
        'key.namelength': 29,
        'key.nameoffset': 5,
        'key.offset': 0,
        'key.substructure': [
          {
            'key.kind': 'source.lang.swift.decl.var.parameter',
            'key.length': 13,
            'key.name': 'param',
            'key.namelength': 5,
            'key.nameoffset': 20,
            'key.offset': 20,
            'key.typename': 'String',
          },
        ],
        'key.typename': 'Int',
      },
      {
        'key.accessibility': 'source.lang.swift.accessibility.internal',
        'key.bodylength': 20,
        'key.bodyoffset': 83,
        'key.kind': 'source.lang.swift.decl.function.free',
        'key.length': 44,
        'key.name': 'dummyFunction2()',
        'key.namelength': 16,
        'key.nameoffset': 65,
        'key.offset': 60,
        'key.substructure': [
          {
            'key.bodylength': 7,
            'key.bodyoffset': 94,
            'key.kind': 'source.lang.swift.expr.call',
            'key.length': 14,
            'key.name': 'print',
            'key.namelength': 5,
            'key.nameoffset': 88,
            'key.offset': 88,
            'key.substructure': [
              {
                'key.bodylength': 7,
                'key.bodyoffset': 94,
                'key.kind': 'source.lang.swift.expr.argument',
                'key.length': 7,
                'key.offset': 94,
              },
            ],
          },
        ],
      },
    ],
  });

  const mockFileContent = `func dummyFunction1(param: String) -> Int {
    return 1
}

func dummyFunction2() {
    print("Hello")
}
`;

  const expectedDummyFunction1Content = `func dummyFunction1(param: String) -> Int {
    return 1
}`;

  it('parseFile should return CodeChunk array on success', async () => {
    mockExec.mockResolvedValue({ stdout: mockSourceKittenOutput, stderr: '' });
    mockReadFile.mockResolvedValue(mockFileContent);

    const filePath = '/path/to/test.swift';
    const chunks = await parser.parseFile(filePath);

    expect(mockExec).toHaveBeenCalledWith(`sourcekitten structure --file ${filePath}`);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].id).toBe('func dummyFunction1(param:) -> Int');
    expect(chunks[0].signature).toBe('func dummyFunction1(param:) -> Int');
    expect(chunks[0].content).toBe(expectedDummyFunction1Content);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(3);

    expect(chunks[1].id).toBe('func dummyFunction2()');
    expect(chunks[1].signature).toBe('func dummyFunction2()');
    expect(chunks[1].content).toBe(`func dummyFunction2() {
    print("Hello")
}`);
    expect(chunks[1].startLine).toBe(5);
    expect(chunks[1].endLine).toBe(7);
    console.log('[Test] parseFile success test: End');
  });

  it('parseFile should return empty array on SourceKitten error', async () => {
    mockExec.mockRejectedValue(new Error('SourceKitten command failed'));

    const filePath = '/path/to/error.swift';
    const chunks = await parser.parseFile(filePath);

    expect(mockExec).toHaveBeenCalledWith(`sourcekitten structure --file ${filePath}`);
    expect(chunks).toEqual([]);
    console.log('[Test] parseFile error test: End');
  });

  it('getFunctionContent should return function content on success', async () => {
    console.log('[Test] getFunctionContent success test: Start');

    const filePath = '/path/to/test.swift';
    const functionSignature = 'func dummyFunction1(param:) -> Int';
    const content = await parser.getFunctionContent(filePath, {
      name: 'dummyFunction1(param:)',
      type: 'source.lang.swift.decl.function.free',
      signature: 'func dummyFunction1(param:) -> Int',
      id: 'func dummyFunction1(param:) -> Int',
      content: '',
      startLine: 1,
      endLine: 3,
      bodyOffset: 0,
      bodyLength: 0,
      offset: 0,
      length: 58,
    });
    expect(content).toBe(expectedDummyFunction1Content);
    console.log('[Test] getFunctionContent success test: End');
  });

  it('getFunctionContent should return null if function not found', async () => {
    console.log('[Test] getFunctionContent not found test: Start');

    const filePath = '/path/to/test.swift';
    const functionSignature = 'func nonExistentFunction() -> Void';
    const content = await parser.getFunctionContent(filePath, {
      name: 'nonExistentFunction()',
      type: 'source.lang.swift.decl.function.free',
      signature: 'func nonExistentFunction() -> Void',
      id: 'func nonExistentFunction() -> Void',
      content: '',
      startLine: 0,
      endLine: 0,
      bodyOffset: 0,
      bodyLength: 0,
      offset: 0,
      length: 0,
    });

    expect(content).toBe('');
    console.log('[Test] getFunctionContent not found test: End');
  });

  it('getFunctionContent should return null on file read error', async () => {
    console.log('[Test] getFunctionContent file read error test: Start');

    mockReadFile.mockRejectedValueOnce(new Error('File not found'));

    const filePath = '/path/to/non_existent_file.swift';
    const functionSignature = 'func dummyFunction1(param:) -> Int';
    const content = await parser.getFunctionContent(filePath, {
      name: 'dummyFunction1(param:)',
      type: 'source.lang.swift.decl.function.free',
      signature: 'func dummyFunction1(param:) -> Int',
      id: 'func dummyFunction1(param:) -> Int',
      content: '',
      startLine: 1,
      endLine: 3,
      bodyOffset: 0,
      bodyLength: 0,
      offset: 0,
      length: 58,
    });

    expect(content).toBeNull();
    console.log('[Test] getFunctionContent file read error test: End');
  });
});
