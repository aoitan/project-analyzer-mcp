// src/kotlinParser.ts

import { IParser, CodeChunk } from './interfaces/parser.js';
import { spawn } from 'child_process';
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

export class KotlinParser implements IParser {
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
    console.log(`parsedFile: start ${filePath}`);
    try {
      const { stdout } = await this.exec('java', [
        '-jar',
        'kotlin-parser-cli/build/libs/kotlin-parser-cli.jar',
        filePath,
      ]);
      const parsedOutput: any = JSON.parse(stdout);

      const fileContentBuffer = await this.readFile(filePath);

      const chunks: CodeChunk[] = await Promise.all(
        parsedOutput.children.map(async (item: any) => {
          const startLine = item.startLine;
          const endLine = item.endLine;

          let signature = item.signature || item.name || '';

          if (item.type === 'function') {
            // item.signature があればそのまま使うので、以下のロジックは不要になる
            // if (!signature.includes('(')) {
            //   signature += '()';
            // }
            // signature = `fun ${signature}: ${item.typename || 'Unit'}`;
          } else if (item.type === 'class') {
            // signature = `class ${signature}`;
          }

          const content = fileContentBuffer.toString(
            'utf8',
            item.offset || 0,
            (item.offset || 0) + (item.length || 0),
          );

          return {
            id: signature,
            name: item.name,
            signature: signature,
            type: `source.lang.kotlin.decl.${item.type}`,
            content: content,
            filePath: filePath,
            startLine: startLine,
            endLine: endLine,
            offset: item.offset || 0,
            length: item.length || 0,
            calls: item.calls || [],
          };
        }),
      );

      logger.info(`Successfully parsed Kotlin file: ${filePath}`);
      return chunks;
    } catch (error) {
      let errorMessage = `Error parsing Kotlin file ${filePath}: `;
      if (error instanceof Error) {
        if (error.message.includes('Command failed with code')) {
          errorMessage += `CLI tool execution failed. ${error.message}`;
        } else if (error.message.includes('Command execution error')) {
          errorMessage += `CLI tool could not be executed. ${error.message}`;
        } else if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
          errorMessage += `Invalid JSON output from CLI tool. ${error.message}`;
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += String(error);
      }
      logger.error(errorMessage);
      return []; // エラーが発生した場合は空の配列を返す
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
}
