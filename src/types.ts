// src/types.ts

// コードチャンクを表すインターフェース
export interface CodeChunk {
  id: string; // ユニークなID (例: ファイル名_関数名_行番号)
  name: string; // 関数名/メソッド名
  signature: string; // Full function signature
  type: string; // 型の正確な判別
  content: string; // コードの内容
  filePath: string; // 元のファイルパス
  startLine: number; // 開始行番号
  endLine: number; // 終了行番号
  offset: number; // ファイル内でのバイトオフセット（SourceKittenから取得）
  length: number; // コードのバイト長（SourceKittenから取得）
  calls: string[]; // このチャンクが呼び出していると推測される関数/メソッド名
  children?: SourceKittenStructure[]; // 子要素（クラス内のメソッドなど）
}

// 依存関係（簡易版）を保持するマップ
export interface SimpleDependencyGraph {
  [chunkId: string]: CodeChunk;
}

// SourceKittenの出力構造の一部を簡易的に定義
// 実際にはもっと複雑ですが、必要な部分のみ抜粋
export interface SourceKittenStructure {
  key: string;
  value?: any;
  kind: string; // source.lang.swift.decl.function.method, source.lang.swift.decl.function.free, etc.
  name?: string;
  USR?: string; // Unified Symbol Resolution - シンボルの一意な識別子
  line?: number;
  column?: number;
  offset?: number; // byte offset
  length?: number; // byte length
  bodyoffset?: number; // body byte offset
  bodylength?: number; // body byte length
  substructure?: SourceKittenStructure[];
}
