# ツール出力のページング機能のドキュメント更新

## 概要

ツール出力のページング機能導入に伴い、関連するドキュメントを更新します。

## 目的

- 新しいページングパラメータの仕様を明確にする。
- ツール利用者がページング機能を適切に利用できるようにする。

## 変更内容

- `doc/tools_specification.md` に、`list_functions_in_file`、`find_file`、`find_function` ツールの新しい `page` および `pageSize` パラメータ、および戻り値のページング関連メタデータに関する記述を追加します。
- `doc/diagrams/` ディレクトリ内の関連するPlantUML図（もしあれば）を更新し、`npm run render-diagrams` コマンドを実行して対応するSVGファイルを最新化します。

## タスク

- [ ] `doc/tools_specification.md` を更新する。
- [ ] 関連するPlantUML図を更新し、SVGを再生成する。
