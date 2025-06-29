# コードチャンクキャッシュ戦略: メタデータ導入とロジック実装

## 概要

`analyze_project` が呼び出されなくてもキャッシュが利用され、かつファイルの更新やパーサーの仕様変更に追従できるキャッシュ戦略の主要部分を実装します。

## 詳細

### 優先度

高

### 問題点

- 現在のキャッシュは、ファイルの変更やパーサーの仕様変更に自動的に追従しません。

### 解決方法

- [ ] 各コードチャンクファイルにメタデータ（`chunkId`, `filePath`, `fileLastModified`, `parserVersion`, `parserConfigHash`, `mcpServerVersion`, `generatedAt`）を含めるように `AnalysisService.saveChunk` を修正します。
- [ ] `AnalysisService.loadChunk` を修正し、チャンクファイルからメタデータを読み込むようにします。
- [ ] `AnalysisService.getChunk` メソッドに、メタデータに基づいたキャッシュの有効性判断ロジックを実装します。
- [ ] キャッシュが無効と判断された場合、既存のチャンクファイルを削除し、元のソースファイルを再解析して新しいチャンクを生成・保存するロジックを実装します。

## その他

[コードチャンクキャッシュ戦略](doc/cache_strategy.md)の「4. キャッシュの利用と更新ロジック」に該当します。
