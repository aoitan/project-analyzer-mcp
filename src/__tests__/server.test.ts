import { createMcpServer } from '../server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { vi } from 'vitest';
import { AnalysisService } from '../analysisService.js'; // AnalysisService をインポート

// McpServer の registerTool メソッドの呼び出しを記録するためのモック
const mockRegisteredTools: any[] = [];
const mockRegisterTool = vi.fn((name, config, callback) => {
  mockRegisteredTools.push({ name, config, callback });
});

// McpServer クラス全体をモック
// McpServer は登録されたツールを直接取得する公開された getTools() メソッドを持たないため、
// テストのためにモックされた getTools() を提供し、registerTool の呼び出しを記録します。
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: mockRegisterTool,
    // テストが getTools() を呼び出すため、モックされた getTools() を提供します。
    // これは mockRegisteredTools の内容を返します。
    getTools: vi.fn(() => mockRegisteredTools),
  })),
}));

// AnalysisService をモック
vi.mock('../analysisService.js', () => ({
  AnalysisService: vi.fn().mockImplementation(() => ({
    analyzeProject: vi.fn(async (projectPath: string) => {
      // analyzeProject が呼ばれたときに、ダミーのチャンクを保存したかのように振る舞う
      // 実際にはファイルシステム操作は行わない
      console.log(`Mock AnalysisService: Analyzing project: ${projectPath}`);
    }),
    getChunk: vi.fn(async (chunkId: string) => {
      // getChunk が呼ばれたときに、ダミーのチャンクを返す
      if (chunkId === 'func dummyFunction1(param:) -> Int') {
        return { content: 'func dummyFunction1(param: String) -> Int {\n    return 1\n}' };
      }
      return null;
    }),
    listFunctionsInFile: vi.fn(async (filePath: string) => {
      // listFunctionsInFile が呼ばれたときに、ダミーの関数リストを返す
      if (filePath === '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift') {
        return [
          {
            id: 'func dummyFunction1(param:) -> Int',
            signature: 'func dummyFunction1(param:) -> Int',
          },
          { id: 'func dummyFunction2()', signature: 'func dummyFunction2()' },
        ];
      }
      return [];
    }),
    getFunctionChunk: vi.fn(async (filePath: string, functionSignature: string) => {
      // getFunctionChunk が呼ばれたときに、ダミーの関数チャンクを返す
      if (
        filePath === '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift' &&
        functionSignature === 'func dummyFunction1(param:) -> Int'
      ) {
        return { content: 'func dummyFunction1(param: String) -> Int {\n    return 1\n}' };
      }
      return null;
    }),
    findFiles: vi.fn(async (pattern: string) => {
      // findFiles が呼ばれたときに、ダミーのファイルリストを返す
      if (pattern === 'src/__tests__/dummy.swift') {
        return ['/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift'];
      }
      return [];
    }),
    findFunctions: vi.fn(async (filePath: string, functionQuery: string) => {
      // findFunctions が呼ばれたときに、ダミーの関数リストを返す
      if (
        filePath === '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift' &&
        functionQuery === 'dummyFunction1'
      ) {
        return [
          {
            id: 'func dummyFunction1(param:) -> Int',
            signature: 'func dummyFunction1(param:) -> Int',
          },
        ];
      }
      return [];
    }),
  })),
}));

