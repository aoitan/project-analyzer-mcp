# MCPサーバー アーキテクチャ概要

## 1. 目的

このドキュメントは、大規模言語モデル（LLM）が広範なコードベースを理解し、操作するのを容易にするために設計されたMCP（Model Context Protocol）サーバーのアーキテクチャを概説します。このサーバーの主な機能は、大規模なソースコードファイルをより小さく、管理しやすい「コードチャンク」に分割し、それらの保存と取得を管理することです。

## 2. 主要要件

- **MCPサーバー実装**: TypeScriptとNode.jsを使用し、`@modelcontextprotocol/sdk` を活用して構築されます。
- **コードチャンク化**: 大規模なソースファイルを、LLMが扱いやすい小さなコードチャンクに解析する機能。特に、関数についてはシグネチャやコメントを含む関数全体のコードブロックを抽出します。具体的な言語サポートについては、[Swiftコード解析の詳細](swift_parsing_details.md)を参照してください。大きな関数の分割については、[大きな関数のコードチャンク化と表現方法](large_function_chunking.md)を参照してください。
- **モジュール式解析エンジン**: 新しい言語のサポートを容易に統合できるように、`IParser` インターフェースと `ParserFactory` を導入し、解析ロジックはモジュール化されています。
- **ローカルストレージとキャッシュ**: コードチャンクはファイルシステムとインメモリキャッシュを使用してローカルに保存されます。

## 3. アーキテクチャ図 (PlantUML)

```plantuml
@startuml

skinparam packageStyle rectangle
skinparam classAttributeIconSize 0

title MCP Server Architecture Overview

actor "Client (LLM/Agent)" as Client

package "MCP Server Application" {
  [MCP Server (src/server.ts)] as Server
  [Analysis Service (src/analysisService.ts)] as AnalysisService
  [Parser Factory (src/parserFactory.ts)] as ParserFactory
  [IParser Interface (src/interfaces/parser.ts)] as IParser
  [SwiftParser (src/swiftParser.ts)] as SwiftParser
  [KotlinParser (src/kotlinParser.ts)] as KotlinParser
}

package "Local Storage" {
  folder "Code Chunks (data/chunks/)" as ChunksStorage
  database "In-memory Cache\n(analysisService.parsedProjects)" as InMemoryCache
  database "Knowledge Graph\n(Future: SQLite DB)" as KnowledgeGraph
}

cloud "External Tools" {
  [Language Parser (e.g., SourceKitten, Kotlin Compiler)] as LanguageParser
}

Client --> Server : Calls Tools (analyze_project, get_chunk, list_functions_in_file, get_function_chunk)

Server --> AnalysisService : Orchestrates Analysis
AnalysisService --> ParserFactory : Requests Parser
ParserFactory ..> IParser : <<creates>>
SwiftParser .up.|> IParser : <<implements>>
KotlinParser .up.|> IParser : <<implements>>
ParserFactory --> SwiftParser : Uses specific parser
ParserFactory --> KotlinParser : Uses specific parser
SwiftParser --> LanguageParser : Code Analysis

AnalysisService --> ChunksStorage : Persists Code Chunks
AnalysisService --> InMemoryCache : Stores Parsed Data
AnalysisService --> KnowledgeGraph : Stores Knowledge Graph (Future)

@enduml
```

## 4. コンポーネントの内訳

### 4.1. MCPサーバー (`src/server.ts`)

- **役割**: アプリケーションのエントリーポイントです。MCPサーバーを初期化し、利用可能なツール（`analyze_project`、`get_chunk`、`list_functions_in_file`、`get_function_chunk`）を定義します。
- **責任**:
  - クライアント（LLM/エージェント）が対話するためのAPIエンドポイントを公開します。
  - 受信したリクエストを処理し、適切なサービスにディスパッチします。
  - ディレクトリトラバーサル脆弱性を防ぐために、安全なパス処理を保証します。

### 4.2. 解析サービス (`src/analysisService.ts`)

- **役割**: コード解析プロセスを統括し、解析されたコードチャンクの保存を管理します。
- **責任**:
  - MCPサーバーからプロジェクトファイルを解析するリクエストを受け取ります。
  - `ParserFactory` を介して適切なパーサーを取得し、実際の解析を委譲します。
  - 解析されたコードチャンクを高速な取得のためにインメモリキャッシュ（`parsedProjects`）に保存しています。
  - 長期保存のためにコードチャンクをローカルファイルシステムに永続化しています。チャンクの保存ディレクトリはコンストラクタで設定可能です。
  - ストアからの特定のコードチャンクの取得を管理します。

### 4.3. パーサーファクトリ (`src/parserFactory.ts`)

