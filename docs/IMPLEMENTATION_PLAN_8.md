# Implementation Plan: Issue #8 - CI におけるフル統合テストの自動化

LLM が依存する外部ツール（SourceKitten, SourceKit-LSP, Kotlin Parser）を含む統合テストを CI で自動化し、リポジトリ全体の品質を担保します。

## 1. 概要とゴール (Summary & Goal)
- **Must**:
  - `macos-latest` または `ubuntu-latest` 上で Swift ツールチェーンをセットアップし、`sourcekitten` を利用可能にすること。
  - Kotlin 解析ツールのビルド（`gradlew build`）を行い、実機テストが実行可能であること。
  - `npm run test:integration` が CI 上でパスすること。
- **Want**:
  - テスト実行時間の短縮（キャッシュの活用）。
  - マトリックス構成による複数環境での検証。

## 2. スコープ定義 (Scope Definition)
### ✅ In-Scope (やること)
- `.github/workflows/ci.yml` への統合テストジョブ（`full-integration-test`）の追加。
- `ubuntu-latest` 環境での Swift セットアップおよび `sourcekitten` のインストール。
- `kotlin-parser-cli` のビルドと、統合テストでの利用。
- `scripts/install_sourcekitten.sh` の CI 向け微修正（非対話、高速化）。

### ⛔ Non-Goals (やらないこと/スコープ外)
- **コード自体の修正**: 既存の `src/` 配下のロジック変更は行わない。
- **パフォーマンスチューニング**: キャッシュ最適化は基本機能が動いた後の `Want` とする。
- **Docker 化**: 今回は GitHub Runner 上でのセットアップを優先する。

## 3. 実装ステップ (Implementation Steps)
1.  [ ] **Step 1: CI ワークフローの更新**
    - *Action*: `.github/workflows/ci.yml` に `integration-test` ジョブを追加。
    - *Action*: `swift-actions/setup-swift` または `actions/setup-swift` を使用して Swift 環境を構築。
    - *Action*: `scripts/install_sourcekitten.sh` を呼び出し、`sourcekitten` をインストール。
2.  [ ] **Step 2: Kotlin Parser の準備**
    - *Action*: CI 上で `kotlin-parser-cli/gradlew build` を実行。
3.  [ ] **Step 3: 統合テストの実行**
    - *Action*: `npm run test:integration` を実行し、Swift/Kotlin 両方の解析が CI 上で動作することを確認。
4.  [ ] **Step 4: ガードレールの確認**
    - *Validation*: `sourcekitten` が見つからない場合にテストが適切に失敗（またはスキップ）されているか確認。

## 4. 検証プラン (Verification Plan)
- GitHub Actions のログで、`full-integration-test` ジョブが成功（Green）すること。
- `integration.test.ts` 内の Swift/Kotlin 解析テストケースが実行されていることをログで確認。

## 5. ガードレール (Guardrails for Coding Agent)
- 既存の `lint-and-typecheck` や `test-typescript` ジョブの動作を壊さないこと。
- `sudo` を使用したインストールは、CI Runner の制約に注意すること。
