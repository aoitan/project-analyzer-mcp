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

  server.registerTool(
    'analyze_project',
    {
      title: 'Analyze Project',
      description: 'Analyzes a project and extracts code chunks.',
      inputSchema: {
        projectPath: z.string().describe('The path to the project to analyze.'),
      },
    },
    async ({ projectPath }) => {
      await analysisService.analyzeProject(projectPath);
      return { content: [{ type: 'text', text: 'Project analysis completed.' }] };
    },
  );
  server.registerTool(
    'get_chunk',
    {
      title: 'Get Code Chunk',
      description: 'Retrieves a specific code chunk.',
      inputSchema: {
        chunkId: z.string().describe('The ID of the code chunk to retrieve.'),
      },
    },
    async ({ chunkId }) => {
      const chunk = await analysisService.getChunk(chunkId);
      if (chunk) {
        return { content: [{ type: 'text', text: chunk.content }] };
      } else {
        return {
          content: [{ type: 'text', text: 'Chunk not found.' }],
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    'list_functions_in_file',
    {
      title: 'List Functions in File',
      description: 'Returns a list of functions found in the specified source file.',
      inputSchema: {
        filePath: z.string().describe('The absolute path to the source file.'),
      },
    },
    async ({ filePath }) => {
      try {
        const functions = await analysisService.listFunctionsInFile(filePath);
        return { content: [{ type: 'text', text: JSON.stringify(functions, null, 2) }] };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    'get_function_chunk',
    {
      title: 'Get Function Code Chunk',
      description: 'Returns the code chunk for a specific function in a source file.',
      inputSchema: {
        filePath: z.string().describe('The absolute path to the source file.'),
        functionSignature: z.string().describe('The signature of the function to retrieve.'),
      },
    },
    async ({ filePath, functionSignature }) => {
      try {
        const content = await analysisService.getFunctionChunk(filePath, functionSignature);
        if (content) {
          return { content: [{ type: 'text', text: content.content }] };
        } else {
          return {
            content: [{ type: 'text', text: 'Function chunk not found.' }],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
  server.registerTool(
    'find_file',
    {
      title: 'Find File',
      description: 'Finds files matching a given pattern.',
      inputSchema: {
        pattern: z.string().describe('The pattern to search for (e.g., *.swift, src/**/*.swift).'),
      },
    },
    async ({ pattern }) => {
      const files = await analysisService.findFiles(pattern);
      return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] };
    },
  );
  server.registerTool(
    'find_function',
    {
      title: 'Find Function',
      description: 'Finds functions matching a query in a given file.',
      inputSchema: {
        filePath: z.string().describe('The absolute path to the source file.'),
        functionQuery: z.string().describe('The function name or partial signature to search for.'),
      },
    },
    async ({ filePath, functionQuery }) => {
      const functions = await analysisService.findFunctions(filePath, functionQuery);
      return { content: [{ type: 'text', text: JSON.stringify(functions, null, 2) }] };
    },
  );

  return server;
}
