# `src/parser.ts` の `getFunctionContent` の正確性に関する問題

## 概要
`src/parser.ts` の `getFunctionContent` メソッドは、`SourceKitten` から提供される `bodyOffset` と `bodyLength` を使用して関数本体を抽出していますが、これは関数本体のみを対象としています。ツール仕様では「関数の完全なコード内容」を返すことになっています。

## 詳細
### 優先度
中

### 問題点
*   現在の `getFunctionContent` は、`SourceKitten` の `bodyOffset` と `bodyLength` を使用して関数本体のみを抽出しています。しかし、ツール仕様の「関数の完全なコード内容」には、関数のシグネチャやコメントなども含まれるべきです。
*   `SourceKitten` の出力には、関数の開始オフセット（`key.offset`）と長さ（`key.length`）も含まれているため、これらを使用して関数全体のコードブロックを抽出する方がより正確です。

### 解決方法
- [ ] `getFunctionContent` メソッドを修正し、`SourceKitten` から提供される関数の開始オフセット（`key.offset`）と長さ（`key.length`）を使用して、関数全体のコードブロック（シグネチャ、コメント、本体などを含む）を抽出するようにします。

## その他
ロードマップの「フェーズ1: コア機能の強化と安定化」の一部として対応を検討します。
