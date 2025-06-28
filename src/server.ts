import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AnalysisService } from './analysisService';
import { z } from 'zod';

const analysisService = new AnalysisService();

// Define tool configurations
export const toolConfigurations = [
  {
    name: 'analyze_project',
    config: {
      title: 'Analyze Project',
      description: 'Analyzes a project and extracts code chunks.',
      inputSchema: z.object({
        projectPath: z.string().describe('The path to the project to analyze.'),
      }),
    },
    callback: async (input: { projectPath: string }) => {
      await analysisService.analyzeProject(input.projectPath);
      return { status: 'success', message: 'Project analysis completed.' };
    },
  },
  {
    name: 'get_chunk',
    config: {
      title: 'Get Code Chunk',
      description: 'Retrieves a specific code chunk.',
      inputSchema: z.object({
        chunkId: z.string().describe('The ID of the code chunk to retrieve.'),
      }),
    },
    callback: async (input: { chunkId: string }) => {
      const chunk = await analysisService.getChunk(input.chunkId);
      if (chunk) {
        return { status: 'success', chunk: chunk.content };
      } else {
        return { status: 'error', message: 'Chunk not found.' };
      }
    },
  },
  {
    name: 'list_functions_in_file',
    config: {
      title: 'List Functions in File',
      description: 'Returns a list of functions found in the specified source file.',
      inputSchema: z.object({
        filePath: z.string().describe('The absolute path to the source file.'),
      }),
    },
    callback: async (input: { filePath: string }) => {
      return analysisService.listFunctionsInFile(input.filePath);
    },
  },
  {
    name: 'get_function_chunk',
    config: {
      title: 'Get Function Code Chunk',
      description: 'Returns the code chunk for a specific function in a source file.',
      inputSchema: z.object({
        filePath: z.string().describe('The absolute path to the source file.'),
        functionSignature: z.string().describe('The signature of the function to retrieve.'),
      }),
    },
    callback: async (input: { filePath: string; functionSignature: string }) => {
      return analysisService.getFunctionChunk(input.filePath, input.functionSignature);
    },
  },
];

export function createMcpServer() {
  const server = new McpServer({
    name: 'mcp-code-analysis-server',
    version: '1.0.0',
  });

  toolConfigurations.forEach((tool) => {
    server.registerTool(tool.name, tool.config, tool.callback);
  });

  return server;
}
