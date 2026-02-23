import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceKitLspAdapter } from '../adapters/sourceKitLspAdapter.js';
import { JsonRpcClient } from '../utils/jsonRpcClient.js';

// JsonRpcClientのモック
vi.mock('../utils/jsonRpcClient.js', () => {
  return {
    JsonRpcClient: vi.fn().mockImplementation(() => {
      return {
        start: vi.fn(),
        stop: vi.fn(),
        sendRequest: vi.fn().mockImplementation((method: string, params: any) => {
          if (method === 'initialize') {
            return Promise.resolve({ capabilities: {} });
          }
          if (method === 'textDocument/definition') {
            return Promise.resolve([
              {
                uri: 'file:///path/to/Def.swift',
                range: { start: { line: 15, character: 4 } },
              },
            ]);
          }
          if (method === 'textDocument/references') {
            return Promise.resolve([
              {
                uri: 'file:///path/to/Caller.swift',
                range: { start: { line: 20, character: 8 } },
              },
            ]);
          }
          return Promise.resolve({});
        }),
        sendNotification: vi.fn(),
      };
    }),
  };
});

describe('SourceKitLspAdapter', () => {
  let adapter: SourceKitLspAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SourceKitLspAdapter();
  });

  it('LSP初期化リクエストを送信できること', async () => {
    await adapter.initialize('/test/project');

    // adapterの実装内で利用している JsonRpcClient インスタンスのsendRequestが呼ばれたか確認
    // （ここでは内部ステートの初期化フラグが立つかどうかで簡易検証）
    expect(adapter['isInitialized']).toBe(true);
  });

  it('初期化前にシンボル取得を試みるとエラーになること', async () => {
    await expect(adapter.getSymbolAtPoint('/test.swift', 10, 5)).rejects.toThrow(
      'SourceKit-LSP is not initialized',
    );
  });

  it('getSymbolAtPointでLSPのdefinition応答をGraphNodeに変換できること', async () => {
    await adapter.initialize('/test/project');
    const symbol = await adapter.getSymbolAtPoint('/path/to/file.swift', 10, 5);

    expect(symbol).not.toBeNull();
    expect(symbol?.id).toBe('file:///path/to/Def.swift#15');
    expect(symbol?.filePath).toBe('/path/to/Def.swift');
    expect(symbol?.kind).toBe('function');
  });

  it('getReferencesでLSPのreferences応答をGraphNodeリストに変換できること', async () => {
    await adapter.initialize('/test/project');
    const refs = await adapter.getReferences('file:///path/to/Def.swift#15#4');

    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe('file:///path/to/Caller.swift#20#8');
    expect(refs[0].filePath).toBe('/path/to/Caller.swift');
  });
});
