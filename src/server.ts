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
      const responseContent = {
        description: `プロジェクトの解析が完了しました。${projectPath} にあるファイルが解析され、コードチャンクが抽出されました。`,
        suggested_actions: [
          `list_functions_in_file: 特定のファイルに含まれる関数の一覧を取得する`,
          `find_file: 特定のパターンに一致するファイルを探す`,
          `get_chunk: 特定のチャンクIDのコードを取得する`,
        ],
        follow_up_questions: [
          `どのファイルの関数リストを見たいですか?`,
          `特定のファイルを探しますか?`,
          `特定のチャンクIDのコードを見たいですか?`,
        ],
        data: {
          projectPath: projectPath,
        },
      };
      return { content: [{ type: 'text', text: JSON.stringify(responseContent, null, 2) }] };
    },
  );
  server.registerTool(
    'get_chunk',
    {
      title: 'Get Code Chunk',
      description: 'Retrieves a specific code chunk.',
      inputSchema: {
        chunkId: z.string().describe('The ID of the code chunk to retrieve.'),
        pageSize: z.number().optional().describe('The number of lines per page.'),
        pageToken: z.string().optional().describe('The token for the next page.'),
      },
    },
    async ({ chunkId, pageSize, pageToken }) => {
      const chunk = await analysisService.getChunk(chunkId, pageSize, pageToken);
      if (chunk) {
        let textContent = chunk.codeContent;
        let description = `チャンクID ${chunkId} のコードチャンクです。`;

        if (chunk.message) {
          description = chunk.message + textContent;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  description,
                  codeContent: textContent,
                  isPartial: chunk.isPartial,
                  totalLines: chunk.totalLines,
                  currentPage: chunk.currentPage,
                  totalPages: chunk.totalPages,
                  nextPageToken: chunk.nextPageToken,
                  prevPageToken: chunk.prevPageToken,
                  startLine: chunk.startLine,
                  endLine: chunk.endLine,
                },
                null,
                2,
              ),
            },
          ],
        };
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
        const responseContent = {
          description: `${filePath} に含まれる関数の一覧です。${functions.length} 個の関数が見つかりました。`,
          suggested_actions: [
            `get_function_chunk: 特定の関数のコードを取得する`,
            `find_function: このファイル内で特定の関数を検索する`,
          ],
          follow_up_questions: [
            `どの関数のコードを見たいですか?`,
            `このファイル内で特定の関数を検索しますか?`,
          ],
          data: {
            filePath: filePath,
            functions: functions,
          },
        };
        return { content: [{ type: 'text', text: JSON.stringify(responseContent, null, 2) }] };
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
        pageSize: z.number().optional().describe('The number of lines per page.'),
        pageToken: z.string().optional().describe('The token for the next page.'),
      },
    },
    async ({ filePath, functionSignature, pageSize, pageToken }) => {
      try {
        const chunk = await analysisService.getFunctionChunk(
          filePath,
          functionSignature,
          pageSize,
          pageToken,
        );
        if (chunk) {
          let textContent = chunk.codeContent;
          let description = `${filePath} にある ${functionSignature} 関数のコードチャンクです。`;

          if (chunk.message) {
            description = chunk.message + textContent;
          }

          const responseContent = {
            description: description,
            suggested_actions: [
              `analyze_dependencies: この関数の依存関係を解析する`,
              `get_dependencies: この関数の呼び出し元や呼び出し先を調べる`,
            ],
            follow_up_questions: [
              `この関数について他に知りたいことはありますか?`,
              `この関数の依存関係を調べます?`,
            ],
            data: {
              filePath: filePath,
              functionSignature: functionSignature,
              codeContent: textContent,
              isPartial: chunk.isPartial,
              totalLines: chunk.totalLines,
              currentPage: chunk.currentPage,
              totalPages: chunk.totalPages,
              nextPageToken: chunk.nextPageToken,
              prevPageToken: chunk.prevPageToken,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
            },
          };
          return { content: [{ type: 'text', text: JSON.stringify(responseContent, null, 2) }] };
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
      return { content: [{ type: 'text', text: JSON.stringify({ items: files }, null, 2) }] };
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
      return { content: [{ type: 'text', text: JSON.stringify({ items: functions }, null, 2) }] };
    },
  );

  return server;
}
