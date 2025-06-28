import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AnalysisService } from './analysisService.js';
import { z } from 'zod';

// Define tool configurations
export function createMcpServer() {
  const server = new McpServer({
    name: 'mcp-code-analysis-server',
    version: '1.0.0',
  });

  const analysisService = new AnalysisService('./data/chunks');

  const tools = [
    {
      name: 'analyze_project',
      config: {
        title: 'Analyze Project',
        description: 'Analyzes a project and extracts code chunks.',
        inputSchema: z.object({
          projectPath: z.string().describe('The path to the project to analyze.'),
        }).shape,
      },
      callback: async (args: any) => {
        await analysisService.analyzeProject(args.projectPath);
        return { content: [{ type: 'text', text: 'Project analysis completed.', _meta: {} }] };
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
      callback: async (args: any) => {
        const chunk = await analysisService.getChunk(args.chunkId);
        if (chunk) {
          return { content: [{ type: 'text', text: chunk.content, _meta: {} }] };
        } else {
          return {
            content: [{ type: 'text', text: 'Chunk not found.', _meta: {} }],
            isError: true,
          };
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
      callback: async (args: any) => {
        const functions = await analysisService.listFunctionsInFile(args.filePath);
        return { content: [{ type: 'text', text: JSON.stringify(functions, null, 2), _meta: {} }] };
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
      callback: async (args: any) => {
        const content = await analysisService.getFunctionChunk(
          args.filePath,
          args.functionSignature,
        );
        if (content) {
          return { content: [{ type: 'text', text: content.content, _meta: {} }] };
        } else {
          return {
            content: [{ type: 'text', text: 'Function chunk not found.', _meta: {} }],
            isError: true,
          };
        }
      },
    },
    {
      name: 'find_file',
      config: {
        title: 'Find File',
        description: 'Finds files matching a given pattern.',
        inputSchema: z.object({
          pattern: z
            .string()
            .describe('The pattern to search for (e.g., *.swift, src/**/*.swift).'),
        }).shape,
      },
      callback: async (args: any) => {
        const files = await analysisService.findFiles(args.pattern);
        return { content: [{ type: 'text', text: JSON.stringify(files, null, 2), _meta: {} }] };
      },
    },
    {
      name: 'find_function',
      config: {
        title: 'Find Function',
        description: 'Finds functions matching a query in a given file.',
        inputSchema: z.object({
          filePath: z.string().describe('The absolute path to the source file.'),
          functionQuery: z
            .string()
            .describe('The function name or partial signature to search for.'),
        }).shape,
      },
      callback: async (args: any) => {
        const functions = await analysisService.findFunctions(args.filePath, args.functionQuery);
        return { content: [{ type: 'text', text: JSON.stringify(functions, null, 2), _meta: {} }] };
      },
    },
  ];

  tools.forEach((tool) => {
    server.registerTool(tool.name, tool.config as any, tool.callback);
  });

  // Add a method to get registered tools for testing
  (server as any).getTools = () => tools;

  return server;
}
