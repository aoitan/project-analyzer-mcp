import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import logger from './logger.js';

export class JsonRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();
  private buffer = '';

  constructor(
    private command: string,
    private args: string[] = [],
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.process) {
      // Process already started; nothing to do.
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const child = spawn(this.command, this.args);
      this.process = child;

      let settled = false;

      child.stdout?.on('data', (data: Buffer) => this.handleData(data));
      child.stderr?.on('data', (data: Buffer) => {
        logger.debug(`LSP Stderr: ${data.toString()}`);
      });

      const onError = (err: Error) => {
        logger.error(`LSP process error: ${err}`);
        this.emit('error', err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      };

      const onClose = (code: number | null) => {
        logger.info(`LSP process exited with code ${code}`);
        this.emit('close', code);
        this.process = null;
        if (!settled) {
          settled = true;
          reject(new Error(`LSP process exited before it was ready (code ${code})`));
        }
      };

      const onSpawn = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
        child.removeListener('error', onError);
        child.removeListener('close', onClose);
      };

      child.on('close', onClose);
      child.on('error', onError);
      child.once('spawn', onSpawn);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      const error = new Error('LSP process stopped: pending requests cancelled');
      for (const { reject } of this.pendingRequests.values()) {
        try {
          reject(error);
        } catch {
          // Ignore errors thrown by user-provided reject handlers
        }
      }
      this.pendingRequests.clear();

      this.process.kill();
      this.process = null;
    }
  }

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
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin!.write(payload, 'utf8', (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
    });
  }

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

  private handleData(data: Buffer) {
    this.buffer += data.toString('utf8');

    while (true) {
      const match = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/);
      if (!match || match.index === undefined) break;

      const contentLength = parseInt(match[1], 10);
      const headerEndIndex = match.index + match[0].length;
      const headerString = this.buffer.slice(0, headerEndIndex);
      const headerLengthBytes = Buffer.byteLength(headerString, 'utf8');
      const totalLengthBytes = headerLengthBytes + contentLength;

      if (Buffer.byteLength(this.buffer, 'utf8') < totalLengthBytes) {
        break; // Wait for more data
      }

      // Convert entire accumulated buffer to bytes and slice using byte offsets
      const bufferBytes = Buffer.from(this.buffer, 'utf8');
      const messageBytes = bufferBytes.slice(headerLengthBytes, headerLengthBytes + contentLength);
      const remainingBytes = bufferBytes.slice(headerLengthBytes + contentLength);

      const messageString = messageBytes.toString('utf8');
      this.buffer = remainingBytes.toString('utf8');

      try {
        const message = JSON.parse(messageString);
        this.handleMessage(message);
      } catch (err) {
        logger.error(`Failed to parse LSP message: ${err}`);
      }
    }
  }

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
      // Handle notifications from server
      this.emit('notification', message);
    }
  }
}
