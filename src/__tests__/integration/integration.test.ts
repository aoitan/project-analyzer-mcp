// src/__tests__/integration/integration.test.ts

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';

// __dirname の代替 (ES Modules対応)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PATH = path.resolve(__dirname, '../../../dist/index.js');
const CHUNKS_DIR = path.resolve(__dirname, '../../../data/chunks');
const TEST_PROJECT_DIR = path.resolve(__dirname, './test_project');

// ヘルパー関数: 文字列がJSONか判定する
function isJson(str: String): boolean {
  try {
    JSON.parse(str);
  } catch (_) {
    return false;
  }
  return true;
}

// ヘルパー関数: サーバープロセスを起動し、入出力を制御
async function startServer(): Promise<{
  serverProcess: ReturnType<typeof spawn>;
  responseMap: Map<string, string>; // Mapに変更
  stderrBuffer: string;
}> {
  const serverProcess = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr をパイプで接続
  });

  const responseMap = new Map<string, string>(); // Mapを初期化
  let stderrBuffer = '';

  // サーバーが起動するまで少し待つ (時間を増やす)
  await new Promise((resolve) => setTimeout(resolve, 3000)); // 3秒に増やす

  return { serverProcess, responseMap, stderrBuffer };
}

describe('MCP Server Integration Test', () => {
  let serverProcess: ReturnType<typeof spawn>;
  let responseMap: Map<string, string>; // Mapに変更
  let stderrBuffer: string;

  const onStdout = (data) => {
    const response = data.toString();
    console.log(`on data: ${response}\n`);

    if (!isJson(response)) {
      // JSONでなかったら読み捨て
      console.log(`skip non json`);
    } else {
      const parsedResponse = JSON.parse(response);
      if (parsedResponse.id) {
        responseMap.set(parsedResponse.id, response); // idをキーとして格納
        console.log(`Stored response for id: ${parsedResponse.id}`);
      } else {
        console.log(`Response has no id: ${response}`);
      }
    }
  };
  const onStderr = (data) => {
    stderrBuffer += data.toString();
    console.error(data.toString());
  };

  // 全てのテストの前に一度だけ実行
  beforeAll(async () => {
    // テストプロジェクトディレクトリの準備
    await fs.mkdir(TEST_PROJECT_DIR, { recursive: true });
    // テスト用のダミーファイルを作成
    await fs.writeFile(
      path.join(TEST_PROJECT_DIR, 'test.swift'),
      `
func mySwiftFunction(param: String) -> Int {
    return 1
}
`,
    );
    await fs.writeFile(
      path.join(TEST_PROJECT_DIR, 'test.kt'),
      `
fun myKotlinFunction(param: String): Int {
    return 2
}
`,
    );
    await fs.writeFile(
      path.join(TEST_PROJECT_DIR, 'test_complex.kt'),
      `
package com.example

class MyComplexClass(val name: String) {
    private var counter: Int = 0

    fun incrementCounter(): Int {
        counter++
        return counter
    }

    fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T> where T : Any {
        return items.filter(filter)
    }

    companion object {
        const val MAX_COUNT = 100
        fun create(name: String): MyComplexClass {
            return MyComplexClass(name)
        }
    }

    enum class Status { ACTIVE, INACTIVE }

    interface MyInterface {
        fun doSomething()
    }

    object MySingleton {
        fun getInstance() = "instance"
    }
}

fun topLevelFunction(value: String): String {
    return "Top: $value"
}
`,
    );
    await fs.writeFile(
      path.join(TEST_PROJECT_DIR, 'test_large_function.swift'),
      `func largeFunction() -> Void {
    // This is a large function for testing paging.
    // Line 1
    // Line 2
    // Line 3
    // Line 4
    // Line 5
    // Line 6
    // Line 7
    // Line 8
    // Line 9
    // Line 10
    // Line 11
    // Line 12
    // Line 13
    // Line 14
    // Line 15
    // Line 16
    // Line 17
    // Line 18
    // Line 19
    // Line 20
    // Line 21
    // Line 22
    // Line 23
    // Line 24
    // Line 25
    // Line 26
    // Line 27
    // Line 28
    // Line 29
    // Line 30
    // Line 31
    // Line 32
    // Line 33
    // Line 34
    // Line 35
    // Line 36
    // Line 37
    // Line 38
    // Line 39
    // Line 40
    // Line 41
    // Line 42
    // Line 43
    // Line 44
    // Line 45
    // Line 46
    // Line 47
    // Line 48
    // Line 49
    // Line 50
    // Line 51
    // Line 52
    // Line 53
    // Line 54
    // Line 55
    // Line 56
    // Line 57
    // Line 58
    // Line 59
    // Line 60
    // Line 61
    // Line 62
    // Line 63
    // Line 64
    // Line 65
    // Line 66
    // Line 67
    // Line 68
    // Line 69
    // Line 70
    // Line 71
    // Line 72
    // Line 73
    // Line 74
    // Line 75
    // Line 76
    // Line 77
    // Line 78
    // Line 79
    // Line 80
    // Line 81
    // Line 82
    // Line 83
    // Line 84
    // Line 85
    // Line 86
    // Line 87
    // Line 88
    // Line 89
    // Line 90
    // Line 91
    // Line 92
    // Line 93
    // Line 94
    // Line 95
    // Line 96
    // Line 97
    // Line 98
    // Line 99
    // Line 100
}
`,
    );

    // 既存のチャンクディレクトリをクリーンアップ
    await fs.rm(CHUNKS_DIR, { recursive: true, force: true });

    // サーバーを起動
    const { serverProcess: sp, responseMap: rm, stderrBuffer: esb } = await startServer();
    serverProcess = sp;
    responseMap = rm; // Mapを代入
    stderrBuffer = esb;

    serverProcess.stdout.on('data', onStdout);

    serverProcess.stderr.on('data', onStderr);

    // 起動完了を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // initializeメッセージを投げる
    const init = {
      jsonrpc: '2.0',
      id: 'initialize_1',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
          elicitation: {},
        },
        clientInfo: {
          name: 'ExampleClient',
          title: 'Example Client Display Name',
          version: '1.0.0',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(init)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 500));

    // analyze_projectメッセージを投げる
    const analyze_project = {
      jsonrpc: '2.0',
      id: 'analyze_project_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'analyze_project',
        arguments: {
          projectPath: TEST_PROJECT_DIR,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(analyze_project)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }, 30000);

  // 全てのテストの後に一度だけ実行
  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
    // テストプロジェクトディレクトリをクリーンアップ
    await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true });
    // チャンクディレクトリをクリーンアップ
    await fs.rm(CHUNKS_DIR, { recursive: true, force: true });
  });

  it('should respond to analyze_project tool call', async () => {
    const toolCall = {
      jsonrpc: '2.0',
      id: 'analyze_project_2', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'analyze_project',
        arguments: {
          projectPath: TEST_PROJECT_DIR,
        },
      },
    };

    serverProcess.stdin.write(JSON.stringify(toolCall) + '\n\n');

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get('analyze_project_2') || '{}'); // Mapから取得
    const parsedContent = JSON.parse(response.result.content[0].text);
    expect(parsedContent.data.projectPath).toEqual(TEST_PROJECT_DIR);
    expect(response.isError).toBeUndefined();

    // チャンクファイルが生成されたことを確認
    const swiftChunkPath = path.join(CHUNKS_DIR, 'func_mySwiftFunction_param___-__Int.json');
    const kotlinChunkPath = path.join(CHUNKS_DIR, 'fun_myKotlinFunction_param__String___Int.json');
    await expect(fs.access(swiftChunkPath)).resolves.toBeUndefined();
    await expect(fs.access(kotlinChunkPath)).resolves.toBeUndefined();
  }, 30000);

  it('should respond to list_functions_in_file tool call for Swift', async () => {
    const list_functions_in_file = {
      jsonrpc: '2.0',
      id: 'list_functions_swift_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'list_functions_in_file',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test.swift'),
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('list_functions_swift_1') || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text).data.functions;
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'func mySwiftFunction(param:) -> Int',
          signature: 'func mySwiftFunction(param:) -> Int',
        }),
      ]),
    );
  }, 3000);

  it('should respond to list_functions_in_file tool call for Kotlin', async () => {
    const list_functions_in_file = {
      jsonrpc: '2.0',
      id: 'list_functions_kotlin_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'list_functions_in_file',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test.kt'),
          language: 'kotlin',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get('list_functions_kotlin_1') || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text).data.functions;
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fun myKotlinFunction(param: String): Int', // Kotlinのシグネチャは変わる可能性あり
          signature: 'fun myKotlinFunction(param: String): Int',
        }),
      ]),
    );
  }, 6000);

  it('should respond to get_function_chunk tool call for complex Kotlin file', async () => {
    const get_function_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_kotlin_complex_1',
      method: 'tools/call',
      params: {
        name: 'get_function_chunk',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test_complex.kt'),
          functionSignature: 'fun incrementCounter(): Int',
          language: 'kotlin',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk)}\n\n`);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get('get_chunk_kotlin_complex_1') || '{}');
    expect(response.result.content[0].text).toContain('fun incrementCounter(): Int');
    expect(response.isError).toBeUndefined();
  }, 6000);

  it('should respond to find_function tool call for complex Kotlin file', async () => {
    const find_function = {
      jsonrpc: '2.0',
      id: 'find_function_kotlin_complex_1',
      method: 'tools/call',
      params: {
        name: 'find_function',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test_complex.kt'),
          functionQuery: 'processList',
          language: 'kotlin',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(find_function)}\n\n`);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get('find_function_kotlin_complex_1') || '{}');
    const functions = JSON.parse(response.result.content[0].text).items;
    expect(functions).toContainEqual(
      expect.objectContaining({
        id: 'fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T>',
        signature:
          'fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T>',
      }),
    );
  }, 6000);

  it('should respond to list_functions_in_file tool call for complex Kotlin file', async () => {
    const list_functions_in_file = {
      jsonrpc: '2.0',
      id: 'list_functions_kotlin_complex_1',
      method: 'tools/call',
      params: {
        name: 'list_functions_in_file',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test_complex.kt'),
          language: 'kotlin',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}\n\n`);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get('list_functions_kotlin_complex_1') || '{}');
    const functions = JSON.parse(response.result.content[0].text).data.functions;

    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fun incrementCounter(): Int',
          signature: 'fun incrementCounter(): Int',
        }),
        expect.objectContaining({
          id: 'fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T>',
          signature:
            'fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T>',
        }),
        expect.objectContaining({
          id: 'fun create(name: String): MyComplexClass',
          signature: 'fun create(name: String): MyComplexClass',
        }),
        expect.objectContaining({ id: 'fun doSomething()', signature: 'fun doSomething()' }),
        expect.objectContaining({ id: 'fun getInstance()', signature: 'fun getInstance()' }),
        expect.objectContaining({
          id: 'fun topLevelFunction(value: String): String',
          signature: 'fun topLevelFunction(value: String): String',
        }),
      ]),
    );
  }, 6000);

  it('should respond to get_function_chunk tool call for Swift', async () => {
    const get_function_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_swift_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'get_function_chunk',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test.swift'),
          functionSignature: 'func mySwiftFunction(param:) -> Int',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('get_chunk_swift_1') || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('func mySwiftFunction(param: String) -> Int');
    expect(response.isError).toBeUndefined();
  }, 3000);

  it('should respond to get_function_chunk tool call for Kotlin', async () => {
    const get_function_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_kotlin_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'get_function_chunk',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test.kt'),
          functionSignature: 'fun myKotlinFunction(param: String): Int',
          language: 'kotlin',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get('get_chunk_kotlin_1') || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('fun myKotlinFunction(param: String): Int');
    expect(response.isError).toBeUndefined();
  }, 6000);

  it('should respond to get_chunk tool call', async () => {
    const get_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_2', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'get_chunk',
        arguments: {
          chunkId: 'func mySwiftFunction(param:) -> Int',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('get_chunk_2') || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('func mySwiftFunction(param: String) -> Int');
    expect(response.isError).toBeUndefined();
  }, 3000);

  it('should return error for non-existent chunkId', async () => {
    const get_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_error_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'get_chunk',
        arguments: {
          chunkId: 'nonExistentChunkId',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('get_chunk_error_1') || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('Chunk not found.');
    expect(response.result.isError).toBe(true);
  }, 3000);

  it('should respond to find_file tool call', async () => {
    const find_file = {
      jsonrpc: '2.0',
      id: 'find_file_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'find_file',
        arguments: {
          pattern: './**/test.swift',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(find_file)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('find_file_1') || '{}'); // Mapから取得
    const files = JSON.parse(response.result.content[0].text).items;
    expect(files).toEqual(expect.arrayContaining([path.join(TEST_PROJECT_DIR, 'test.swift')]));
  }, 3000);

  it('should return error for non-existent file in list_functions_in_file', async () => {
    const list_functions_in_file = {
      jsonrpc: '2.0',
      id: 'list_functions_error_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'list_functions_in_file',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'nonExistentFile.swift'),
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('list_functions_error_1') || '{}'); // Mapから取得
    const parsedContent = JSON.parse(response.result.content[0].text);
    expect(parsedContent.data.functions).toEqual([]);
  }, 3000);

  it('should respond to find_function tool call for Swift', async () => {
    const find_function = {
      jsonrpc: '2.0',
      id: 'find_function_swift_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'find_function',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test.swift'),
          functionQuery: 'mySwiftFunction',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(find_function)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('find_function_swift_1') || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text).items;
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'func mySwiftFunction(param:) -> Int',
          signature: 'func mySwiftFunction(param:) -> Int',
        }),
      ]),
    );
  }, 3000);

  it('should respond to find_function tool call for Kotlin', async () => {
    const find_function = {
      jsonrpc: '2.0',
      id: 'find_function_kotlin_1', // idをユニークにする
      method: 'tools/call',
      params: {
        name: 'find_function',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test.kt'),
          functionQuery: 'myKotlinFunction',
          language: 'kotlin',
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(find_function)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const response = JSON.parse(responseMap.get('find_function_kotlin_1') || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text).items;
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fun myKotlinFunction(param: String): Int',
          signature: 'fun myKotlinFunction(param: String): Int',
        }),
      ]),
    );
  }, 5000);

  it('should respond to get_function_chunk tool call with paging for large function', async () => {
    const get_function_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_large_function_1',
      method: 'tools/call',
      params: {
        name: 'get_function_chunk',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test_large_function.swift'),
          functionSignature: 'func largeFunction() -> Void',
          pageSize: 10,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk)}

`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('get_chunk_large_function_1') || '{}');
    const parsedContent = JSON.parse(response.result.content[0].text);

    expect(parsedContent.data.isPartial).toBe(true);
    expect(parsedContent.data.codeContent.split('\n').length).toBe(12);
    expect(parsedContent.data.totalLines).toBe(103);
    expect(parsedContent.data.currentPage).toBe(1);
    expect(parsedContent.data.totalPages).toBe(11);
    expect(parsedContent.data.nextPageToken).toBeDefined();
    expect(parsedContent.data.prevPageToken).toBeUndefined();
  }, 3000);

  it('should respond to get_function_chunk tool call with next page using pageToken', async () => {
    const get_function_chunk_first_page = {
      jsonrpc: '2.0',
      id: 'get_chunk_large_function_first_page',
      method: 'tools/call',
      params: {
        name: 'get_function_chunk',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test_large_function.swift'),
          functionSignature: 'func largeFunction() -> Void',
          pageSize: 10,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk_first_page)}\n\n`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const firstPageResponse = JSON.parse(
      responseMap.get('get_chunk_large_function_first_page') || '{}',
    );
    const firstPageContent = JSON.parse(firstPageResponse.result.content[0].text);
    const nextPageToken = firstPageContent.data.nextPageToken;

    expect(nextPageToken).toBeDefined();

    const get_function_chunk_second_page = {
      jsonrpc: '2.0',
      id: 'get_chunk_large_function_second_page',
      method: 'tools/call',
      params: {
        name: 'get_function_chunk',
        arguments: {
          filePath: path.join(TEST_PROJECT_DIR, 'test_large_function.swift'),
          functionSignature: 'func largeFunction() -> Void',
          pageSize: 10,
          pageToken: nextPageToken,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk_second_page)}

`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const secondPageResponse = JSON.parse(
      responseMap.get('get_chunk_large_function_second_page') || '{}',
    );
    const secondPageContent = JSON.parse(secondPageResponse.result.content[0].text);

    expect(secondPageContent.data.isPartial).toBe(true);
    expect(secondPageContent.data.codeContent.split('\n').length).toBe(12);
    expect(secondPageContent.data.currentPage).toBe(2);
    expect(secondPageContent.data.prevPageToken).toBeDefined();
  }, 6000);

  it('should respond to get_chunk tool call with paging for large chunk', async () => {
    const get_chunk = {
      jsonrpc: '2.0',
      id: 'get_chunk_large_chunk_1',
      method: 'tools/call',
      params: {
        name: 'get_chunk',
        arguments: {
          chunkId: 'func largeFunction() -> Void',
          pageSize: 10,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk)}

`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get('get_chunk_large_chunk_1') || '{}');
    const parsedContent = JSON.parse(response.result.content[0].text);

    expect(parsedContent.data.isPartial).toBe(true);
    expect(parsedContent.data.codeContent.split('\n').length).toBe(12);
    expect(parsedContent.data.totalLines).toBe(103); // 100 lines + func declaration + closing brace
    expect(parsedContent.data.currentPage).toBe(1);
    expect(parsedContent.data.totalPages).toBe(11); // 102 lines / 10 lines per page = 10.2 -> 11 pages
    expect(parsedContent.data.nextPageToken).toBeDefined();
    expect(parsedContent.data.prevPageToken).toBeUndefined();
  }, 3000);

  it('should respond to get_chunk tool call with next page using pageToken', async () => {
    const get_chunk_first_page = {
      jsonrpc: '2.0',
      id: 'get_chunk_large_chunk_first_page',
      method: 'tools/call',
      params: {
        name: 'get_chunk',
        arguments: {
          chunkId: 'func largeFunction() -> Void',
          pageSize: 10,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk_first_page)}\n\n`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const firstPageResponse = JSON.parse(
      responseMap.get('get_chunk_large_chunk_first_page') || '{}',
    );
    const firstPageContent = JSON.parse(firstPageResponse.result.content[0].text);
    const nextPageToken = firstPageContent.data.nextPageToken;

    expect(nextPageToken).toBeDefined();

    const get_chunk_second_page = {
      jsonrpc: '2.0',
      id: 'get_chunk_large_chunk_second_page',
      method: 'tools/call',
      params: {
        name: 'get_chunk',
        arguments: {
          chunkId: 'func largeFunction() -> Void',
          pageSize: 10,
          pageToken: nextPageToken,
        },
      },
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk_second_page)}

`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const secondPageResponse = JSON.parse(
      responseMap.get('get_chunk_large_chunk_second_page') || '{}',
    );
    const secondPageContent = JSON.parse(secondPageResponse.result.content[0].text);

    expect(secondPageContent.data.isPartial).toBe(true);
    expect(secondPageContent.data.codeContent.split('\n').length).toBe(12);
    expect(secondPageContent.data.currentPage).toBe(2);
    expect(secondPageContent.data.prevPageToken).toBeDefined();
  }, 6000);
});
