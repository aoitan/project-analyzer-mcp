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
      const position = { line: line - 1, character: column - 1 };

      // まず Prepare Call Hierarchy を試して、詳細なシンボル情報（名前、種類）を取得する
      try {
        const prepareResponse = await this.rpc.sendRequest('textDocument/prepareCallHierarchy', {
          textDocument: { uri },
          position,
        });

        if (prepareResponse && Array.isArray(prepareResponse) && prepareResponse.length > 0) {
          const item = prepareResponse[0];
          return {
            id: `${item.uri}#${item.range.start.line}#${item.range.start.character}`,
            name: item.name,
            kind: this.mapSymbolKind(item.kind),
            filePath: fileURLToPath(item.uri),
          };
        }
      } catch (e) {
        // prepareCallHierarchy が未対応または失敗した場合は、フォールバックとして definition を試す
        logger.debug(
          `prepareCallHierarchy failed or not supported, falling back to definition: ${e}`,
        );
      }

      // フォールバック: textDocument/definition
      const response = await this.rpc.sendRequest('textDocument/definition', {
        textDocument: { uri },
        position, // LSP is 0-indexed
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
        name: 'ResolvedSymbol',
        kind: 'function', // definitionからはkindが取得できないためフォールバック
        filePath: fileURLToPath(targetUri),
      };
    } catch (error) {
      logger.error(`Failed to get symbol at ${filePath}:${line}:${column} via LSP: ${error}`);
      return null;
    }
  }

  private parseSymbolId(symbolId: string): { uri: string; line: number; character: number } | null {
    const match = symbolId.match(/^(.*)#(\d+)#(\d+)$/);
    if (!match) {
      logger.warn(`Invalid symbolId format: "${symbolId}". Expected "uri#line#col".`);
      return null;
    }
    return {
      uri: match[1],
      line: parseInt(match[2], 10),
      character: parseInt(match[3], 10),
    };
  }

  private mapSymbolKind(kind?: number): GraphNode['kind'] {
    switch (kind) {
      case 1:
        return 'file';
      case 2:
        return 'module';
      case 3:
        return 'namespace';
      case 4:
        return 'package';
      case 5:
        return 'class';
      case 6:
        return 'method';
      case 7:
        return 'property';
      case 8:
        return 'field';
      case 9:
        return 'constructor';
      case 10:
        return 'enum';
      case 11:
        return 'interface';
      case 12:
        return 'function';
      case 13:
        return 'variable';
      case 14:
        return 'constant';
      default:
        return 'function'; // fallback
    }
  }

  async getReferences(symbolId: string): Promise<GraphNode[]> {
    if (!this._initialized) throw new Error('SourceKit-LSP is not initialized');

    const pos = this.parseSymbolId(symbolId);
    if (!pos) return [];

    try {
      // 1. Prepare Call Hierarchy
      const prepareResponse = await this.rpc.sendRequest('textDocument/prepareCallHierarchy', {
        textDocument: { uri: pos.uri },
        position: { line: pos.line, character: pos.character },
      });

      if (!prepareResponse || !Array.isArray(prepareResponse) || prepareResponse.length === 0) {
        return [];
      }

      const item = prepareResponse[0];

      // 2. Get Incoming Calls
      const incomingResponse = await this.rpc.sendRequest('callHierarchy/incomingCalls', {
        item,
      });

      if (!incomingResponse || !Array.isArray(incomingResponse)) return [];

      return incomingResponse.map((call) => {
        const source = call.from;
        return {
          id: `${source.uri}#${source.range.start.line}#${source.range.start.character}`,
          name: source.name,
          kind: this.mapSymbolKind(source.kind),
          filePath: fileURLToPath(source.uri),
        };
      });
    } catch (error) {
      logger.error(`Failed to get incoming calls for ${symbolId}: ${error}`);
      return [];
    }
  }

  async getOutgoingCalls(symbolId: string): Promise<GraphNode[]> {
    if (!this._initialized) throw new Error('SourceKit-LSP is not initialized');

    const pos = this.parseSymbolId(symbolId);
    if (!pos) return [];

    try {
      // 1. Prepare Call Hierarchy
      const prepareResponse = await this.rpc.sendRequest('textDocument/prepareCallHierarchy', {
        textDocument: { uri: pos.uri },
        position: { line: pos.line, character: pos.character },
      });

      if (!prepareResponse || !Array.isArray(prepareResponse) || prepareResponse.length === 0) {
        return [];
      }

      const item = prepareResponse[0];

      // 2. Get Outgoing Calls
      const outgoingResponse = await this.rpc.sendRequest('callHierarchy/outgoingCalls', {
        item,
      });

      if (!outgoingResponse || !Array.isArray(outgoingResponse)) return [];

      return outgoingResponse.map((call) => {
        const target = call.to;
        return {
          id: `${target.uri}#${target.range.start.line}#${target.range.start.character}`,
          name: target.name,
          kind: this.mapSymbolKind(target.kind),
          filePath: fileURLToPath(target.uri),
        };
      });
    } catch (error) {
      logger.error(`Failed to get outgoing calls for ${symbolId}: ${error}`);
      return [];
    }
  }
}
