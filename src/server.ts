import * as path from 'path';
import { z } from 'zod';
const { McpServer, defineTool } = require('@modelcontextprotocol/sdk');
import { analyzeAndStoreProject, getChunkFromStore } from './analysisService';

// 安全なベースディレクトリを定義
const SAFE_BASE_DIR = path.resolve(__dirname, './');

export const analyzeProjectTool = defineTool({
    name: 'analyze_project',
    description: 'Analyzes a Swift file to extract code chunks.',
    input: z.object({
        projectPath: z.string().describe('The relative path to the project directory.'),
        targetFile: z.string().describe('The target Swift file to analyze.'),
    }),
    handler: async ({ projectPath, targetFile }: { projectPath: string; targetFile: string }) => {
        const resolvedProjectPath = path.resolve(SAFE_BASE_DIR, projectPath);
        if (!resolvedProjectPath.startsWith(SAFE_BASE_DIR)) {
            throw new Error('Invalid project path: Path traversal is not allowed.');
        }

        const fullFilePath = path.join(resolvedProjectPath, targetFile);
        if (!path.resolve(fullFilePath).startsWith(resolvedProjectPath)) {
            throw new Error('Invalid target file path.');
        }

        return analyzeAndStoreProject(fullFilePath, projectPath);
    },
});

export const getChunkTool = defineTool({
    name: 'get_chunk',
    description: 'Retrieves a specific code chunk from an analyzed project.',
    input: z.object({
        projectPath: z.string().describe('The relative path to the analyzed project directory.'),
        chunkId: z.string().describe('The ID of the chunk to retrieve.'),
    }),
    handler: async ({ projectPath, chunkId }: { projectPath: string; chunkId: string }) => {
        const targetChunk = getChunkFromStore(projectPath, chunkId);

        if (!targetChunk) {
            throw new Error(`Chunk with ID ${chunkId} not found in project ${projectPath}. Or the project has not been analyzed.`);
        }

        console.log(`[INFO] Providing chunk: ${chunkId}`);
        return {
            chunkId: targetChunk.id,
            code: targetChunk.content,
            context: {
                name: targetChunk.name,
                type: targetChunk.type,
                filePath: targetChunk.filePath,
                startLine: targetChunk.startLine,
                endLine: targetChunk.endLine,
                calls: targetChunk.calls,
            }
        };
    },
});

const server = new McpServer({
    tools: [analyzeProjectTool, getChunkTool],
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
});

server.listen().then(() => {
    console.log(`MCP Server running on http://localhost:${server.port}`);
    console.log('Available tools: analyze_project, get_chunk');
});
