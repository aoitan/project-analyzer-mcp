import { exec as cp_exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

type ExecFunction = (command: string) => Promise<{ stdout: string; stderr: string }>;
type ReadFileFunction = typeof fsp.readFile;

const defaultExec: ExecFunction = promisify(cp_exec);
const defaultReadFile = fsp.readFile;

import { CodeChunk, SourceKittenStructure } from './types.js';

export class SwiftParser {
  private exec: ExecFunction;
  private readFile: ReadFileFunction;

  constructor(
    execFn: ExecFunction = defaultExec,
    readFileFn: ReadFileFunction = defaultReadFile as ReadFileFunction,
  ) {
    this.exec = execFn;
    this.readFile = readFileFn;
  }

  async parseFile(filePath: string): Promise<CodeChunk[]> {
    try {
      const { stdout } = await this.exec(`sourcekitten structure --file ${filePath}`);

      const sourceKittenOutput = JSON.parse(stdout);

      const rawFunctions: any[] = [];
      const collectRawFunctions = (items: any[]) => {
        for (const item of items) {
          if (item['key.kind'] && item['key.kind'].startsWith('source.lang.swift.decl.function')) {
            rawFunctions.push(item);
          }
          if (item['key.substructure']) {
            collectRawFunctions(item['key.substructure']);
          }
        }
      };
      collectRawFunctions(sourceKittenOutput['key.substructure'] || []);

      const functions: CodeChunk[] = await Promise.all(
        rawFunctions.map(async (item) => {
          const startLine = await this.getLineNumber(filePath, item['key.offset']);
          const endLine = await this.getLineNumber(
            filePath,
            item['key.offset'] + item['key.length'],
          );

          let signature = item['key.name'] || '';
          if (item['key.typename']) {
            signature = `func ${signature} -> ${item['key.typename']}`;
          } else {
            signature = `func ${signature}`;
          }

          const content = await this.getFunctionContent(filePath, {
            name: item['key.name'],
            type: item['key.kind'],
            signature: signature,
            id: signature,
            content: '',
            startLine: startLine,
            endLine: endLine,
            bodyOffset: item['key.bodyoffset'] || 0,
            bodyLength: item['key.bodylength'] || 0,
            offset: item['key.offset'] || 0,
            length: item['key.length'] || 0,
          });

          return {
            name: item['key.name'],
            type: item['key.kind'],
            signature: signature,
            id: signature,
            content: content || '',
            startLine: startLine,
            endLine: endLine,
            bodyOffset: item['key.bodyoffset'] || 0,
            bodyLength: item['key.bodylength'] || 0,
            offset: item['key.offset'] || 0,
            length: item['key.length'] || 0,
          };
        }),
      );

      return functions;
    } catch (error) {
      return [];
    }
  }

  private async getLineNumber(filePath: string, offset: number): Promise<number> {
    const fileContentBuffer = await this.readFile(filePath, 'utf-8');
    const fileContent = fileContentBuffer.toString();
    const textUntilOffset = fileContent.slice(0, offset);
    const newlines = textUntilOffset.match(/\r\n|\n|\r/g);
    const lineNumber = newlines ? newlines.length + 1 : 1;

    return lineNumber;
  }

  async getFunctionContent(filePath: string, targetFunction: CodeChunk): Promise<string | null> {
    try {
      const fileContentBuffer = await this.readFile(filePath, 'utf-8');
      const fileContent = fileContentBuffer.toString();

      if (
        targetFunction &&
        targetFunction.offset !== undefined &&
        targetFunction.length !== undefined
      ) {
        const bodyContent = fileContent
          .substring(targetFunction.offset, targetFunction.offset + targetFunction.length)
          .trim();

        return bodyContent;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}
