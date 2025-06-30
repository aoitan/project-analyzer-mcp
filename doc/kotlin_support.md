# Kotlin対応の現状とロードマップ

このドキュメントは、MCPサーバーにおけるKotlin言語サポートの現状と、今後の開発ロードマップを詳述します。

## 1. 現状のKotlin対応

現在のMCPサーバーは、モジュール式パーサー設計の導入により、Kotlinコードを解析するための基盤が構築されています。具体的には、以下の機能が実装されています。

- **モジュール式パーサー設計の導入**:
  - `IParser` インターフェースが定義され、各言語のパーサーがこのインターフェースを実装するようになりました。
  - `ParserFactory` が導入され、言語タイプ（例: "swift", "kotlin"）に基づいて適切なパーサーのインスタンスを提供するメカニズムが確立されました。
- **`KotlinParser` の実装**:
  - `IParser` インターフェースを実装する `KotlinParser` クラスが追加されました。
  - この `KotlinParser` は `ParserFactory` に登録されており、Kotlinファイル（`.kt` 拡張子）の解析リクエストがあった際に `AnalysisService` から利用されます。
- **`AnalysisService` との統合**:
  - `AnalysisService` は、解析対象のファイルの拡張子（`.swift` または `.kt`）に基づいて、`ParserFactory` から適切なパーサー（`SwiftParser` または `KotlinParser`）を取得し、解析を委譲するようになりました。

### 1.1. 現在の制限事項

現在の `KotlinParser` の実装は、**ダミーの解析ロジック**を含んでいます。

- `KotlinParser` の `parseFile` メソッドは、外部コマンドとして `kotlin-language-server` を呼び出すことを想定していますが、現時点ではその出力はモックされており、実際のKotlinコードの構文解析や意味解析は行っていません。
- 返される `CodeChunk` も、実際のKotlinコードの内容を反映したものではなく、ダミーのデータです。

## 2. 今後のロードマップ

Kotlinコードの本格的な解析機能の実現に向けて、以下のステップを計画しています。

### 2.1. `KotlinParser` の機能強化

- **実際の外部ツール連携**:
  - `KotlinParser` が `kotlin-language-server` や Kotlin Compiler API などの実際の外部ツールを呼び出し、その出力を取得するロジックを実装します。
- **`CodeChunk` への正確な変換**:
  - 外部ツールからの出力を、`CodeChunk` インターフェースに定義された形式（関数名、シグネチャ、型、コード内容、行番号、オフセット、長さ、呼び出し関係など）に正確に変換するロジックを実装します。
  - 特に、関数だけでなく、クラス、プロパティ、変数などのより多様なコード要素を `CodeChunk` として抽出できるように機能を拡張します。

### 2.1.1. Kotlin AST JSON出力CLIツールの開発

- **目的**: Kotlinソースコードをパースし、そのASTをJSON形式で標準出力に出力する独立したCLIツールを開発する。
- **理由**: `kotlin-language-server` はLSPに特化しており、直接ASTをJSONで出力する機能がないため。また、既存のKotlin ASTライブラリ（Kolasu, Kastreeなど）をNode.jsから直接利用するのが困難なため。
- **実装ステップ**:
    - [ ] Kotlinプロジェクトをセットアップし、必要な依存関係（例: `kotlin-compiler-embeddable`、`kotlinx.serialization`）を追加する。
    - [ ] Kotlin Compiler APIを使用してKotlinソースコードをパースし、ASTを構築するロジックを実装する。
    - [ ] 構築したASTを `CodeChunk` の要件に合わせたJSON形式に変換するロジックを実装する。
    - [ ] コマンドライン引数としてKotlinファイルのパスを受け取り、JSON出力を標準出力に書き出すCLIツールとしてパッケージングする（実行可能なJARファイルなど）。
    - [ ] ツールが正しく動作することを確認するための単体テストを作成する。（関連Issue: [add_tests_to_kotlin_parser_cli.md](issues/add_tests_to_kotlin_parser_cli.md)）

### 2.1.2. `KotlinParser` からCLIツールの呼び出しと`CodeChunk`変換

- **目的**: 開発したKotlin AST JSON出力CLIツールを `KotlinParser` から呼び出し、そのJSON出力を `CodeChunk` オブジェクトに変換する。
- **実装ステップ**:
    - [ ] `KotlinParser` の `parseFile` メソッド内で、`child_process` を使用してKotlin AST JSON出力CLIツールを実行する。
    - [ ] CLIツールの標準出力をキャプチャし、JSONをパースする。
    - [ ] パースしたJSONデータから `CodeChunk` オブジェクトを生成するロジックを実装する。
    - [ ] エラーハンドリングを強化し、CLIツールの実行失敗や不正なJSON出力に対応する。

### 2.2. テストカバレッジの向上

- 実際のKotlinコードファイルを使用した統合テストを追加し、`KotlinParser` が正しく機能することを確認します。
- エッジケース（コメントのみのファイル、構文エラーのあるファイルなど）に対するテストを追加します。

### 2.3. パフォーマンス最適化

- 大規模なKotlinコードベースを解析する際のパフォーマンスボトルネックを特定し、最適化を行います。
- チャンクのキャッシュ戦略や、外部ツールとの連携方法の効率化を検討します。

## 3. ロードマップにおける位置づけ

このKotlin対応のロードマップは、MCPサーバー開発ロードマップの「フェーズ2: 言語サポートの拡張」の一部を構成します。
