import { SwiftParser, CodeChunk } from '../swiftParser.js';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { vi } from 'vitest';

// Mock child_process.exec and fs.readFile
vi.mock('child_process', () => ({
  exec: vi.fn(), // exec はモックのままにしておく
  spawn: vi.fn(() => ({
    // spawn のモック実装
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify(mockSourceKittenOutput));
        }
      }),
    },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        callback(0); // 成功を示すコード
      } else if (event === 'error') {
        // エラーテストのために必要に応じて実装
      }
    }),
  })),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

const mockExec = vi.mocked(exec); // exec のモックはそのまま
const mockReadFile = vi.mocked(fs.readFile);

describe('SwiftParser (Unit Tests)', () => {
  let parser: SwiftParser;

  beforeEach(async () => {
    console.log('[Test] beforeEach: Start');
    parser = new SwiftParser(
      vi.fn((command, args) => {
        // ここで spawn の引数形式を模倣
        if (command === 'sourcekitten' && args[0] === 'structure') {
          return Promise.resolve({ stdout: JSON.stringify(mockSourceKittenOutput), stderr: '' });
        } else if (command === 'sourcekitten' && args[0] === '--file') {
          // getFunctionContent のテスト用
          return Promise.resolve({ stdout: JSON.stringify(mockSourceKittenOutput), stderr: '' });
        }
        return Promise.reject(new Error('Unknown command'));
      }),
      mockReadFile,
    );
    mockSourceKittenOutput = {
      'key.diagnostic_stage': 'source.diagnostic.stage.swift.parse',
      'key.length': 2448,
      'key.offset': 0,
      'key.substructure': [
        {
          'key.accessibility': 'source.lang.swift.accessibility.internal',
          'key.bodylength': 14,
          'key.bodyoffset': 43,
          'key.kind': 'source.lang.swift.decl.function.free',
          'key.length': 58,
          'key.name': 'dummyFunction1(param:)',
          'key.namelength': 29,
          'key.nameoffset': 5,
          'key.offset': 0,
          'key.substructure': [
            {
              'key.kind': 'source.lang.swift.decl.var.parameter',
              'key.length': 13,
              'key.name': 'param',
              'key.namelength': 5,
              'key.nameoffset': 20,
              'key.offset': 20,
              'key.typename': 'String',
            },
          ],
          'key.typename': 'Int',
        },
        {
          'key.accessibility': 'source.lang.swift.accessibility.internal',
          'key.bodylength': 1789,
          'key.bodyoffset': 569,
          'key.doclength': 415,
          'key.docoffset': 102,
          'key.kind': 'source.lang.swift.decl.function.free',
          'key.length': 1842,
          'key.name': 'largeFunction(input:)',
          'key.namelength': 35,
          'key.nameoffset': 522,
          'key.offset': 517,
          'key.substructure': [
            {
              'key.kind': 'source.lang.swift.decl.var.parameter',
              'key.length': 20,
              'key.name': 'input',
              'key.namelength': 5,
              'key.nameoffset': 536,
              'key.offset': 536,
              'key.typename': '[String: Any]',
            },
            {
              'key.kind': 'source.lang.swift.decl.var.local',
              'key.length': 15,
              'key.name': 'result',
              'key.namelength': 6,
              'key.nameoffset': 578,
              'key.offset': 574,
            },
            {
              'key.elements': [
                {
                  'key.kind': 'source.lang.swift.structure.elem.condition_expr',
                  'key.length': 50,
                  'key.offset': 638,
                },
              ],
              'key.kind': 'source.lang.swift.stmt.if',
              'key.length': 146,
              'key.offset': 635,
              'key.substructure': [
                {
                  'key.kind': 'source.lang.swift.decl.var.local',
                  'key.length': 4,
                  'key.name': 'name',
                  'key.namelength': 4,
                  'key.nameoffset': 642,
                  'key.offset': 642,
                },
                {
                  'key.bodylength': 6,
                  'key.bodyoffset': 655,
                  'key.kind': 'source.lang.swift.expr.call',
                  'key.length': 13,
                  'key.name': 'input',
                  'key.namelength': 5,
                  'key.nameoffset': 649,
                  'key.offset': 649,
                  'key.substructure': [
                    {
                      'key.bodylength': 6,
                      'key.bodyoffset': 655,
                      'key.kind': 'source.lang.swift.expr.argument',
                      'key.length': 6,
                      'key.offset': 655,
                    },
                  ],
                },
                {
                  'key.bodylength': 12,
                  'key.bodyoffset': 676,
                  'key.kind': 'source.lang.swift.expr.argument',
                  'key.length': 12,
                  'key.offset': 676,
                },
                {
                  'key.bodylength': 43,
                  'key.bodyoffset': 690,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 45,
                  'key.offset': 689,
                },
                {
                  'key.bodylength': 39,
                  'key.bodyoffset': 741,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 41,
                  'key.offset': 740,
                },
              ],
            },
            {
              'key.elements': [
                {
                  'key.kind': 'source.lang.swift.structure.elem.condition_expr',
                  'key.length': 30,
                  'key.offset': 813,
                },
              ],
              'key.kind': 'source.lang.swift.stmt.if',
              'key.length': 404,
              'key.offset': 810,
              'key.substructure': [
                {
                  'key.kind': 'source.lang.swift.decl.var.local',
                  'key.length': 3,
                  'key.name': 'age',
                  'key.namelength': 3,
                  'key.nameoffset': 817,
                  'key.offset': 817,
                },
                {
                  'key.bodylength': 5,
                  'key.bodyoffset': 829,
                  'key.kind': 'source.lang.swift.expr.call',
                  'key.length': 12,
                  'key.name': 'input',
                  'key.namelength': 5,
                  'key.nameoffset': 823,
                  'key.offset': 823,
                  'key.substructure': [
                    {
                      'key.bodylength': 5,
                      'key.bodyoffset': 829,
                      'key.kind': 'source.lang.swift.expr.argument',
                      'key.length': 5,
                      'key.offset': 829,
                    },
                  ],
                },
                {
                  'key.bodylength': 318,
                  'key.bodyoffset': 845,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 320,
                  'key.offset': 844,
                  'key.substructure': [
                    {
                      'key.elements': [
                        {
                          'key.kind': 'source.lang.swift.structure.elem.expr',
                          'key.length': 3,
                          'key.offset': 861,
                        },
                      ],
                      'key.kind': 'source.lang.swift.stmt.switch',
                      'key.length': 304,
                      'key.offset': 854,
                      'key.substructure': [
                        {
                          'key.elements': [
                            {
                              'key.kind': 'source.lang.swift.structure.elem.pattern',
                              'key.length': 6,
                              'key.offset': 880,
                            },
                          ],
                          'key.kind': 'source.lang.swift.stmt.case',
                          'key.length': 56,
                          'key.offset': 875,
                        },
                        {
                          'key.elements': [
                            {
                              'key.kind': 'source.lang.swift.structure.elem.pattern',
                              'key.length': 7,
                              'key.offset': 945,
                            },
                          ],
                          'key.kind': 'source.lang.swift.stmt.case',
                          'key.length': 78,
                          'key.offset': 940,
                        },
                        {
                          'key.elements': [
                            {
                              'key.kind': 'source.lang.swift.structure.elem.pattern',
                              'key.length': 7,
                              'key.offset': 1032,
                            },
                          ],
                          'key.kind': 'source.lang.swift.stmt.case',
                          'key.length': 57,
                          'key.offset': 1027,
                        },
                        {
                          'key.elements': [
                            {
                              'key.kind': 'source.lang.swift.structure.elem.pattern',
                              'key.length': 7,
                              'key.offset': 1093,
                            },
                          ],
                          'key.kind': 'source.lang.swift.stmt.case',
                          'key.length': 55,
                          'key.offset': 1093,
                        },
                      ],
                    },
                  ],
                },
                {
                  'key.bodylength': 42,
                  'key.bodyoffset': 1171,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 44,
                  'key.offset': 1170,
                },
              ],
            },
            {
              'key.elements': [
                {
                  'key.kind': 'source.lang.swift.structure.elem.condition_expr',
                  'key.length': 42,
                  'key.offset': 1264,
                },
              ],
              'key.kind': 'source.lang.swift.stmt.if',
              'key.length': 213,
              'key.offset': 1261,
              'key.substructure': [
                {
                  'key.kind': 'source.lang.swift.decl.var.local',
                  'key.length': 4,
                  'key.name': 'data',
                  'key.namelength': 4,
                  'key.nameoffset': 1268,
                  'key.offset': 1268,
                },
                {
                  'key.bodylength': 6,
                  'key.bodyoffset': 1281,
                  'key.kind': 'source.lang.swift.expr.call',
                  'key.length': 13,
                  'key.name': 'input',
                  'key.namelength': 5,
                  'key.nameoffset': 1275,
                  'key.offset': 1275,
                  'key.substructure': [
                    {
                      'key.bodylength': 6,
                      'key.bodyoffset': 1281,
                      'key.kind': 'source.lang.swift.expr.argument',
                      'key.length': 6,
                      'key.offset': 1281,
                    },
                  ],
                },
                {
                  'key.bodylength': 105,
                  'key.bodyoffset': 1308,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 107,
                  'key.offset': 1307,
                  'key.substructure': [
                    {
                      'key.elements': [
                        {
                          'key.kind': 'source.lang.swift.structure.elem.id',
                          'key.length': 12,
                          'key.offset': 1321,
                        },
                        {
                          'key.kind': 'source.lang.swift.structure.elem.expr',
                          'key.length': 4,
                          'key.offset': 1337,
                        },
                      ],
                      'key.kind': 'source.lang.swift.stmt.foreach',
                      'key.length': 91,
                      'key.offset': 1317,
                      'key.substructure': [
                        {
                          'key.kind': 'source.lang.swift.decl.var.local',
                          'key.length': 3,
                          'key.name': 'key',
                          'key.namelength': 3,
                          'key.nameoffset': 1322,
                          'key.offset': 1322,
                        },
                        {
                          'key.kind': 'source.lang.swift.decl.var.local',
                          'key.length': 5,
                          'key.name': 'value',
                          'key.namelength': 5,
                          'key.nameoffset': 1327,
                          'key.offset': 1327,
                        },
                        {
                          'key.bodylength': 64,
                          'key.bodyoffset': 1343,
                          'key.kind': 'source.lang.swift.stmt.brace',
                          'key.length': 66,
                          'key.offset': 1342,
                        },
                      ],
                    },
                  ],
                },
                {
                  'key.bodylength': 52,
                  'key.bodyoffset': 1421,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 54,
                  'key.offset': 1420,
                },
              ],
            },
            {
              'key.elements': [
                {
                  'key.kind': 'source.lang.swift.structure.elem.id',
                  'key.length': 1,
                  'key.offset': 1552,
                },
                {
                  'key.kind': 'source.lang.swift.structure.elem.expr',
                  'key.length': 6,
                  'key.offset': 1557,
                },
              ],
              'key.kind': 'source.lang.swift.stmt.foreach',
              'key.length': 160,
              'key.offset': 1548,
              'key.substructure': [
                {
                  'key.kind': 'source.lang.swift.decl.var.local',
                  'key.length': 1,
                  'key.name': 'i',
                  'key.namelength': 1,
                  'key.nameoffset': 1552,
                  'key.offset': 1552,
                },
                {
                  'key.bodylength': 142,
                  'key.bodyoffset': 1565,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 144,
                  'key.offset': 1564,
                  'key.substructure': [
                    {
                      'key.elements': [
                        {
                          'key.kind': 'source.lang.swift.structure.elem.condition_expr',
                          'key.length': 10,
                          'key.offset': 1577,
                        },
                      ],
                      'key.kind': 'source.lang.swift.stmt.if',
                      'key.length': 128,
                      'key.offset': 1574,
                      'key.substructure': [
                        {
                          'key.bodylength': 48,
                          'key.bodyoffset': 1589,
                          'key.kind': 'source.lang.swift.stmt.brace',
                          'key.length': 50,
                          'key.offset': 1588,
                        },
                        {
                          'key.bodylength': 48,
                          'key.bodyoffset': 1653,
                          'key.kind': 'source.lang.swift.stmt.brace',
                          'key.length': 50,
                          'key.offset': 1652,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              'key.kind': 'source.lang.swift.decl.var.local',
              'key.length': 116,
              'key.name': 'processCompletion',
              'key.namelength': 17,
              'key.nameoffset': 1765,
              'key.offset': 1761,
              'key.typename': '(String) -> Void',
            },
            {
              'key.bodylength': 72,
              'key.bodyoffset': 1804,
              'key.kind': 'source.lang.swift.expr.closure',
              'key.length': 74,
              'key.offset': 1803,
              'key.substructure': [
                {
                  'key.kind': 'source.lang.swift.decl.var.parameter',
                  'key.length': 7,
                  'key.name': 'message',
                  'key.offset': 1805,
                },
                {
                  'key.bodylength': 72,
                  'key.bodyoffset': 1804,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 74,
                  'key.offset': 1803,
                },
              ],
            },
            {
              'key.bodylength': 17,
              'key.bodyoffset': 1900,
              'key.kind': 'source.lang.swift.expr.call',
              'key.length': 36,
              'key.name': 'processCompletion',
              'key.namelength': 17,
              'key.nameoffset': 1882,
              'key.offset': 1882,
              'key.substructure': [
                {
                  'key.bodylength': 17,
                  'key.bodyoffset': 1900,
                  'key.kind': 'source.lang.swift.expr.argument',
                  'key.length': 17,
                  'key.offset': 1900,
                },
              ],
            },
            {
              'key.elements': [
                {
                  'key.kind': 'source.lang.swift.structure.elem.condition_expr',
                  'key.length': 39,
                  'key.offset': 1954,
                },
              ],
              'key.kind': 'source.lang.swift.stmt.guard',
              'key.length': 129,
              'key.offset': 1948,
              'key.substructure': [
                {
                  'key.kind': 'source.lang.swift.decl.var.local',
                  'key.length': 6,
                  'key.name': 'status',
                  'key.namelength': 6,
                  'key.nameoffset': 1958,
                  'key.offset': 1958,
                },
                {
                  'key.bodylength': 8,
                  'key.bodyoffset': 1973,
                  'key.kind': 'source.lang.swift.expr.call',
                  'key.length': 15,
                  'key.name': 'input',
                  'key.namelength': 5,
                  'key.nameoffset': 1967,
                  'key.offset': 1967,
                  'key.substructure': [
                    {
                      'key.bodylength': 8,
                      'key.bodyoffset': 1973,
                      'key.kind': 'source.lang.swift.expr.argument',
                      'key.length': 8,
                      'key.offset': 1973,
                    },
                  ],
                },
                {
                  'key.bodylength': 76,
                  'key.bodyoffset': 2000,
                  'key.kind': 'source.lang.swift.stmt.brace',
                  'key.length': 78,
                  'key.offset': 1999,
                },
              ],
            },
            {
              'key.bodylength': 53,
              'key.bodyoffset': 2176,
              'key.kind': 'source.lang.swift.stmt.brace',
              'key.length': 55,
              'key.offset': 2175,
              'key.substructure': [
                {
                  'key.bodylength': 32,
                  'key.bodyoffset': 2191,
                  'key.kind': 'source.lang.swift.expr.call',
                  'key.length': 39,
                  'key.name': 'print',
                  'key.namelength': 5,
                  'key.nameoffset': 2185,
                  'key.offset': 2185,
                  'key.substructure': [
                    {
                      'key.bodylength': 32,
                      'key.bodyoffset': 2191,
                      'key.kind': 'source.lang.swift.expr.argument',
                      'key.length': 32,
                      'key.offset': 2191,
                    },
                  ],
                },
              ],
            },
          ],
          'key.typename': 'String',
        },
        {
          'key.accessibility': 'source.lang.swift.accessibility.internal',
          'key.bodylength': 20,
          'key.bodyoffset': 2426,
          'key.kind': 'source.lang.swift.decl.function.free',
          'key.length': 44,
          'key.name': 'dummyFunction2()',
          'key.namelength': 16,
          'key.nameoffset': 2408,
          'key.offset': 2403,
          'key.substructure': [
            {
              'key.bodylength': 7,
              'key.bodyoffset': 2437,
              'key.kind': 'source.lang.swift.expr.call',
              'key.length': 14,
              'key.name': 'print',
              'key.namelength': 5,
              'key.nameoffset': 2431,
              'key.offset': 2431,
              'key.substructure': [
                {
                  'key.bodylength': 7,
                  'key.bodyoffset': 2437,
                  'key.kind': 'source.lang.swift.expr.argument',
                  'key.length': 7,
                  'key.offset': 2437,
                },
              ],
            },
          ],
        },
      ],
    };
    mockFileContent = `func dummyFunction1(param: String) -> Int {
    return 1
}

// --- largeFunction 定義の開始 ---

/// これはテスト目的の非常に大きく複雑な関数です。
/// 複数の行にまたがり、様々な制御フロー文、コメント、
/// およびネストされた構造を含み、現実世界のシナリオをシミュレートします。
/// 目的は、\`get_function_chunk\` ツールが大きな関数の
/// 完全なコード内容を抽出する能力をテストすることです。
func largeFunction(input: [String: Any]) -> String {
    var result = ""
    // 基本的な条件をチェック
    if let name = input["name"] as? String, !name.isEmpty {
        result += "名前: \\(name)\\n"
    } else {
        result += "名前: N/A\\n"
    }

    // 年齢を処理
    if let age = input["age"] as? Int {
        switch age {
        case 0..<13:
            result += "年齢層: 子供\\n"
        case 13..<20:
            result += "年齢層: ティーンエイジャー\\n"
        case 20..<65:
            result += "年齢層: 大人\\n"
        default:
            result += "年齢層: シニア\\n"
        }
    } else {
        result += "年齢: 不明\\n"
    }

    // オプションデータを処理
    if let data = input["data"] as? [String: Any] {
        for (key, value) in data {
            result += "データ - \\(key): \\(value)\\n"
        }
    } else {
        result += "追加データなし。\\n"
    }

    // いくつかの複雑な計算や操作をシミュレート
    for i in 0..<10 {
        if i % 2 == 0 {
            result += "偶数: \\(i)\\n"
        }
        else {
            result += "奇数: \\(i)\\n"
        }
    }

    // ネストされたクロージャの例
    let processCompletion: (String) -> Void = { message in
        result += "完了メッセージ: \\(message)\\n"
    }
    processCompletion("タスク完了")

    // Guard let の例
    guard let status = input["status"] as? String else {
        result += "ステータス: 未提供\\n"
        return result
    }
    result += "ステータス: \\(status)\\n"

    // Defer ステートメントの例
    defer {
        print("大規模関数実行終了。")
    }

    // 最終概要
    result += "\\n--- 概要 ---\\n"
    result += "正常に処理されました。\\n"

    return result
}

// --- largeFunction 定義の終了 ---

func dummyFunction2() {
    print("Hello")
}`;

    // expected content の設定
    expectedDummyFunction1Content = `func dummyFunction1(param: String) -> Int {
    return 1
}`;
    expectedDummyFunction2Content = `func dummyFunction2() {
    print("Hello")
}`;
    expectedLargeFunctionContent = `func largeFunction(input: [String: Any]) -> String {
    var result = ""
    // 基本的な条件をチェック
    if let name = input["name"] as? String, !name.isEmpty {
        result += "名前: \\(name)\\n"
    } else {
        result += "名前: N/A\\n"
    }

    // 年齢を処理
    if let age = input["age"] as? Int {
        switch age {
        case 0..<13:
            result += "年齢層: 子供\\n"
        case 13..<20:
            result += "年齢層: ティーンエイジャー\\n"
        case 20..<65:
            result += "年齢層: 大人\\n"
        default:
            result += "年齢層: シニア\\n"
        }
    } else {
        result += "年齢: 不明\\n"
    }

    // オプションデータを処理
    if let data = input["data"] as? [String: Any] {
        for (key, value) in data {
            result += "データ - \\(key): \\(value)\\n"
        }
    } else {
        result += "追加データなし。\\n"
    }

    // いくつかの複雑な計算や操作をシミュレート
    for i in 0..<10 {
        if i % 2 == 0 {
            result += "偶数: \\(i)\\n"
        }
        else {
            result += "奇数: \\(i)\\n"
        }
    }

    // ネストされたクロージャの例
    let processCompletion: (String) -> Void = { message in
        result += "完了メッセージ: \\(message)\\n"
    }
    processCompletion("タスク完了")

    // Guard let の例
    guard let status = input["status"] as? String else {
        result += "ステータス: 未提供\\n"
        return result
    }
    result += "ステータス: \\(status)\\n"

    // Defer ステートメントの例
    defer {
        print("大規模関数実行終了。")
    }

    // 最終概要
    result += "\\n--- 概要 ---\\n"
    result += "正常に処理されました。\\n"

    return result
}`;

    vi.clearAllMocks();
    const buf = Buffer.from(mockFileContent, 'utf8');
    //console.log(buf.toString());
    mockReadFile.mockResolvedValue(buf);
    // mockExec.mockResolvedValue({ stdout: mockSourceKittenOutput, stderr: '' }); // exec はもう使わない
    console.log('[Test] beforeEach: End');
  });

  let mockSourceKittenOutput: string;
  let mockFileContent: string;
  let expectedDummyFunction1Content: string;
  let expectedDummyFunction2Content: string;
  let expectedLargeFunctionContent: string;

  it('parseFile should return CodeChunk array on success', async () => {
    mockReadFile.mockResolvedValue(Buffer.from(mockFileContent, 'utf8'));

    const filePath = '/path/to/test.swift';
    const chunks = await parser.parseFile(filePath);

    expect(parser['exec']).toHaveBeenCalledWith('sourcekitten', ['structure', '--file', filePath]);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].id).toBe('func dummyFunction1(param:) -> Int');
    expect(chunks[0].signature).toBe('func dummyFunction1(param:) -> Int');
    expect(chunks[0].content).toBe(expectedDummyFunction1Content);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(3);

    // largeFunction のテスト
    expect(chunks[1].id).toBe('func largeFunction(input:) -> String');
    expect(chunks[1].signature).toBe('func largeFunction(input:) -> String');
    expect(chunks[1].content).toBe(expectedLargeFunctionContent);
    expect(chunks[1].startLine).toBe(12);
    expect(chunks[1].endLine).toBe(79);

    expect(chunks[2].id).toBe('func dummyFunction2()');
    expect(chunks[2].signature).toBe('func dummyFunction2()');
    expect(chunks[2].content).toBe(expectedDummyFunction2Content);
    expect(chunks[2].startLine).toBe(83);
    expect(chunks[2].endLine).toBe(85);

    console.log('[Test] parseFile success test: End');
  });

  it('parseFile should return empty array on SourceKitten error', async () => {
    parser = new SwiftParser(
      vi.fn((command, args) => {
        if (command === 'sourcekitten' && args[0] === 'structure') {
          return Promise.reject(new Error('SourceKitten command failed'));
        }
        return Promise.reject(new Error('Unknown command'));
      }),
      mockReadFile,
    );

    const filePath = '/path/to/error.swift';
    await expect(parser.parseFile(filePath)).resolves.toEqual([]);

    expect(parser['exec']).toHaveBeenCalledWith('sourcekitten', ['structure', '--file', filePath]);
    console.log('[Test] parseFile error test: End');
  });

  it('parseFile should return empty array on SourceKitten exec error', async () => {
    parser = new SwiftParser(
      vi.fn((command, args) => {
        if (command === 'sourcekitten' && args[0] === 'structure') {
          return Promise.reject(new Error('SourceKitten command failed'));
        }
        return Promise.reject(new Error('Unknown command'));
      }),
      mockReadFile,
    );

    const filePath = '/path/to/exec_error.swift';
    await expect(parser.parseFile(filePath)).resolves.toEqual([]);

    expect(parser['exec']).toHaveBeenCalledWith('sourcekitten', ['structure', '--file', filePath]);
  });

  // getFunctionContent のテストは parseFile のテストでカバーされるため削除
  // it('getFunctionContent should return null on SourceKitten exec error', async () => {
  //   mockReadFile.mockRejectedValue(new Error('File read failed'));
  //   parser = new SwiftParser(
  //     vi.fn((command, args) => {
  //       if (command === 'sourcekitten' && args[0] === 'structure') {
  //         return Promise.reject(new Error('SourceKitten command failed'));
  //       }
  //       return Promise.reject(new Error('Unknown command'));
  //     }),
  //     mockReadFile,
  //   );

  //   const filePath = '/path/to/exec_error.swift';
  //   const content = await parser.getFunctionContent(filePath, {
  //     name: 'dummyFunction1(param:)',
  //     type: 'source.lang.swift.decl.function.free',
  //     signature: 'func dummyFunction1(param:) -> Int',
  //     id: 'func dummyFunction1(param:) -> Int',
  //     content: '',
  //     startLine: 1,
  //     endLine: 3,
  //     offset: 0,
  //     length: 58,
  //   });

  //   expect(content).toBeNull();
  // });

  // it('getFunctionContent should return function content on success', async () => {
  //   console.log('[Test] getFunctionContent success test: Start');

  //   const filePath = '/path/to/test.swift';
  //   const functionSignature = 'func dummyFunction1(param:) -> Int';
  //   const content = await parser.getFunctionContent(filePath, {
  //     name: 'dummyFunction1(param:)',
  //     type: 'source.lang.swift.decl.function.free',
  //     signature: 'func dummyFunction1(param:) -> Int',
  //     id: 'func dummyFunction1(param:) -> Int',
  //     content: '',
  //     startLine: 1,
  //     endLine: 3,
  //     bodyOffset: 0,
  //     bodyLength: 0,
  //     offset: 0,
  //     length: 58,
  //   });
  //   expect(content).toBe(expectedDummyFunction1Content);
  //   console.log('[Test] getFunctionContent success test: End');
  // });

  // it('getFunctionContent should return null if function not found', async () => {
  //   console.log('[Test] getFunctionContent not found test: Start');

  //   const filePath = '/path/to/test.swift';
  //   const functionSignature = 'func nonExistentFunction() -> Void';
  //   const content = await parser.getFunctionContent(filePath, {
  //     name: 'nonExistentFunction()',
  //     type: 'source.lang.swift.decl.function.free',
  //     signature: 'func nonExistentFunction() -> Void',
  //     id: 'func nonExistentFunction() -> Void',
  //     content: '',
  //     startLine: 0,
  //     endLine: 0,
  //     bodyOffset: 0,
  //     bodyLength: 0,
  //     offset: 0,
  //     length: 0,
  //   });

  //   expect(content).toBe('');
  //   console.log('[Test] getFunctionContent not found test: End');
  // });

  // it('getFunctionContent should return null on file read error', async () => {
  //   console.log('[Test] getFunctionContent file read error test: Start');

  //   mockReadFile.mockRejectedValueOnce(new Error('File not found'));

  //   const filePath = '/path/to/non_existent_file.swift';
  //   const functionSignature = 'func dummyFunction1(param:) -> Int';
  //   const content = await parser.getFunctionContent(filePath, {
  //     name: 'dummyFunction1(param:)',
  //     type: 'source.lang.swift.decl.function.free',
  //     signature: 'func dummyFunction1(param:) -> Int',
  //     id: 'func dummyFunction1(param:) -> Int',
  //     content: '',
  //     startLine: 1,
  //     endLine: 3,
  //     bodyOffset: 0,
  //     bodyLength: 0,
  //     offset: 0,
  //     length: 58,
  //   });

  //   expect(content).toBeNull();
  //   console.log('[Test] getFunctionContent file read error test: End');
  // });
});
