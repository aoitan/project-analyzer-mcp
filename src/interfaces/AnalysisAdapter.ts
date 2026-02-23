import { GraphNode, GraphEdge } from '../types.js';

/**
 * AnalysisAdapter Interface
 *
 * 既存の言語サーバー（LSP等）やTree-sitterなどの解析ツールへ
 * クエリを委譲するためのインターフェース。
 * LLM（MCP）向けに、正確な参照解決やコールグラフ抽出などを提供する。
 */
export interface AnalysisAdapter {
  /**
   * アダプタの初期化処理（LSPプロセスの起動など）
   */
  initialize(projectPath: string): Promise<void>;

  /**
   * アダプタの終了処理（LSPプロセスのシャットダウンなど）
   */
  shutdown(): Promise<void>;

  /**
   * 指定したファイルの指定行・列にあるシンボル情報を取得する
   * @param filePath ファイルの絶対パス
   * @param line 1-indexedの行番号
   * @param column 1-indexedの列番号
   * @returns シンボル情報を表すGraphNode（見つからない場合はnull）
   */
  getSymbolAtPoint(filePath: string, line: number, column: number): Promise<GraphNode | null>;

  /**
   * 指定したシンボル（USRやシグネチャ）の参照元（Caller）一覧を取得する
   * @param symbolId シンボルの識別子（GraphNodeのidに相当）
   * @returns 参照元のGraphNodeリスト
   */
  getReferences(symbolId: string): Promise<GraphNode[]>;

  /**
   * 指定した関数シンボルが内部で呼び出している先（Callee）一覧を取得する
   * @param symbolId シンボルの識別子
   * @returns 呼び出し先のGraphNodeリスト
   */
  getOutgoingCalls(symbolId: string): Promise<GraphNode[]>;
}
