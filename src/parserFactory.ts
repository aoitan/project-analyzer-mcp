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

  public static getParser(filePath: string, language?: string): IParser {
    let determinedLanguage = language;

    if (!determinedLanguage) {
      const ext = filePath.split('.').pop();
      switch (ext) {
        case 'swift':
          determinedLanguage = 'swift';
          break;
        case 'kt':
          determinedLanguage = 'kotlin';
          break;
        default:
          throw new Error(
            `Could not determine language from file extension: ${ext || ''}. Please specify language explicitly.`,
          );
      }
    }

    if (!determinedLanguage) {
      throw new Error('Language could not be determined.');
    }

    const parser = ParserFactory.parsers.get(determinedLanguage);
    if (!parser) {
      throw new Error(`No parser registered for language '${determinedLanguage}'.`);
    }
    return parser;
  }
}

// 初期パーサーの登録
ParserFactory.registerParser('swift', new SwiftParser());
ParserFactory.registerParser('kotlin', new KotlinParser());
