# Swiftコード解析の詳細

## 1. Swiftコードチャンク化
MCPサーバーは、大規模なSwiftソースファイルを、LLMが扱いやすい小さなコードチャンクに解析する機能をサポートします。将来的にはKotlinなどの他の言語もサポートする予定です。

## 2. 外部ツール: SourceKitten
`SourceKitten` は、AppleのSourceKitと統合し、Swiftコードに関する構造化された情報を提供するコマンドラインツールです。`Parser` モジュールによってSwift解析に使用されます。

## 3. パーサーモジュールにおけるSwift解析の責任
`Parser` モジュールは、Swiftコード解析のために `SourceKitten` を実行し、その生出力を標準化された `CodeChunk` 形式に変換する責任を負います。
