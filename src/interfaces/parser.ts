// src/interfaces/parser.ts

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
  children?: any[]; // 子要素（クラス内のメソッドなど）
  // ページング関連のメタデータ
  isPartial?: boolean; // このチャンクが完全なコードチャンクの一部である場合に true
  totalLines?: number; // 元の巨大関数の総行数
  currentPage?: number; // 現在のチャンクが何ページ目か
  totalPages?: number; // 元の巨大関数の総ページ数
  nextPageToken?: string; // 次のページをリクエストするためのトークン
  prevPageToken?: string; // 前のページをリクエストするためのトークン
}

export interface IParser {
  parseFile(filePath: string): Promise<CodeChunk[]>;
}
