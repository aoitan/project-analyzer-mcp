# テストカバレッジの不足

## 概要

プロジェクトのテストカバレッジが不足しており、特にエラーケースや一部の機能のテストが網羅されていません。

## 詳細

### 優先度

高

### 問題点

- 各コンポーネント（`AnalysisService`, `SwiftParser`）におけるエラーケースのテストが不足しています（例: ファイル読み込み失敗、`SourceKitten`実行失敗、チャンク保存失敗など）。
- `AnalysisService` の `findFiles` および `findFunctions` メソッドのテストがありません。
- `SwiftParser` の `getLineNumber` メソッドの単体テストがありません。
- `server.ts` で定義されている `analyze_project` ツールのテストがありません。
- `zod` スキーマのバリデーションに関するテストがありません。

### 解決方法

- [ ] 各コンポーネントのエラーケースを網羅するテストを追加します。
- [ ] `AnalysisService` の `findFiles` および `findFunctions` メソッドのテストを追加します。
- [ ] `SwiftParser` の `getLineNumber` メソッドの単体テストを追加します。
- [ ] `server.ts` の `analyze_project` ツールのテストを追加します。
- [ ] `zod` スキーマのバリデーションが正しく機能することを検証するテストを追加します。

## その他

ロードマップの「フェーズ1: コア機能の強化と安定化」の「テストカバレッジの向上」に該当します。
