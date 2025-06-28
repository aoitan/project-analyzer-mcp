# `src/parser.ts` の `getFunctionContent` における `parseFile` の再呼び出し

## 概要

`src/parser.ts` の `getFunctionContent` メソッド内で `parseFile` が再呼び出しされており、非効率です。

## 詳細

### 優先度

中

### 問題点

- `getFunctionContent` メソッド内で `this.parseFile(filePath)` を再度呼び出しています。これは、同じファイルを二度解析することになり、非効率的です。
- `AnalysisService` が `CodeChunk` をキャッシュしているため、`getFunctionContent` はキャッシュされた `CodeChunk` を利用するか、`parseFile` の呼び出し元で `CodeChunk` のリストを渡すように設計すべきです。

### 解決方法

- [ ] `getFunctionContent` の引数を変更し、すでに解析済みの `CodeChunk` オブジェクトを受け取るようにします。
- [ ] `getFunctionContent` メソッド内の `this.parseFile(filePath)` の呼び出しを削除します。

## その他

ロードマップの「フェーズ1: コア機能の強化と安定化」の一部として対応を検討します。
