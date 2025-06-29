# コードチャンクキャッシュ戦略: パーサーのバージョン管理

## 概要

各パーサー（`SwiftParser`, `KotlinParser` など）にバージョン番号を付与し、キャッシュの有効性判断に利用できるメカニズムを導入します。

## 詳細

### 優先度

中

### 問題点

- パーサーの内部的な変更がキャッシュの無効化に反映されません。

### 解決方法

- [ ] `IParser` インターフェースに `version: string` プロパティを追加します。
- [ ] `SwiftParser` および `KotlinParser` にバージョン番号を定義します。
- [ ] `AnalysisService.saveChunk` で、チャンクのメタデータに `parserVersion` を含めるようにします。
- [ ] `AnalysisService.getChunk` で、`parserVersion` を比較してキャッシュの有効性を判断するロジックを実装します。

## その他

[コードチャンクキャッシュ戦略](doc/cache_strategy.md)の「6. 考慮事項」に該当します。
