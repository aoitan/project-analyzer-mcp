# `parser.ts` のリファクタリングと命名規則の改善

## 概要

現在の `src/parser.ts` ファイルは実質的に `SwiftParser` の実装を含んでおり、ファイル名がその内容を正確に反映していません。また、`IParser` インターフェースや共通のユーティリティ関数など、パーサー一般に必要な部分と、特定の言語（Swift）に特化した実装が混在しています。このIssueは、これらの問題を解決するためのリファクタリングを提案します。

## 詳細

### 優先度

中

### 問題点

- `src/parser.ts` というファイル名が、`SwiftParser` の実装に特化している現状と一致していません。
- パーサー一般に共通するロジック（例: `getLineNumber`、`exec` のデフォルト実装）と、`SwiftParser` 固有のロジックが同じファイル内に混在しており、コードの責務が不明確です。

### 解決方法

以下のいずれかのアプローチで解決します。

#### アプローチ1: ファイル名を変更し、共通部分を抽出する

- [ ] `src/parser.ts` を `src/swiftParser.ts` にリネームします。
- [ ] `IParser` インターフェースや、`getLineNumber`、`defaultExec` など、パーサー一般に共通する部分を `src/baseParser.ts` または `src/parserUtils.ts` のような新しいファイルに抽出します。
- [ ] `SwiftParser` および将来の `KotlinParser` が、抽出された共通部分をインポートして利用するように修正します。

#### アプローチ2: `parser.ts` を共通部分のみとし、`SwiftParser` を分離する

- [ ] `src/parser.ts` から `SwiftParser` の実装を削除し、`src/swiftParser.ts` という新しいファイルに移動します。
- [ ] `src/parser.ts` には、`IParser` インターフェースや、`getLineNumber`、`defaultExec` など、パーサー一般に共通する部分のみを残します。
- [ ] `SwiftParser` および将来の `KotlinParser` が、`src/parser.ts` から共通部分をインポートして利用するように修正します。

### 検討事項

- どちらのアプローチが、将来的な言語追加や機能拡張に対してより柔軟性を提供するかを検討します。
- 既存のコードベースへの影響を最小限に抑える方法を検討します。

## その他

コードの可読性と保守性を向上させるための重要なリファクタリングです。