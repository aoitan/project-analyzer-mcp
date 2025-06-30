// src/__tests__/kotlinParser.unit.test.ts

import { KotlinParser } from '../kotlinParser.js';
import { vi } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

// Mock child_process.spawn and fs.readFile
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  })),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);
const mockReadFile = vi.mocked(fs.readFile);

describe('KotlinParser (Unit Tests)', () => {
  let parser: KotlinParser;

  const mockKotlinParserCliOutput = {
    type: 'File',
    name: 'temp.kt',
    content:
      'fun main() {\n    println("Hello, Kotlin!")\n}\n\nclass MyClass {\n    fun myMethod() {\n        println("Inside myMethod")\n    }\n}\n',
    startLine: 1,
    endLine: 10,
    offset: 0,
    length: 126,
    children: [
      {
        type: 'function',
        name: 'main',
        signature: 'fun main()',
        content: 'fun main() {\n    println("Hello, Kotlin!")\n}',
        startLine: 1,
        endLine: 3,
        offset: 0,
        length: 44,
      },
      {
        type: 'class',
        name: 'MyClass',
        signature: 'class MyClass',
        content:
          'class MyClass {\n    fun myMethod() {\n        println("Inside myMethod")\n    }\n}',
        startLine: 5,
        endLine: 9,
        offset: 46,
        length: 79,
      },
    ],
  };
  const mockFileContent = `fun main() {
    println("Hello, Kotlin!")
}

class MyClass {
    fun myMethod() {
        println("Inside myMethod")
    }
}`;

  beforeEach(() => {
    parser = new KotlinParser(
      vi.fn((command, args) => {
        // ここで spawn の引数形式を模倣
        if (command === 'java' && args[1].includes('kotlin-parser-cli.jar')) {
          return Promise.resolve({ stdout: JSON.stringify(mockKotlinParserCliOutput), stderr: '' });
        }
        return Promise.reject(new Error('Unknown command'));
      }),
      mockReadFile,
    );
    vi.clearAllMocks();
    const buf = Buffer.from(mockFileContent, 'utf8');
    //console.log(buf.toString());
    mockReadFile.mockResolvedValue(buf);
  });

  it('parseFile should return CodeChunk array on success', async () => {
    mockReadFile.mockResolvedValue(Buffer.from(mockFileContent, 'utf8'));

    const filePath = '/path/to/temp.kt';

    const chunks = await parser.parseFile(filePath);
    console.log(`chunks:\n${JSON.stringify(chunks, null, 2)}`);

    expect(chunks).toHaveLength(2); // main function and MyClass
    expect(chunks[0].id).toBe('fun main(): Unit');
    expect(chunks[0].name).toBe('main');
    expect(chunks[0].signature).toBe('fun main(): Unit');
    expect(chunks[0].type).toBe('source.lang.kotlin.decl.function'); // typeを修正
    expect(chunks[0].content).toBe(`fun main() {
    println("Hello, Kotlin!")
}`);
    expect(chunks[0].filePath).toBe(filePath);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(3);
    expect(chunks[0].offset).toBe(0);
    expect(chunks[0].length).toBe(44);
    expect(chunks[0].calls).toEqual([]);

    expect(chunks[1].id).toBe('class MyClass');
    expect(chunks[1].name).toBe('MyClass');
    expect(chunks[1].signature).toBe('class MyClass');
    expect(chunks[1].type).toBe('source.lang.kotlin.decl.class');
    expect(chunks[1].content).toBe(`class MyClass {
    fun myMethod() {
        println("Inside myMethod")
    }
}`);
    expect(chunks[1].filePath).toBe(filePath);
    expect(chunks[1].startLine).toBe(5);
    expect(chunks[1].endLine).toBe(9);
    expect(chunks[1].offset).toBe(46);
    expect(chunks[1].length).toBe(79);
    expect(chunks[1].calls).toEqual([]);

    // expect(mockExec).toHaveBeenCalledWith('kotlin-language-server', ['--file', filePath]); // 実際のJAR呼び出しになるためコメントアウト
  });

  it('parseFile should handle errors during parsing', async () => {
    const errorExec = vi.fn((command, args) => {
      return Promise.reject(new Error('Mocked exec error'));
    });
    const errorParser = new KotlinParser(errorExec, mockReadFile);
    const filePath = '/path/to/error.kt';
    const chunks = await errorParser.parseFile(filePath);

    expect(chunks).toEqual([]);
    expect(errorExec).toHaveBeenCalledWith('java', [
      '-jar',
      'kotlin-parser-cli/build/libs/kotlin-parser-cli.jar',
      filePath,
    ]);
  });
});
