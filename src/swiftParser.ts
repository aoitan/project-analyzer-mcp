import { spawn } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import logger from './utils/logger.js';

type ExecFunction = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;
type ReadFileFunction = typeof fsp.readFile;

const defaultExec: ExecFunction = (command: string, args: string[]) => {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Command failed with code ${code}: ${stderr}`);
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on('error', (err) => {
      logger.error(`Command execution error: ${err.message}`);
      reject(err);
    });
  });
};

const defaultReadFile = fsp.readFile;

import { SourceKittenStructure } from './types.js';
import { IParser, CodeChunk } from './interfaces/parser.js';

export class SwiftParser implements IParser {
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
      // sourcekitten structure --file ${filePath} を spawn の引数に分割
      const { stdout } = await this.exec('sourcekitten', ['structure', '--file', filePath]);
      logger.info(`Successfully parsed file: ${filePath}`);

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

          const fileContentBuffer = await this.readFile(filePath);
          const content = fileContentBuffer.toString(
            'utf8',
            item['key.offset'] || 0,
            (item['key.offset'] || 0) + (item['key.length'] || 0),
          );

          return {
            name: item['key.name'],
            type: item['key.kind'],
            signature: signature,
            id: signature,
            content: content,
            filePath: filePath,
            startLine: startLine,
            endLine: endLine,
            offset: item['key.offset'] || 0,
            length: item['key.length'] || 0,
            calls: [],
          };
        }),
      );

      return functions;
    } catch (error) {
      logger.error(`Error parsing file ${filePath}: ${error}`);
      return []; // エラー発生時は空の配列を返す
    }
  }

  private async getLineNumber(filePath: string, offset: number): Promise<number> {
    try {
      const fileContentBuffer = await this.readFile(filePath);
      const textUntilOffset = fileContentBuffer.toString('utf8', 0, offset);
      const newlines = textUntilOffset.match(/\r\n|\n|\r/g);
      const lineNumber = newlines ? newlines.length + 1 : 1;

      return lineNumber;
    } catch (error) {
      logger.error(`Error getting line number for ${filePath} at offset ${offset}: ${error}`);
      return 0; // エラー時は0行目を返すか、適切なエラーハンドリングを行う
    }
  }

  async getFunctionContent(filePath: string, targetFunction: CodeChunk): Promise<string | null> {
    try {
      const fileContentBuffer = await this.readFile(filePath);

      if (
        targetFunction &&
        targetFunction.offset !== undefined &&
        targetFunction.length !== undefined
      ) {
        const bodyContent = fileContentBuffer.toString(
          'utf8',
          targetFunction.offset,
          targetFunction.offset + targetFunction.length,
        );

        return bodyContent.trim();
      }

      return null;
    } catch (error) {
      logger.error(
        `Error getting function content for ${targetFunction.id} in ${filePath}: ${error}`,
      );
      return null;
    }
  }
}
