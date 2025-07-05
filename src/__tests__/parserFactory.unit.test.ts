// src/__tests__/parserFactory.unit.test.ts

import { ParserFactory } from '../parserFactory.js';
import { IParser, CodeChunk } from '../interfaces/parser.js';
import { vi } from 'vitest';

// ダミーのパーサー実装
class DummyParser implements IParser {
  async parseFile(filePath: string): Promise<CodeChunk[]> {
    return [
      {
        id: 'dummy-chunk-1',
        name: 'dummyFunction',
        signature: 'func dummyFunction()',
        type: 'source.lang.swift.decl.function.free',
        content: 'func dummyFunction() { /* ... */ }',
        filePath: filePath,
        startLine: 1,
        endLine: 5,
        offset: 0,
        length: 100,
        calls: [],
      },
    ];
  }
}

class AnotherDummyParser implements IParser {
  async parseFile(filePath: string): Promise<CodeChunk[]> {
    return [
      {
        id: 'another-dummy-chunk-1',
        name: 'anotherDummyFunction',
        signature: 'func anotherDummyFunction()',
        type: 'source.lang.swift.decl.function.free',
        content: 'func anotherDummyFunction() { /* ... */ }',
        filePath: filePath,
        startLine: 1,
        endLine: 5,
        offset: 0,
        length: 100,
        calls: [],
      },
    ];
  }
}

describe('ParserFactory (Unit Tests)', () => {
  beforeEach(() => {
    // 各テストの前にファクトリの状態をリセット
    // @ts-ignore: privateプロパティへのアクセス
    ParserFactory.parsers = new Map();
  });

  it('should register and retrieve a parser', () => {
    const swiftParser = new DummyParser();
    ParserFactory.registerParser('swift', swiftParser);

    const retrievedParser = ParserFactory.getParser('swift');
    expect(retrievedParser).toBe(swiftParser);
  });

  it('should throw error if parser for language is already registered', () => {
    const swiftParser = new DummyParser();
    ParserFactory.registerParser('swift', swiftParser);

    expect(() => ParserFactory.registerParser('swift', new AnotherDummyParser())).toThrow(
      "Parser for language 'swift' already registered.",
    );
  });

  it('should throw error if no parser is registered for a language', () => {
    expect(() => ParserFactory.getParser('test.unknown', 'unknown')).toThrow(
      "No parser registered for language 'unknown'.",
    );
  });

  it('should register multiple parsers for different languages', () => {
    const swiftParser = new DummyParser();
    const kotlinParser = new AnotherDummyParser();

    ParserFactory.registerParser('swift', swiftParser);
    ParserFactory.registerParser('kotlin', kotlinParser);

    expect(ParserFactory.getParser('dummy.swift', 'swift')).toBe(swiftParser);
    expect(ParserFactory.getParser('dummy.kt', 'kotlin')).toBe(kotlinParser);
  });

  it('should determine language from file extension if language is not specified', () => {
    const swiftParser = new DummyParser();
    const kotlinParser = new AnotherDummyParser();

    ParserFactory.registerParser('swift', swiftParser);
    ParserFactory.registerParser('kotlin', kotlinParser);

    expect(ParserFactory.getParser('test.swift')).toBe(swiftParser);
    expect(ParserFactory.getParser('test.kt')).toBe(kotlinParser);
  });

  it('should prioritize specified language over file extension', () => {
    const swiftParser = new DummyParser();
    const kotlinParser = new AnotherDummyParser();

    ParserFactory.registerParser('swift', swiftParser);
    ParserFactory.registerParser('kotlin', kotlinParser);

    // filePathが.swiftだが、languageでkotlinを指定した場合
    expect(ParserFactory.getParser('test.swift', 'kotlin')).toBe(kotlinParser);
  });

  it('should throw error if language cannot be determined from extension and not specified', () => {
    const swiftParser = new DummyParser();
    ParserFactory.registerParser('swift', swiftParser);

    expect(() => ParserFactory.getParser('test.txt')).toThrow(
      'Could not determine language from file extension: txt. Please specify language explicitly.',
    );
  });

  it('should throw error if specified language has no registered parser', () => {
    const swiftParser = new DummyParser();
    ParserFactory.registerParser('swift', swiftParser);

    expect(() => ParserFactory.getParser('test.swift', 'java')).toThrow(
      "No parser registered for language 'java'.",
    );
  });
});
