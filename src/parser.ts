import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execPromise = promisify(exec);

interface CodeChunk {
  name: string;
  type: string;
  signature: string; // Full function signature
  id: string; // Unique ID for the chunk
  content: string; // The actual code content of the chunk
  startLine: number;
  endLine: number;
  bodyOffset: number; // Byte offset of the function body
  bodyLength: number; // Byte length of the function body
}

export class SwiftParser {
  async parseFile(filePath: string): Promise<CodeChunk[]> {
    console.log(`Parsing Swift file: ${filePath} using SourceKitten`);
    try {
      const { stdout } = await execPromise(`sourcekitten structure --file ${filePath}`);
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
          const startLine = item['key.offset']
            ? await this.getLineNumber(filePath, item['key.offset'])
            : 0;
          const endLine =
            item['key.offset'] && item['key.length']
              ? await this.getLineNumber(filePath, item['key.offset'] + item['key.length'])
              : 0;

          let signature = item['key.name'] || '';
          if (item['key.typename']) {
            signature = `func ${signature} -> ${item['key.typename']}`;
          } else {
            signature = `func ${signature}`;
          }

          return {
            name: item['key.name'],
            type: item['key.kind'],
            signature: signature,
            id: signature,
            content: '',
            startLine: startLine,
            endLine: endLine,
            bodyOffset: item['key.bodyoffset'] || 0,
            bodyLength: item['key.bodylength'] || 0,
          };
        }),
      );
      return functions;
    } catch (error) {
      console.error(`Error parsing Swift file with SourceKitten: ${error}`);
      return [];
    }
  }

  private async getLineNumber(filePath: string, offset: number): Promise<number> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    let lineNumber = 1;
    for (let i = 0; i < offset; i++) {
      if (fileContent[i] === '\n') {
        lineNumber++;
      }
    }
    return lineNumber;
  }

  async getFunctionContent(filePath: string, functionSignature: string): Promise<string | null> {
    console.log(`Getting content for function: ${functionSignature} in file: ${filePath}`);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const functions = await this.parseFile(filePath);
      const targetFunction = functions.find((func) => func.signature === functionSignature);

      if (
        targetFunction &&
        targetFunction.bodyOffset !== undefined &&
        targetFunction.bodyLength !== undefined
      ) {
        const bodyContent = fileContent
          .substring(
            targetFunction.bodyOffset,
            targetFunction.bodyOffset + targetFunction.bodyLength,
          )
          .trim();
        return bodyContent;
      }
      return null;
    } catch (error) {
      console.error(`Error getting function content: ${error}`);
      return null;
    }
  }
}
