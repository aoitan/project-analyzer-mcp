import { spawn } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import logger from './utils/logger.js';
import { IParser, CodeChunk } from './interfaces/parser.js';

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
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
};

export class SwiftParser implements IParser {
  private exec: ExecFunction;
  private readFile: ReadFileFunction;

  constructor(exec: ExecFunction = defaultExec, readFile: ReadFileFunction = fsp.readFile) {
    this.exec = exec;
    this.readFile = readFile;
  }

  async parseFile(filePath: string): Promise<CodeChunk[]> {
    try {
      const { stdout } = await this.exec('sourcekitten', ['structure', '--file', filePath]);
      logger.info(`Successfully parsed file: ${filePath}`);

      const sourceKittenOutput = JSON.parse(stdout);
      const fileContentBuffer = await this.readFile(filePath);

      const getLineNumber = (offset: number): number => {
        // バイトオフセットから行番号を計算するために、その位置までの内容を文字列化
        const textBeforeOffset = fileContentBuffer.toString('utf8', 0, offset);
        return textBeforeOffset.split('\n').length;
      };

      const processStructure = async (item: any): Promise<CodeChunk[]> => {
        const kind = item['key.kind'] || '';
        const isFunction = kind.startsWith('source.lang.swift.decl.function');
        const isClassOrSimilar =
          kind === 'source.lang.swift.decl.class' ||
          kind === 'source.lang.swift.decl.struct' ||
          kind === 'source.lang.swift.decl.enum' ||
          kind === 'source.lang.swift.decl.protocol';
        const isProperty =
          kind === 'source.lang.swift.decl.var.instance' ||
          kind === 'source.lang.swift.decl.var.static' ||
          kind === 'source.lang.swift.decl.var.global' ||
          kind === 'source.lang.swift.decl.var.local';

        const children: CodeChunk[] = [];
        if (item['key.substructure']) {
          for (const subItem of item['key.substructure']) {
            const childChunks = await processStructure(subItem);
            children.push(...childChunks);
          }
        }

        if (!isFunction && !isClassOrSimilar && !isProperty) {
          return children;
        }

        const offset = item['key.offset'] || 0;
        const length = item['key.length'] || 0;
        const startLine = getLineNumber(offset);
        const endLine = getLineNumber(offset + length);

        let signature = item['key.name'] || '';
        if (isFunction) {
          if (item['key.typename']) {
            signature = `func ${signature} -> ${item['key.typename']}`;
          } else {
            signature = `func ${signature}`;
          }
        } else if (isClassOrSimilar) {
          const typeMap: { [key: string]: string } = {
            'source.lang.swift.decl.class': 'class',
            'source.lang.swift.decl.struct': 'struct',
            'source.lang.swift.decl.enum': 'enum',
            'source.lang.swift.decl.protocol': 'protocol',
          };
          signature = `${typeMap[kind] || ''} ${signature}`;
        } else if (isProperty) {
          signature = `var ${signature}${item['key.typename'] ? `: ${item['key.typename']}` : ''}`;
        }

        const content = fileContentBuffer.toString('utf8', offset, offset + length);

        const superTypes: string[] = [];
        const interfaces: string[] = [];
        if (item['key.inheritedtypes']) {
          for (const inherited of item['key.inheritedtypes']) {
            const name = inherited['key.name'];
            if (name) {
              if (kind === 'source.lang.swift.decl.class' && superTypes.length === 0) {
                superTypes.push(name);
              } else {
                interfaces.push(name);
              }
            }
          }
        }

        const properties: { name: string; type: string }[] = [];
        if (item['key.substructure']) {
          for (const subItem of item['key.substructure']) {
            if (
              subItem['key.kind'] === 'source.lang.swift.decl.var.instance' ||
              subItem['key.kind'] === 'source.lang.swift.decl.var.static'
            ) {
              properties.push({
                name: subItem['key.name'] || '',
                type: subItem['key.typename'] || '',
              });
            }
          }
        }

        return [
          {
            name: item['key.name'] || '',
            type: kind,
            signature: signature,
            id: `${filePath}:${signature}:${offset}`,
            content: content,
            filePath: filePath,
            startLine: startLine,
            endLine: endLine,
            offset: offset,
            length: length,
            calls: [],
            superTypes: superTypes,
            interfaces: interfaces,
            properties: properties,
            children: children,
          },
        ];
      };

      const allChunks: CodeChunk[] = [];
      if (sourceKittenOutput['key.substructure']) {
        for (const item of sourceKittenOutput['key.substructure']) {
          const itemChunks = await processStructure(item);
          allChunks.push(...itemChunks);
        }
      }

      return allChunks;
    } catch (error) {
      logger.error(`Error parsing file ${filePath}: ${error}`);
      return [];
    }
  }

  /**
   * 特定の関数の完全なコード内容を取得する。
   */
  async getFunctionContent(filePath: string, targetFunction: CodeChunk): Promise<string | null> {
    try {
      const { stdout } = await this.exec('sourcekitten', ['structure', '--file', filePath]);
      const sourceKittenOutput = JSON.parse(stdout);
      const fileContentBuffer = await this.readFile(filePath);

      // 指定されたシグネチャに一致する項目を探す
      const findTarget = (items: any[]): any => {
        for (const item of items) {
          let signature = item['key.name'] || '';
          const kind = item['key.kind'] || '';
          if (kind.startsWith('source.lang.swift.decl.function')) {
            if (item['key.typename']) {
              signature = `func ${signature} -> ${item['key.typename']}`;
            } else {
              signature = `func ${signature}`;
            }
          } else if (
            kind === 'source.lang.swift.decl.class' ||
            kind === 'source.lang.swift.decl.struct' ||
            kind === 'source.lang.swift.decl.enum' ||
            kind === 'source.lang.swift.decl.protocol'
          ) {
            const typeMap: { [key: string]: string } = {
              'source.lang.swift.decl.class': 'class',
              'source.lang.swift.decl.struct': 'struct',
              'source.lang.swift.decl.enum': 'enum',
              'source.lang.swift.decl.protocol': 'protocol',
            };
            signature = `${typeMap[kind] || ''} ${signature}`;
          } else if (
            kind === 'source.lang.swift.decl.var.instance' ||
            kind === 'source.lang.swift.decl.var.static'
          ) {
            signature = `var ${signature}${item['key.typename'] ? `: ${item['key.typename']}` : ''}`;
          }

          if (signature === targetFunction.id) {
            return item;
          }
          if (item['key.substructure']) {
            const result = findTarget(item['key.substructure']);
            if (result) return result;
          }
        }
        return null;
      };

      const foundItem = findTarget(sourceKittenOutput['key.substructure'] || []);

      if (foundItem) {
        const offset = foundItem['key.offset'] || 0;
        const length = foundItem['key.length'] || 0;
        return fileContentBuffer.toString('utf8', offset, offset + length).trim();
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
