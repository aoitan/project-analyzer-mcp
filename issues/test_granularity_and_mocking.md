# テスト: 粒度とモックの利用に関する改善

## 概要

現在の `server.test.ts` は結合テストとして機能していますが、`AnalysisService` や `SwiftParser` の内部ロジックの変更が直接テストに影響を与え、問題の特定が難しい場合があります。また、テストの実行速度にも影響を与える可能性があります。

## 詳細

### 優先度

中

### 問題点

- `server.test.ts` は `AnalysisService` と `SwiftParser` の実際のインスタンスを使用しており、これらコンポーネントの内部実装に強く依存しています。これにより、テストが遅くなったり、問題の切り分けが難しくなったりします。
- 各コンポーネントの単体テストが不足しており、個々の機能が独立して正しく動作することを保証できていません。

### 解決方法

- [ ] `src/analysisService.ts` と `src/parser.ts` に対して、それぞれ独立したユニットテストファイル（例: `src/__tests__/analysisService.unit.test.ts`, `src/__tests__/parser.unit.test.ts`）を作成します。
- [ ] これらのユニットテストでは、依存関係（例: `SwiftParser` の `execPromise` や `fs`、`AnalysisService` の `SwiftParser`）をVitestのモックAPIを使用してモックし、各コンポーネントの単体機能を隔離してテストできるようにします。
- [ ] `server.test.ts` では、`AnalysisService` をモックし、`analyzeProject` や `getChunk` などのメソッドが期待通りに呼び出されることを検証します。これにより、`server.ts` の責任範囲（ツールの登録とルーティング）に焦点を当てたテストが可能になります。

## その他

ロードマップの「フェーズ1: コア機能の強化と安定化」の「テストカバレッジの向上」に該当します。