describe('MCP Server Tools', () => {
  // tools 変数に対するテストは、createMcpServer 関数が期待通りに McpServer インスタンスを初期化し、
  // そのインスタンスが正しくツールを登録していることを検証するために行われます。
  // McpServer の getTools() メソッドは公開されていないため、モックされた getTools() を通じて
  // 登録されたツールの情報を間接的に検証しています。
  let server: McpServer;
  let tools: any[];

  beforeEach(() => {
    // 各テストの前にモックの状態をクリア
    mockRegisteredTools.length = 0; // 配列をクリア
    mockRegisterTool.mockClear();

    server = createMcpServer();
    // McpServer の getTools メソッドは公開されていないため、モックされたものにアクセスします。
    tools = (server as any).getTools();
  });

  it('should have correct number of tool configurations', () => {
    expect(tools).toHaveLength(6);
  });

  it('should have find_file tool configuration', () => {
    const tool = tools.find((t) => t.name === 'find_file');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Find File');
  });

  it('should have find_function tool configuration', () => {
    const tool = tools.find((t) => t.name === 'find_function');
    expect(tool).toBeDefined();
    expect(tool?.config.title).toBe('Find Function');
  });

  it('find_file callback should return matching files', async () => {
    const tool = tools.find((t) => t.name === 'find_file');
    const result = await tool?.callback({ pattern: 'src/__tests__/dummy.swift' });
    expect(result.content[0].text).toContain(
      '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
    );
  });

  it('find_function callback should return matching functions', async () => {
    const tool = tools.find((t) => t.name === 'find_function');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionQuery: 'dummyFunction1',
    });
    expect(result.content[0].text).toContain('func dummyFunction1(param:) -> Int');
  });

  it('list_functions_in_file callback should return dummy function signatures', async () => {
    const tool = tools.find((t) => t.name === 'list_functions_in_file');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
    });
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              description: `/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift に含まれる関数の一覧です。2 個の関数が見つかりました。`,
              suggested_actions: [
                `get_function_chunk: 特定の関数のコードを取得する`,
                `find_function: このファイル内で特定の関数を検索する`,
              ],
              follow_up_questions: [
                `どの関数のコードを見たいですか?`,
                `このファイル内で特定の関数を検索しますか?`,
              ],
              data: {
                filePath: `/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift`,
                functions: [
                  {
                    id: 'func dummyFunction1(param:) -> Int',
                    signature: 'func dummyFunction1(param:) -> Int',
                  },
                  { id: 'func dummyFunction2()', signature: 'func dummyFunction2()' },
                ],
              },
            },
            null,
            2,
          ),
        },
      ],
    });
  });

  it('get_function_chunk callback should return dummy function chunk content', async () => {
    const tool = tools.find((t) => t.name === 'get_function_chunk');
    const analyzeTool = tools.find((t) => t.name === 'analyze_project');
    // analyzeTool の callback は AnalysisService のインスタンスに依存するため、
    // ここでは AnalysisService もモックする必要があります。
    // ただし、今回の修正範囲外なので、ここでは単純にモックされた callback を呼び出す形にします。
    // 実際のテストでは、AnalysisService のモックも適切に設定する必要があります。
    await analyzeTool?.callback({
      projectPath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/',
    });

    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionSignature: 'func dummyFunction1(param:) -> Int',
    });
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              description: `/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift にある func dummyFunction1(param:) -> Int 関数のコードチャンクです。`,
              suggested_actions: [
                `analyze_dependencies: この関数の依存関係を解析する`,
                `get_dependencies: この関数の呼び出し元や呼び出し先を調べる`,
              ],
              follow_up_questions: [
                `この関数について他に知りたいことはありますか?`,
                `この関数の依存関係を調べますか?`,
              ],
              data: {
                filePath: `/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift`,
                functionSignature: `func dummyFunction1(param:) -> Int`,
                codeContent: `func dummyFunction1(param: String) -> Int {\n    return 1\n}`,
              },
            },
            null,
            2,
          ),
        },
      ],
    });
  });

  it('get_function_chunk callback should return null for non-existent function in existing file', async () => {
    const tool = tools.find((t) => t.name === 'get_function_chunk');
    const result = await tool?.callback({
      filePath: '/Users/ma-yabushita/00_work/study/ai/toy/src/__tests__/dummy.swift',
      functionSignature: 'func nonExistentFunction()',
    });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Function chunk not found.' }],
      isError: true,
    });
  });
});
