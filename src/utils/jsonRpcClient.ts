import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import logger from './logger.js';

/**
 * JSON-RPC over Standard Streams Client
 * LSPなどの標準入出力を介したJSON-RPC通信を管理する。
 */
export class JsonRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: any) => void; timer?: NodeJS.Timeout }
  >();
  private buffer: Buffer = Buffer.alloc(0);

  constructor(
    private command: string,
    private args: string[] = [],
    private requestTimeoutMs: number = 30000,
  ) {
    super();
  }

  /**
   * 外部プロセスを起動し、通信を開始する。
   */
  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const child = spawn(this.command, this.args);
        this.process = child;

        let settled = false;

        child.stdout?.on('data', (data: Buffer) => this.handleData(data));
        child.stderr?.on('data', (data: Buffer) => {
          logger.debug(`LSP Stderr: ${data.toString()}`);
        });

        // プロセス終了時のハンドリング（恒久的に監視）
        const handleProcessExit = (code: number | null, signal: string | null) => {
          const error = new Error(`LSP process exited (code: ${code}, signal: ${signal})`);
          this.cleanupPendingRequests(error);
          this.process = null;
          this.emit('close', code, signal);
        };

        const handleProcessError = (err: Error) => {
          logger.error(`LSP process error: ${err}`);
          this.cleanupPendingRequests(err);
          this.emit('error', err);
        };

        child.on('error', (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
          handleProcessError(err);
        });

        child.on('close', (code, signal) => {
          if (!settled) {
            settled = true;
            reject(new Error(`LSP process exited before it was ready (code ${code})`));
          }
          handleProcessExit(code, signal);
        });

        child.once('spawn', () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 保留中のすべてのリクエストを破棄（reject）する。
   */
  private cleanupPendingRequests(error: Error) {
    for (const { reject, timer } of this.pendingRequests.values()) {
      if (timer) clearTimeout(timer);
      try {
        reject(error);
      } catch (e) {
        // Ignore user handler errors
      }
    }
    this.pendingRequests.clear();
  }

  /**
   * 外部プロセスを停止する。
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.cleanupPendingRequests(new Error('LSP process stopped: pending requests cancelled'));
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * JSON-RPCリクエストを送信する。
   */
  async sendRequest(method: string, params: any): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('LSP process is not running');
    }

    const id = this.messageId++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const json = JSON.stringify(message);
    const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;

    return new Promise((resolve, reject) => {
      // タイムアウト設定
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request timed out: ${method} (id=${id})`));
        }
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });

      this.process!.stdin!.write(payload, 'utf8', (err) => {
        if (err) {
          if (this.pendingRequests.has(id)) {
            clearTimeout(timer);
            this.pendingRequests.delete(id);
          }
          reject(err);
        }
      });
    });
  }

  /**
   * JSON-RPC通知を送信する。
   */
  sendNotification(method: string, params: any): void {
    if (!this.process || !this.process.stdin) return;

    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };
    const json = JSON.stringify(message);
    const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
    this.process.stdin.write(payload, 'utf8');
  }

  /**
   * 受信データを解析し、メッセージ単位で処理する。
   */
  private handleData(data: Buffer) {
    // バイト配列としてバッファリングし、マルチバイト文字の分断を防ぐ
    this.buffer = Buffer.concat([this.buffer, data]);

    while (true) {
      // ヘッダとボディの区切りを探す
      const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) break;

      const headers = this.buffer.slice(0, headerEndIndex).toString('ascii');
      const contentLengthMatch = headers.match(/Content-Length: (\d+)/i);
      if (!contentLengthMatch) {
        // 不正なヘッダまたはContent-Length欠如の場合はスキップ
        logger.warn('LSP received message without Content-Length');
        this.buffer = this.buffer.slice(headerEndIndex + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStartIndex = headerEndIndex + 4;
      const totalLength = messageStartIndex + contentLength;

      // ボディがすべて届くまで待機
      if (this.buffer.length < totalLength) break;

      const messageBytes = this.buffer.slice(messageStartIndex, totalLength);
      this.buffer = this.buffer.slice(totalLength);

      try {
        const messageString = messageBytes.toString('utf8');
        const message = JSON.parse(messageString);
        this.handleMessage(message);
      } catch (err) {
        logger.error(`Failed to parse LSP message: ${err}`);
      }
    }
  }

  /**
   * 解析済みメッセージを処理し、リクエストを解決する。
   */
  private handleMessage(message: any) {
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // サーバーからの通知
      this.emit('notification', message);
    }
  }
}
