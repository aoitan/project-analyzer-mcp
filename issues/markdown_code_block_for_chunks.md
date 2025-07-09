# コードチャンクの表示形式をMarkdownコードブロックに変更

## 概要

`server.ts`の`get_chunk`および`get_function_chunk`ツールが返すコードチャンクの内容が、LLMにとって視覚的に分かりにくい形式である。これをMarkdownのコードブロック形式（` ```言語名\nコード\n``` `）に変更し、可読性を向上させる。

## 目的

- LLMがコードチャンクの内容をより明確に認識できるようにする。
- コードの開始と終了が明確になり、誤解釈を防ぐ。
- 言語に応じたシンタックスハイライトを可能にする（LLMが対応している場合）。

## 修正内容

1.  `src/analysisService.ts`の`CodeChunk`インターフェースに`language`プロパティを追加する。
2.  `src/analysisService.ts`の`analyzeProject`メソッド内で、チャンクを保存する際に言語情報を`CodeChunk`オブジェクトに含めるように修正する。
3.  `src/server.ts`の`get_chunk`および`get_function_chunk`ツールにおいて、`codeContent`を返す際に、`analysisService`から取得した言語情報を用いてMarkdownコードブロック形式に整形する。

## チェックリスト

- [ ] `src/analysisService.ts`の`CodeChunk`インターフェースに`language`プロパティが追加されたこと。
- [ ] `src/analysisService.ts`の`analyzeProject`メソッド内で、チャンクに言語情報が正しく付与されていること。
- [ ] `src/server.ts`の`get_chunk`ツールが、Markdownコードブロック形式でコードチャンクを返すこと。
- [ ] `src/server.ts`の`get_function_chunk`ツールが、Markdownコードブロック形式でコードチャンクを返すこと。
- [ ] 関連するユニットテストおよび統合テストがすべてパスすること。
- [ ] `doc/tools_specification.md`の`get_chunk`および`get_function_chunk`の出力仕様が更新されたこと。
