import { AnalysisAdapter } from '../interfaces/AnalysisAdapter.js';
import { GraphNode } from '../types.js';
import { JsonRpcClient } from '../utils/jsonRpcClient.js';
import logger from '../utils/logger.js';
import * as path from 'path';

export class SourceKitLspAdapter implements AnalysisAdapter {
  private rpc: JsonRpcClient;
  private isInitialized = false;

  constructor(command: string = 'sourcekit-lsp', args: string[] = []) {
    this.rpc = new JsonRpcClient(command, args);
  }

  async initialize(projectPath: string): Promise<void> {
    await this.rpc.start();

    // LSP Initialize Request
    const response = await this.rpc.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${path.resolve(projectPath)}`,
      capabilities: {
        textDocument: {
          references: { dynamicRegistration: false },
          definition: { dynamicRegistration: false },
        },
      },
    });

    this.rpc.sendNotification('initialized', {});
    this.isInitialized = true;
    logger.info(`SourceKit-LSP initialized for ${projectPath}`);
  }

  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await this.rpc.sendRequest('shutdown', null);
      this.rpc.sendNotification('exit', null);
      await this.rpc.stop();
      this.isInitialized = false;
      logger.info('SourceKit-LSP shutdown complete');
    }
  }

  async getSymbolAtPoint(
    filePath: string,
    line: number,
    column: number,
  ): Promise<GraphNode | null> {
    if (!this.isInitialized) throw new Error('SourceKit-LSP is not initialized');

    try {
      // 実際には definition または documentSymbol などを引く
      // 今回は 'textDocument/definition' や 'textDocument/hover' 等のLSPメソッドを想定した例
      const response = await this.rpc.sendRequest('textDocument/definition', {
        textDocument: { uri: `file://${path.resolve(filePath)}` },
        position: { line: line - 1, character: column - 1 }, // LSP is 0-indexed
      });

      if (!response || (Array.isArray(response) && response.length === 0)) {
        return null;
      }

      const loc = Array.isArray(response) ? response[0] : response;
      return {
        id: loc.uri + '#' + loc.range.start.line,
        name: 'ResolvedSymbol', // 実際の名前を取得するには hover 等が追加で必要になる場合がある
        kind: 'function',
        filePath: loc.uri.replace('file://', ''),
      };
    } catch (error) {
      logger.error(`Failed to get symbol at ${filePath}:${line}:${column} via LSP: ${error}`);
      return null;
    }
  }

  async getReferences(symbolId: string): Promise<GraphNode[]> {
    if (!this.isInitialized) throw new Error('SourceKit-LSP is not initialized');

    // Note: LLMやMCPから来る symbolId をどう LSPのURI+Positionに復元するかのマッピングが必要
    // 本実装ではプロトタイプとして、ID形式を "file:///path#line#col" のような形と仮定する
    const parts = symbolId.split('#');
    if (parts.length < 3) return [];
    const uri = parts[0];
    const line = parseInt(parts[1], 10);
    const character = parseInt(parts[2], 10);

    try {
      const response = await this.rpc.sendRequest('textDocument/references', {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: false },
      });

      if (!response || !Array.isArray(response)) return [];

      return response.map((loc) => ({
        id: `${loc.uri}#${loc.range.start.line}#${loc.range.start.character}`,
        name: 'Reference',
        kind: 'function',
        filePath: loc.uri.replace('file://', ''),
      }));
    } catch (error) {
      logger.error(`Failed to get references for ${symbolId}: ${error}`);
      return [];
    }
  }

  async getOutgoingCalls(symbolId: string): Promise<GraphNode[]> {
    if (!this.isInitialized) throw new Error('SourceKit-LSP is not initialized');

    // SourceKit-LSP では 'textDocument/prepareCallHierarchy' 以降の独自リクエストが必要
    // 詳細な実装はPhase 2（コールグラフAPI）で強化する。ここではスタブ。
    return [];
  }
}
