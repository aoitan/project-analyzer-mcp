import { AnalysisAdapter } from '../interfaces/AnalysisAdapter.js';
import { GraphNode } from '../types.js';
import { JsonRpcClient } from '../utils/jsonRpcClient.js';
import logger from '../utils/logger.js';
import * as path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

/**
 * SourceKitLspAdapter Implementation
 * Swiftの解析に SourceKit-LSP を使用するアダプター。
 */
export class SourceKitLspAdapter implements AnalysisAdapter {
  private rpc: JsonRpcClient;
  private _initialized = false;

  constructor(command: string = 'sourcekit-lsp', args: string[] = []) {
    this.rpc = new JsonRpcClient(command, args);
  }

  /**
   * アダプタが初期化済みかどうかを返す。
   */
  get initialized(): boolean {
    return this._initialized;
  }

  async initialize(projectPath: string): Promise<void> {
    try {
      await this.rpc.start();

      // LSP Initialize Request
      const response = await this.rpc.sendRequest('initialize', {
        processId: process.pid,
        rootUri: pathToFileURL(path.resolve(projectPath)).toString(),
        capabilities: {
          textDocument: {
            references: { dynamicRegistration: false },
            definition: { dynamicRegistration: false },
          },
        },
      });

      // initialize responseからサポート情報を検証する
      const capabilities = (response as any)?.capabilities ?? (response as any)?.serverCapabilities;
      if (capabilities && capabilities.definitionProvider === false) {
        logger.info('SourceKit-LSP: definitionProvider is not supported by the server.');
      }

      this.rpc.sendNotification('initialized', {});
      this._initialized = true;
      logger.info(`SourceKit-LSP initialized for ${projectPath}`);
    } catch (error) {
      logger.error(`Failed to initialize SourceKit-LSP: ${error}`);
      await this.rpc.stop();
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this._initialized) {
        await this.rpc.sendRequest('shutdown', null);
        this.rpc.sendNotification('exit', null);
      }
    } catch (error) {
      logger.warn(`Error during LSP shutdown request: ${error}`);
    } finally {
      await this.rpc.stop();
      this._initialized = false;
      logger.info('SourceKit-LSP shutdown complete');
    }
  }

  async getSymbolAtPoint(
    filePath: string,
    line: number,
    column: number,
  ): Promise<GraphNode | null> {
    if (!this._initialized) throw new Error('SourceKit-LSP is not initialized');

    try {
      const uri = pathToFileURL(path.resolve(filePath)).toString();
      const response = await this.rpc.sendRequest('textDocument/definition', {
        textDocument: { uri },
        position: { line: line - 1, character: column - 1 }, // LSP is 0-indexed
      });

      if (!response || (Array.isArray(response) && response.length === 0)) {
        return null;
      }

      // Location または LocationLink の両方に対応
      const loc = Array.isArray(response) ? response[0] : response;
      const targetUri = loc.uri || loc.targetUri;
      const range = loc.range || loc.targetSelectionRange;

      if (!targetUri || !range) return null;

      return {
        id: `${targetUri}#${range.start.line}#${range.start.character}`,
        name: 'ResolvedSymbol', // TODO: 実際の名前を取得するには hover 等が追加で必要になる場合がある
        kind: 'function', // TODO: LSPのSymbolKind等から適切なマッピングを行う必要がある
        filePath: fileURLToPath(targetUri),
      };
    } catch (error) {
      logger.error(`Failed to get symbol at ${filePath}:${line}:${column} via LSP: ${error}`);
      return null;
    }
  }

  async getReferences(symbolId: string): Promise<GraphNode[]> {
    if (!this._initialized) throw new Error('SourceKit-LSP is not initialized');

    // ID形式: "uri#line#col" からパース
    // URI自体に # が含まれる可能性を考慮し、末尾からパースする
    const match = symbolId.match(/^(.*)#(\d+)#(\d+)$/);
    if (!match) {
      logger.warn(
        `Invalid symbolId format in getReferences: "${symbolId}". Expected "uri#line#col".`,
      );
      return [];
    }

    const uri = match[1];
    const line = parseInt(match[2], 10);
    const character = parseInt(match[3], 10);

    try {
      const response = await this.rpc.sendRequest('textDocument/references', {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: false },
      });

      if (!response || !Array.isArray(response)) return [];

      return response.map((loc) => {
        const targetUri = loc.uri || loc.targetUri;
        const range = loc.range || loc.targetSelectionRange;
        return {
          id: `${targetUri}#${range.start.line}#${range.start.character}`,
          name: 'Reference',
          kind: 'function',
          filePath: fileURLToPath(targetUri),
        };
      });
    } catch (error) {
      logger.error(`Failed to get references for ${symbolId}: ${error}`);
      return [];
    }
  }

  async getOutgoingCalls(symbolId: string): Promise<GraphNode[]> {
    if (!this._initialized) throw new Error('SourceKit-LSP is not initialized');

    // SourceKit-LSP では 'textDocument/prepareCallHierarchy' 以降の独自リクエストが必要
    // 詳細な実装はPhase 2（コールグラフAPI）で強化する。ここではスタブ。
    return [];
  }
}
