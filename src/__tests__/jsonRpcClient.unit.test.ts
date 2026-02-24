import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JsonRpcClient } from '../utils/jsonRpcClient.js';
import { EventEmitter } from 'events';
import { Writable } from 'stream';

// child_process.spawnのモック用
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';

describe('JsonRpcClient', () => {
  let client: JsonRpcClient;
  let mockProcess: any;

  beforeEach(() => {
    mockProcess = new EventEmitter() as any;
    mockProcess.stdin = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn();

    (spawn as any).mockReturnValue(mockProcess);
    client = new JsonRpcClient('dummy-lsp', [], 200); // 200ms timeout for tests
  });

  afterEach(async () => {
    await client.stop();
    vi.clearAllMocks();
  });

  it('マルチバイト文字が分割されて届いても正しくパースできること', async () => {
    const startPromise = client.start();
    mockProcess.emit('spawn');
    await startPromise;

    const message = { jsonrpc: '2.0', id: 1, result: { value: 'こんにちは世界' } };
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    const fullData = Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from(json, 'utf8')]);

    // データの途中で分割して送る
    const part1 = fullData.slice(0, fullData.length - 5);
    const part2 = fullData.slice(fullData.length - 5);

    const promise = client.sendRequest('test', {});

    mockProcess.stdout.emit('data', part1);
    mockProcess.stdout.emit('data', part2);

    const result = await promise;
    expect(result).toEqual({ value: 'こんにちは世界' });
  });

  it('指定された時間内に応答がない場合にタイムアウトすること', async () => {
    const startPromise = client.start();
    mockProcess.emit('spawn');
    await startPromise;

    const promise = client.sendRequest('slow-method', {});

    await expect(promise).rejects.toThrow('LSP request timed out');
  });

  it('プロセスが予期せず終了した場合に保留中のリクエストが拒否されること', async () => {
    const startPromise = client.start();
    mockProcess.emit('spawn');
    await startPromise;

    const promise = client.sendRequest('test', {});

    // プロセス終了をシミュレート
    mockProcess.emit('close', 1, null);

    await expect(promise).rejects.toThrow('LSP process exited');
  });

  it('Content-Length以外のヘッダが混ざっていても正しくパースできること', async () => {
    const startPromise = client.start();
    mockProcess.emit('spawn');
    await startPromise;

    const message = { jsonrpc: '2.0', id: 1, result: 'ok' };
    const json = JSON.stringify(message);
    const header = `Content-Type: application/vscode-jsonrpc; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    const payload = Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from(json, 'utf8')]);

    const promise = client.sendRequest('test', {});
    mockProcess.stdout.emit('data', payload);

    const result = await promise;
    expect(result).toBe('ok');
  });
});
