# `CodeChunk` インターフェースの重複定義と型定義の不整合

## 概要

`CodeChunk` インターフェースが `src/parser.ts` と `src/types.ts` の両方で定義されており、型定義に不整合があります。

## 詳細

### 優先度

高

### 問題点

- `CodeChunk` インターフェースが複数のファイルで定義されており、重複しています。
- `src/parser.ts` と `src/types.ts` の `CodeChunk` 定義間でプロパティの有無や型に不整合があります（例: `offset`, `length`, `bodyOffset`, `bodyLength`, `type`）。
- これにより、型安全性が損なわれ、コードの保守性が低下します。

### 解決方法

- [ ] `src/parser.ts` の `CodeChunk` 定義を削除し、`src/types.ts` の定義を使用するように一元化します。
- [ ] `src/types.ts` の `CodeChunk` に、必要なすべてのプロパティ（`offset`, `length` など）を追加します。
- [ ] `bodyOffset` と `bodyLength` は `SourceKitten` の生データの一部であり、`CodeChunk` の最終的な表現には不要なため、`CodeChunk` から削除することを検討します。
- [ ] `CodeChunk` の `type` プロパティをより汎用的な `string` 型にするか、`SourceKitten` の `key.kind` を `CodeChunk` の `type` にマッピングするロジックを `parser.ts` に追加します。
- [ ] `CodeChunk` の `content` プロパティを必須とし、`parser.ts` の `parseFile` で初期化するようにします。

## その他

ロードマップの「フェーズ1: コア機能の強化と安定化」の一部として対応を検討します。