- **役割**: 言語タイプに基づいて適切なパーサーのインスタンスを提供する役割を担います。
- **責任**:
  - 登録されたパーサーの実装と言語タイプを紐付け、管理します。
  - 要求された言語に対応するパーサーのインスタンスを返します。
  - 未登録の言語のパーサーが要求された場合にエラーをスローします。

### 4.4. パーサーモジュール (`src/swiftParser.ts`, `src/kotlinParser.ts` など)

- **役割**: `IParser` インターフェースを実装し、外部の言語固有の解析ツールと連携して、その出力を標準化された `CodeChunk` 形式に変換する責任を負います。
- **責任**:
  - 言語固有の解析ツール（SourceKittenなど）を実行します。具体的なツールについては、[Swiftコード解析の詳細](swift_parsing_details.md)を参照してください。
  - Kotlinコードの解析については、[Kotlin対応の現状とロードマップ](kotlin_support.md)を参照してください。
  - 解析ツールからの生出力を `CodeChunk` オブジェクトに変換し、関連するメタデータ（名前、型、内容、行番号、依存関係）を抽出します。`CodeChunk` の定義は `src/interfaces/parser.ts` にあります。

### 4.5. ローカルストレージ

- **コードチャンク (`data/chunks/`)**: 個々のコードチャンクをJSONファイルとして永続化するための専用ディレクトリです。これにより、サーバーが再起動しても解析されたコードを取得できます。
- **インメモリキャッシュ (`analysisService.parsedProjects`)**: 最近解析された、または頻繁にアクセスされるコードチャンクを高速に取得するために保持するインメモリストアです。これにより、再解析やディスクからの読み込みの必要性を減らします。
- **ナレッジグラフ (将来: SQLite DB)**: コードチャンク間の関係と依存関係を保存するための計画されたコンポーネントです。高度なコード理解のための複雑なクエリとグラフトラバーサルを可能にするために、ローカルデータベース（例：SQLite）を使用して実装される予定です。

### 4.6. 外部ツール

- **言語パーサー**: `IParser` を実装するパーサーモジュールによって使用される、言語固有の解析ツールです。現在はSourceKittenを使用しています。

## 5. データフロー

1.  **クライアントリクエスト**: LLM/エージェントがMCPサーバーにリクエストを送信します（例：`analyze_project`、`get_chunk`、`list_functions_in_file`、`get_function_chunk`）。
2.  **解析の統括**: MCPサーバーはリクエストを `Analysis Service` に転送します。
3.  **パーサーの取得と解析**: 解析リクエストの場合、`Analysis Service` は `ParserFactory` を介して適切な言語の `IParser` 実装（例: `SwiftParser`）を取得し、そのパーサーに解析を委譲します。`IParser` 実装はターゲットコードファイルに対して言語固有の解析ツールを実行します。
4.  **データ変換**: `IParser` 実装は解析ツールからの生出力を `CodeChunk` オブジェクトに変換します。
5.  **保存**: `Analysis Service` は `CodeChunk` オブジェクトをインメモリキャッシュに保存し、`data/chunks/` ディレクトリに永続化します。
6.  **取得**: `get_chunk` リクエストの場合、`Analysis Service` は要求されたチャンクをインメモリキャッシュまたはファイルシステムから取得し、`{ content: string }` 形式で返します。
7.  **応答**: MCPサーバーは解析の概要または要求されたコードチャンクをクライアントに返します。

## 6. 各種図

システムの詳細な構造と動作を理解するために、以下の図を参照してください。

### 6.1. シーケンス図

LLM/AgentがMCPサーバーの各ツールを呼び出す際の主要なシーケンスを図示します。

- [analyze_project シーケンス図](diagrams/svg/sequence_analyze_project.svg)
- [get_chunk シーケンス図](diagrams/svg/sequence_get_chunk.svg)
- [list_functions_in_file シーケンス図](diagrams/svg/sequence_list_functions_in_file.svg)
- [get_function_chunk シーケンス図](diagrams/svg/sequence_get_function_chunk.svg)
- [find_file シーケンス図](diagrams/svg/sequence_find_file.svg)
- [find_function シーケンス図](diagrams/svg/sequence_find_function.svg)

### 6.2. クラス図

主要なクラスとその関係を図示します。

![クラス図](diagrams/svg/class_diagram.svg)

### 6.3. オブジェクト図

実行時のオブジェクトのインスタンスとその関係を図示します。

![オブジェクト図](diagrams/svg/object_diagram.svg)

### 6.4. コールグラフ図

主要な関数/メソッドの呼び出し関係を図示します。

![コールグラフ図](diagrams/svg/call_graph_diagram.svg)

### 6.5. データフロー図

主要なデータとその流れを図示します。

![データフロー図](diagrams/svg/data_flow_diagram.svg)

```

```
