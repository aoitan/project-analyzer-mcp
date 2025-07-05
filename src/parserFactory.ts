// src/parserFactory.ts

import { IParser } from './interfaces/parser.js';
import { SwiftParser } from './swiftParser.js';
import { KotlinParser } from './kotlinParser.js';

export class ParserFactory {
  private static parsers: Map<string, IParser> = new Map();

  public static registerParser(language: string, parser: IParser): void {
    if (ParserFactory.parsers.has(language)) {
      throw new Error(`Parser for language '${language}' already registered.`);
    }
    ParserFactory.parsers.set(language, parser);
  }

  public static getParser(language: string): IParser {
    const parser = ParserFactory.parsers.get(language);
    if (!parser) {
      throw new Error(`No parser registered for language '${language}'.`);
    }
    return parser;
  }
}

// 初期パーサーの登録
ParserFactory.registerParser('swift', new SwiftParser());
ParserFactory.registerParser('kotlin', new KotlinParser());
