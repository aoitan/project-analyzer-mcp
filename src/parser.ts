// src/parser.ts
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CodeChunk, SimpleDependencyGraph, SourceKittenStructure } from './types';

const execPromise = promisify(exec);

/**
 * Executes the SourceKitten command on a given Swift file.
 * @param filePath The absolute path to the Swift file.
 * @returns The parsed JSON output from SourceKitten.
 */
export async function runSourceKitten(filePath: string): Promise<SourceKittenStructure> {
    const SDK_PATH = process.env.SWIFT_SDK_PATH || `$(xcrun --show-sdk-path --sdk macosx)`;
    const TARGET = process.env.SWIFT_TARGET || 'x86_64-apple-macosx14.0';
    const command = `sourcekitten structure --file ${filePath} -- -sdk ${SDK_PATH} -target ${TARGET}`;

    try {
        const { stdout } = await execPromise(command);
        return JSON.parse(stdout);
    } catch (error: any) {
        if (error.stderr && error.stderr.includes('sourcekitten: command not found')) {
            console.error('Error: SourceKitten command not found.');
            console.error('Please install SourceKitten. On macOS with Homebrew, run: brew install sourcekitten');
        } else {
            console.error('Error executing SourceKitten:', error.message);
            console.error('Stderr:', error.stderr);
        }
        throw error;
    }
}

/**
 * Transforms the SourceKitten JSON structure into a simplified dependency graph.
 * @param structure The SourceKitten output structure.
 * @param fileContent The content of the source file.
 * @param filePath The path to the source file.
 * @returns A SimpleDependencyGraph object.
 */
export function transformStructureToChunks(structure: SourceKittenStructure, fileContent: string, filePath: string): SimpleDependencyGraph {
    const chunks: SimpleDependencyGraph = {};
    const fileName = path.basename(filePath);

    function extractEntities(subStructure: SourceKittenStructure): void {
        if (!subStructure.substructure) return;

        for (const sub of subStructure.substructure) {
            const { kind, name, offset, length, line } = sub;

            if (name && offset !== undefined && length !== undefined && line !== undefined &&
                (kind.startsWith('source.lang.swift.decl.function.') ||
                 kind.startsWith('source.lang.swift.decl.class') ||
                 kind.startsWith('source.lang.swift.decl.struct'))) {

                const chunkId = `${fileName}_${name}_${line}`;
                const content = fileContent.substring(offset, offset + length);
                const endLine = fileContent.substring(0, offset + length).split('\n').length;
                
                const calls: string[] = [];
                if (kind.startsWith('source.lang.swift.decl.function.')) {
                    const callRegex = /\b([a-zA-Z0-9_]+)\s*\(/g;
                    let callMatch;
                    while ((callMatch = callRegex.exec(content)) !== null) {
                        const calledName = callMatch[1];
                        if (calledName !== name && !['if', 'for', 'while', 'switch', 'return', 'let', 'var', 'guard', 'do', 'try', 'print'].includes(calledName)) {
                            calls.push(calledName);
                        }
                    }
                }

                let entityType: CodeChunk['type'] = 'var'; // Default
                if (kind.includes('function')) entityType = 'function';
                else if (kind.includes('method')) entityType = 'method';
                else if (kind.includes('class')) entityType = 'class';
                else if (kind.includes('struct')) entityType = 'struct';

                chunks[chunkId] = {
                    id: chunkId,
                    name: name,
                    type: entityType,
                    content: content,
                    filePath: filePath,
                    startLine: line,
                    endLine: endLine,
                    byteOffset: offset,
                    byteLength: length,
                    calls: Array.from(new Set(calls))
                };
            }
            extractEntities(sub);
        }
    }

    extractEntities(structure);
    return chunks;
}

/**
 * Parses a Swift file using SourceKitten and returns a simplified dependency graph.
 * @param filePath The absolute path to the Swift file to analyze.
 * @returns A SimpleDependencyGraph object.
 */
export async function parseSwiftFileWithSourceKitten(filePath: string): Promise<SimpleDependencyGraph> {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const sourceKittenOutput = await runSourceKitten(filePath);
    return transformStructureToChunks(sourceKittenOutput, fileContent, filePath);
}
