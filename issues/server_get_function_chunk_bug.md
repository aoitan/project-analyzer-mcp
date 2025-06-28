# `src/server.ts` の `get_function_chunk` コールバックのバグ

## 概要

`src/server.ts` の `get_function_chunk` ツールのコールバックが、誤った `AnalysisService` メソッドを呼び出しています。

## 詳細

### 優先度

高

### 問題点

- `get_function_chunk` ツールのコールバックは、`analysisService.getChunk(input.chunkId)` を呼び出していますが、本来は `analysisService.getFunctionChunk(input.filePath, input.functionSignature)` を呼び出すべきです。
- また、入力スキーマは `filePath` と `functionSignature` を定義していますが、コールバックは `chunkId` のみを使用しています。
- このバグにより、`get_function_chunk` ツールが正しく機能しません。

### 解決方法

- [ ] `get_function_chunk` ツールのコールバックを修正し、`analysisService.getFunctionChunk(input.filePath, input.functionSignature)` を呼び出すようにします。
- [ ] コールバックの引数と入力スキーマが一致するように修正します。

## その他

ロードマップの「フェーズ1: コア機能の強化と安定化」の一部として対応を検討します。
