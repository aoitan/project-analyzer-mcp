// src/types.ts

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
  substructure?: any[];
}
