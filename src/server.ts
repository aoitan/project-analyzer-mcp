import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AnalysisService } from './analysisService.js';
import { z } from 'zod';

const analysisService = new AnalysisService('./data/chunks');

// Define tool configurations
export const toolConfigurations: {
  name: string;
  config: { title: string; description: string; inputSchema: z.ZodRawShape };
  callback: (...args: any[]) => Promise<any>;
}[] = [
  {
    name: 'analyze_project',
    config: {
      title: 'Analyze Project',
      description: 'Analyzes a project and extracts code chunks.',
      inputSchema: z.object({
        projectPath: z.string().describe('The path to the project to analyze.'),
      }).shape,
    },
    callback: async (input: { projectPath: string }) => {
      await analysisService.analyzeProject(input.projectPath);
      return { content: [{ type: 'text', text: 'Project analysis completed.' }] };
    },
  },
  {
    name: 'get_chunk',
    config: {
      title: 'Get Code Chunk',
      description: 'Retrieves a specific code chunk.',
      inputSchema: z.object({
        chunkId: z.string().describe('The ID of the code chunk to retrieve.'),
      }).shape,
    },
    callback: async (input: { chunkId: string }) => {
      const chunk = await analysisService.getChunk(input.chunkId);
      if (chunk) {
        return { content: [{ type: 'text', text: chunk.content }] };
      } else {
        return { content: [{ type: 'text', text: 'Chunk not found.' }], isError: true };
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
      }).shape,
    },
    callback: async (input: { filePath: string }) => {
      const functions = await analysisService.listFunctionsInFile(input.filePath);
      return { content: [{ type: 'text', text: JSON.stringify(functions, null, 2) }] };
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
      }).shape,
    },
    callback: async (input: { filePath: string; functionSignature: string }) => {
      const content = await analysisService.getFunctionChunk(
        input.filePath,
        input.functionSignature,
      );
      if (content) {
        return { content: [{ type: 'text', text: content.content }] };
      } else {
        return { content: [{ type: 'text', text: 'Function chunk not found.' }], isError: true };
      }
    },
  },
  {
    name: 'find_file',
    config: {
      title: 'Find File',
      description: 'Finds files matching a given pattern.',
      inputSchema: z.object({
        pattern: z.string().describe('The pattern to search for (e.g., *.swift, src/**/*.swift).'),
      }).shape,
    },
    callback: async (input: { pattern: string }) => {
      const files = await analysisService.findFiles(input.pattern);
      return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] };
    },
  },
  {
    name: 'find_function',
    config: {
      title: 'Find Function',
      description: 'Finds functions matching a query in a given file.',
      inputSchema: z.object({
        filePath: z.string().describe('The absolute path to the source file.'),
        functionQuery: z.string().describe('The function name or partial signature to search for.'),
      }).shape,
    },
    callback: async (input: { filePath: string; functionQuery: string }) => {
      const functions = await analysisService.findFunctions(input.filePath, input.functionQuery);
      return { content: [{ type: 'text', text: JSON.stringify(functions, null, 2) }] };
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
