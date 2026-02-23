import { CodeChunk } from './interfaces/parser.js';

// src/types.ts

// 依存関係（簡易版）を保持するマップ
export interface SimpleDependencyGraph {
  [chunkId: string]: CodeChunk;
}

// ナレッジグラフ用のノード構造
export interface GraphNode {
  id: string; // 一意な識別子（USRやシグネチャなど）
  name: string;
  kind: 'class' | 'function' | 'property' | 'interface' | 'protocol' | 'module';
  filePath: string;
  metadata?: any; // 自然言語要約などの付加情報
}

// ナレッジグラフ用のエッジ構造
export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationship: 'calls' | 'called_by' | 'inherits' | 'implements' | 'depends_on' | 'contains';
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
