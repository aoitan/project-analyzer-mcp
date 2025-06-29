# KotlinParserの機能強化: 実際の外部ツール連携

## 概要

`KotlinParser` が `kotlin-language-server` や Kotlin Compiler API などの実際の外部ツールを呼び出し、その出力を取得するロジックを実装する必要があります。

## 詳細

### 優先度

高

### 問題点

- 現在の `KotlinParser` はダミーの解析ロジックを使用しており、実際のKotlinコードを解析できません。

### 解決方法

- [ ] `KotlinParser` の `parseFile` メソッド内で、`kotlin-language-server` または Kotlin Compiler API を呼び出す実際のロジックを実装します。
- [ ] 外部ツールからの標準出力/エラー出力を適切に処理します。

## その他

ロードマップの「フェーズ2: 言語サポートの拡張」の一部であり、[Kotlin対応の現状とロードマップ](doc/kotlin_support.md)の「2.1. KotlinParser の機能強化」に該当します。
