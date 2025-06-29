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

  it('parseFile should return dummy CodeChunk for Kotlin file', async () => {
    const mockExec = vi.fn((command, args) => {
      return Promise.resolve({
        stdout: JSON.stringify([
          {
            id: 'fun main()',
            name: 'main',
            signature: 'fun main()',
            type: 'source.lang.kotlin.decl.function.free',
            content: 'fun main() {\n    println("Hello, Kotlin!")\n}',
            filePath: filePath,
            startLine: 1,
            endLine: 3,
            offset: 0,
            length: 50,
            calls: [],
          },
        ]),
        stderr: '',
      });
    });
    const parser = new KotlinParser(mockExec, mockReadFile);
    const filePath = '/path/to/test.kt';
    const chunks = await parser.parseFile(filePath);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('fun main()');
    expect(chunks[0].filePath).toBe(filePath);
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
