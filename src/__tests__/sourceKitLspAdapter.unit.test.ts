import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
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

  it('LSPプロセスの起動に失敗した場合にinitializeがエラーを伝播すること', async () => {
    const rpcStartMock = (adapter as any).rpc.start as Mock;
    rpcStartMock.mockRejectedValueOnce(new Error('failed to start'));

    await expect(adapter.initialize('/test/project')).rejects.toThrow('failed to start');
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
  });

  it('definitionリクエストでLSPがエラーを返した場合にgetSymbolAtPointがnullを返すこと', async () => {
    await adapter.initialize('/test/project');

    const rpcSendRequestMock = (adapter as any).rpc.sendRequest as Mock;
    rpcSendRequestMock.mockRejectedValueOnce(new Error('LSP definition error'));

    // 今回はcatchでnullを返す実装になっているため
    const symbol = await adapter.getSymbolAtPoint('/path/to/file.swift', 10, 5);
    expect(symbol).toBeNull();
  });

  it('getReferencesでLSPのreferences応答をGraphNodeリストに変換できること', async () => {
    await adapter.initialize('/test/project');
    const refs = await adapter.getReferences('file:///path/to/Def.swift#15#4');

    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe('file:///path/to/Caller.swift#20#8');
    expect(refs[0].filePath).toBe('/path/to/Caller.swift');
  });

  it('referencesリクエストで通信エラーが発生した場合にgetReferencesが空配列を返すこと', async () => {
    await adapter.initialize('/test/project');

    const rpcSendRequestMock = (adapter as any).rpc.sendRequest as Mock;
    rpcSendRequestMock.mockRejectedValueOnce(new Error('LSP references error'));

    // 今回はcatchで空配列を返す実装になっているため
    const refs = await adapter.getReferences('file:///path/to/Def.swift#15#4');
    expect(refs).toHaveLength(0);
  });
});
