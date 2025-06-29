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
  readFile: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);
const mockReadFile = vi.mocked(fs.readFile);

describe('KotlinParser (Unit Tests)', () => {
  let parser: KotlinParser;

  beforeEach(() => {
    parser = new KotlinParser();
    vi.clearAllMocks();
  });

  it('parseFile should return CodeChunk array on success', async () => {
    const mockExec = vi.fn((command, args) => {
      const filePath = args[args.length - 1]; // Assuming filePath is the last argument
      const mockOutput = [
        {
          'key.kind': 'source.lang.kotlin.decl.function.free',
          'key.name': 'main',
          'key.nameoffset': 4,
          'key.namelength': 4,
          'key.offset': 0,
          'key.length': 44,
          'key.typename': 'Unit',
          'key.bodyoffset': 15,
          'key.bodylength': 29,
          'key.substructure': [],
        },
        {
          'key.kind': 'source.lang.kotlin.decl.class',
          'key.name': 'MyClass',
          'key.nameoffset': 6,
          'key.namelength': 7,
          'key.offset': 46,
          'key.length': 79,
          'key.substructure': [
            {
              'key.kind': 'source.lang.kotlin.decl.function.method',
              'key.name': 'myMethod',
              'key.nameoffset': 59,
              'key.namelength': 8,
              'key.offset': 63,
              'key.length': 55,
              'key.typename': 'Unit',
              'key.bodyoffset': 82,
              'key.bodylength': 36,
              'key.substructure': [],
            },
          ],
        },
      ];
      return Promise.resolve({
        stdout: JSON.stringify(mockOutput),
        stderr: '',
      });
    });
    const mockFileContent = `fun main() {
    println("Hello, Kotlin!")
}

class MyClass {
    fun myMethod() {
        println("Inside myMethod")
    }
}`;
    mockReadFile.mockResolvedValue(Buffer.from(mockFileContent, 'utf8'));
    const parser = new KotlinParser(mockExec, mockReadFile);
    const filePath = '/path/to/temp.kt';
    const chunks = await parser.parseFile(filePath);
    console.log(`chunks:\n${JSON.stringify(chunks, null, 2)}`);

    expect(chunks).toHaveLength(2); // main function and MyClass
    expect(chunks[0].id).toBe('fun main(): Unit');
    expect(chunks[0].name).toBe('main');
    expect(chunks[0].signature).toBe('fun main(): Unit');
    expect(chunks[0].type).toBe('source.lang.kotlin.decl.function.free');
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

    expect(mockExec).toHaveBeenCalledWith('kotlin-language-server', ['--file', filePath]);
  });

  it('parseFile should handle errors during parsing', async () => {
    const errorExec = vi.fn((command, args) => {
      return Promise.reject(new Error('Mocked exec error'));
    });
    const errorParser = new KotlinParser(errorExec, mockReadFile);
    const filePath = '/path/to/error.kt';
    const chunks = await errorParser.parseFile(filePath);

    expect(chunks).toEqual([]);
    expect(errorExec).toHaveBeenCalledWith('kotlin-language-server', ['--file', filePath]);
  });
});
