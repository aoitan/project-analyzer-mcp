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
    this.process = spawn(this.command, this.args);

    this.process.stdout?.on('data', (data: Buffer) => this.handleData(data));
    this.process.stderr?.on('data', (data: Buffer) => {
      logger.debug(`LSP Stderr: ${data.toString()}`);
    });

    this.process.on('close', (code) => {
      logger.info(`LSP process exited with code ${code}`);
      this.emit('close', code);
    });

    this.process.on('error', (err) => {
      logger.error(`LSP process error: ${err}`);
      this.emit('error', err);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
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
      if (!match) break;

      const contentLength = parseInt(match[1], 10);
      const headerLength = match[0].length;
      const totalLength = headerLength + contentLength;

      if (Buffer.byteLength(this.buffer, 'utf8') < totalLength) {
        break; // Wait for more data
      }

      // We have a full string. But string slicing vs byte slicing can be tricky if there's unicode.
      // Assuming stdout buffers don't split unicode characters in our buffer concatenation for now.
      const payloadString = this.buffer.slice(headerLength);
      const payloadBytes = Buffer.from(payloadString, 'utf8');

      const messageBytes = payloadBytes.slice(0, contentLength);
      const messageString = messageBytes.toString('utf8');

      this.buffer = payloadBytes.slice(contentLength).toString('utf8');

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
