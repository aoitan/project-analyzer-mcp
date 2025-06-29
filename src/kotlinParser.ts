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
    try {
      // 実際には kotlin-language-server などを呼び出す
      const { stdout } = await this.exec('kotlin-language-server', ['--file', filePath]);
      const parsedOutput = JSON.parse(stdout);

      // ここでは、kotlin-language-server の出力形式を CodeChunk に変換するロジックを実装します。
      // 今回はダミーの変換ロジックとします。
      const chunks: CodeChunk[] = parsedOutput.map((item: any) => ({
        id: item.id || item.name,
        name: item.name,
        signature: item.signature,
        type: item.type,
        content: item.content,
        filePath: filePath,
        startLine: item.startLine,
        endLine: item.endLine,
        offset: item.offset,
        length: item.length,
        calls: item.calls || [],
      }));

      logger.info(`Successfully parsed Kotlin file: ${filePath}`);
      return chunks;
    } catch (error) {
      logger.error(`Error parsing Kotlin file ${filePath}: ${error}`);
      return [];
    }
  }
}
