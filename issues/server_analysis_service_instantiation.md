# `src/server.ts` の `analysisService` インスタンス化に関する問題

## 概要

`src/server.ts` において `AnalysisService` のインスタンスがグローバルスコープで作成されており、`createMcpServer` 関数が複数回呼び出された場合に同じインスタンスが共有される可能性があります。

## 詳細

### 優先度

中

### 問題点

- `src/server.ts` の `analysisService` インスタンスがグローバルスコープで定義されているため、`createMcpServer` 関数が複数回呼び出された場合でも、常に同じ `AnalysisService` インスタンスが使用されます。
- 現在の実装では `AnalysisService` の `parsedProjects` キャッシュはインスタンスごとに独立しているため、直ちに問題にはなりませんが、将来的にサーバーが複数のクライアントからのリクエストを処理する場合や、`AnalysisService` がより多くのステートフルな情報を持つようになった場合に、予期せぬ副作用やテストの分離性の問題を引き起こす可能性があります。

### 解決方法

- [ ] `AnalysisService` のインスタンス化を `createMcpServer` 関数内で行うように修正します。これにより、`McpServer` インスタンスごとに独立した `AnalysisService` インスタンスが作成され、将来的な拡張性やテストの分離性が向上します。

## その他

ロードマップの「フェーズ1: コア機能の強化と安定化」の一部として対応を検討します。
