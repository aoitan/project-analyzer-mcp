# Issue: CI におけるフル統合テストの自動化

## 現状
最小限の CI (Step 1) では、実行環境の構築が複雑なため、以下のツールに依存するテストをスキップしている：
- `sourcekitten` (Swift コード解析)
- `sourcekit-lsp` (LSP 連携)
- `kotlin-parser-cli` (Kotlin コード解析 - 実機実行)

## 課題
- Linux (Ubuntu) 環境での Swift ツールチェーンのセットアップ手順の確立。
- macOS runner を使用する場合のコスト最適化。
- 外部バイナリに依存するテストを、どのように隔離・実行するか。

## 解決案
1. Docker コンテナ（Swift プリインストールイメージ）を使用したテスト実行。
2. 結合テストのみを `macos-latest` で実行し、それ以外を `ubuntu-latest` で実行するマトリックス構成。
3. 外部ツールの実行結果を記録（VCR的な手法）し、CI上では実機なしでテストを回す。
