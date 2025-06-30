# Kotlin AST JSON出力CLIツールの開発

## 概要

Kotlinソースコードをパースし、そのASTをJSON形式で標準出力に出力する独立したCLIツールを開発します。

## 詳細

### 優先度

高

### 問題点

- 現在の`KotlinParser`はモックデータを使用しており、実際のKotlinコードのASTを生成できません。
- `kotlin-language-server`はLSPに特化しており、直接ASTをJSONで出力する機能がありません。
- 既存のKotlin ASTライブラリ（Kolasu, Kastreeなど）をNode.jsから直接利用するのが困難です。

### 解決方法

- [x] Kotlinプロジェクトをセットアップし、必要な依存関係（例: `kotlin-compiler-embeddable`、`kotlinx.serialization`）を追加する。
- [x] Kotlin Compiler APIを使用してKotlinソースコードをパースし、ASTを構築するロジックを実装する。
- [x] 構築したASTを `CodeChunk` の要件に合わせたJSON形式に変換するロジックを実装する。
- [x] コマンドライン引数としてKotlinファイルのパスを受け取り、JSON出力を標準出力に書き出すCLIツールとしてパッケージングする（実行可能なJARファイルなど）。
- [x] ツールが正しく動作することを確認するための単体テストを作成する。

## その他

ロードマップの「フェーズ2: 言語サポートの拡張」の一部であり、[Kotlin対応の現状とロードマップ](doc/kotlin_support.md)の「2.1.1. Kotlin AST JSON出力CLIツールの開発」に該当します。
