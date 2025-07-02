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
  } catch(_) {
    return false;
  }
  return true;
};

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
    await fs.writeFile(path.join(TEST_PROJECT_DIR, 'test.swift'), `
func mySwiftFunction(param: String) -> Int {
    return 1
}
`);
    await fs.writeFile(path.join(TEST_PROJECT_DIR, 'test.kt'), `
fun myKotlinFunction(param: String): Int {
    return 2
}
`);

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
      "jsonrpc": "2.0",
      "id": "initialize_1",
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {
          "roots": {
            "listChanged": true
          },
          "sampling": {},
          "elicitation": {}
        },
        "clientInfo": {
          "name": "ExampleClient",
          "title": "Example Client Display Name",
          "version": "1.0.0"
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(init)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 500));

    // analyze_projectメッセージを投げる
    const analyze_project = {
      "jsonrpc": "2.0",
      "id": "analyze_project_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "analyze_project",
        "arguments": {
          "projectPath": TEST_PROJECT_DIR
        }
      }
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
      "jsonrpc": "2.0",
      "id": "analyze_project_2", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "analyze_project",
        "arguments": {
          "projectPath": TEST_PROJECT_DIR
        }
      }
    };

    serverProcess.stdin.write(JSON.stringify(toolCall) + '\n\n');

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get("analyze_project_2") || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('Project analysis completed.');
    expect(response.isError).toBeUndefined();

    // チャンクファイルが生成されたことを確認
    const swiftChunkPath = path.join(CHUNKS_DIR, 'func_mySwiftFunction_param___-__Int.json');
    const kotlinChunkPath = path.join(CHUNKS_DIR, 'fun_myKotlinFunction_param__String___Int.json');
    await expect(fs.access(swiftChunkPath)).resolves.toBeUndefined();
    await expect(fs.access(kotlinChunkPath)).resolves.toBeUndefined();
  }, 30000);

  it('should respond to list_functions_in_file tool call for Swift', async () => {
    const list_functions_in_file = {
      "jsonrpc": "2.0",
      "id": "list_functions_swift_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "list_functions_in_file",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'test.swift')
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("list_functions_swift_1") || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text);
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'func mySwiftFunction(param:) -> Int',
          signature: 'func mySwiftFunction(param:) -> Int',
        }),
      ]),
    );
  }, 5000);

  it('should respond to list_functions_in_file tool call for Kotlin', async () => {
    const list_functions_in_file = {
      "jsonrpc": "2.0",
      "id": "list_functions_kotlin_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "list_functions_in_file",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'test.kt'),
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get("list_functions_kotlin_1") || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text);
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fun myKotlinFunction(param: String): Int', // Kotlinのシグネチャは変わる可能性あり
          signature: 'fun myKotlinFunction(param: String): Int',
        }),
      ]),
    );
  }, 6000);

  it('should respond to get_function_chunk tool call for Swift', async () => {
    const get_function_chunk = {
      "jsonrpc": "2.0",
      "id": "get_chunk_swift_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "get_function_chunk",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'test.swift'),
          "functionSignature": 'func mySwiftFunction(param:) -> Int',
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("get_chunk_swift_1") || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('func mySwiftFunction(param: String) -> Int');
    expect(response.isError).toBeUndefined();
  }, 3000);

  it('should respond to get_function_chunk tool call for Kotlin', async () => {
    const get_function_chunk = {
      "jsonrpc": "2.0",
      "id": "get_chunk_kotlin_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "get_function_chunk",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'test.kt'),
          "functionSignature": 'fun myKotlinFunction(param: String): Int',
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(get_function_chunk)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = JSON.parse(responseMap.get("get_chunk_kotlin_1") || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('fun myKotlinFunction(param: String): Int');
    expect(response.isError).toBeUndefined();
  }, 6000);

  it('should respond to get_chunk tool call', async () => {
    const get_chunk = {
      "jsonrpc": "2.0",
      "id": "get_chunk_2", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "get_chunk",
        "arguments": {
          "chunkId": 'func mySwiftFunction(param:) -> Int'
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("get_chunk_2") || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('func mySwiftFunction(param: String) -> Int');
    expect(response.isError).toBeUndefined();
  }, 3000);

  it('should return error for non-existent chunkId', async () => {
    const get_chunk = {
      "jsonrpc": "2.0",
      "id": "get_chunk_error_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "get_chunk",
        "arguments": {
          "chunkId": 'nonExistentChunkId'
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(get_chunk)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("get_chunk_error_1") || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('Chunk not found.');
    expect(response.result.isError).toBe(true);
  }, 3000);

  it('should respond to find_file tool call', async () => {
    const find_file = {
      "jsonrpc": "2.0",
      "id": "find_file_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "find_file",
        "arguments": {
          "pattern": './**/test.swift'
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(find_file)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("find_file_1") || '{}'); // Mapから取得
    const files = JSON.parse(response.result.content[0].text);
    expect(files).toEqual(expect.arrayContaining([path.join(TEST_PROJECT_DIR, 'test.swift')]));
  }, 3000);

  it('should return error for non-existent file in list_functions_in_file', async () => {
    const list_functions_in_file = {
      "jsonrpc": "2.0",
      "id": "list_functions_error_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "list_functions_in_file",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'nonExistentFile.swift'),
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(list_functions_in_file)}

`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("list_functions_error_1") || '{}'); // Mapから取得
    expect(response.result.content[0].text).toContain('Error: Command failed with code 1:');
    expect(response.result.isError).toBe(true);
  }, 3000);

  it('should respond to find_function tool call for Swift', async () => {
    const find_function = {
      "jsonrpc": "2.0",
      "id": "find_function_swift_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "find_function",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'test.swift'),
          "functionQuery": 'mySwiftFunction',
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(find_function)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = JSON.parse(responseMap.get("find_function_swift_1") || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text);
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
      "jsonrpc": "2.0",
      "id": "find_function_kotlin_1", // idをユニークにする
      "method": "tools/call",
      "params": {
        "name": "find_function",
        "arguments": {
          "filePath": path.join(TEST_PROJECT_DIR, 'test.kt'),
          "functionQuery": 'myKotlinFunction',
        }
      }
    };
    serverProcess.stdin.write(`${JSON.stringify(find_function)}\n\n`);

    // 応答を少し待つ
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const response = JSON.parse(responseMap.get("find_function_kotlin_1") || '{}'); // Mapから取得
    const functions = JSON.parse(response.result.content[0].text);
    expect(functions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fun myKotlinFunction(param: String): Int',
          signature: 'fun myKotlinFunction(param: String): Int',
        }),
      ]),
    );
  }, 5000);
});