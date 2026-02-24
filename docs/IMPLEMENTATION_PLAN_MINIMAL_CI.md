# Implementation Plan: Minimal Multi-Language CI

## 1. 概要とゴール (Summary & Goal)

TypeScript (MCP Server) と Kotlin (Parser CLI) の品質を担保するため、GitHub Actions による最小限の継続的インテグレーション (CI) パイプラインを構築する。

- **Must**:
  - TypeScript: `npm run build` (型チェック) および `npm run format` の確認。
  - TypeScript: 外部ツール（SourceKitten等）に依存しないユニットテストの実行。
  - Kotlin: `kotlin-parser-cli` の Gradle によるビルド成功確認。
- **Want**:
  - GitHub Actions のキャッシュ機能を利用した高速なビルド。

## 2. スコープ定義 (Scope Definition)

### ✅ In-Scope (やること)

- `.github/workflows/ci.yml`: メインのワークフロー定義ファイル。
- `package.json`: ユニットテストのみを実行する `test:unit` スクリプトの追加（必要に応じて）。
- Kotlin ビルドのキャッシュ設定（`actions/setup-java` のキャッシュ機能）。

### ⛔ Non-Goals (やらないこと/スコープ外)

- **環境構築が困難なテスト**: Linux 上での `sourcekit-lsp` や `sourcekitten` のフルセットアップ（これらは「将来の課題」とする）。
- **デプロイフロー**: 自動リリースや Docker イメージビルド。

## 3. 実装ステップ (Implementation Steps)

1. [ ] **Step 1: package.json の整備**
   - _Action_: `npm test` から統合テスト（`src/__tests__/integration`）を除外した `npm run test:unit` を追加。
   - _Validation_: ローカルで `npm run test:unit` が通ることを確認。

2. [ ] **Step 2: GitHub Actions ワークフローの作成**
   - _Action_: `.github/workflows/ci.yml` を作成。
   - _Jobs_:
     - `lint-and-typecheck`: Prettier と tsc を実行。
     - `test-typescript`: `npm run test:unit` を実行。
     - `build-kotlin`: JDK 17+ で Gradle ビルドを実行。

3. [ ] **Step 3: 計画外事項の Issue 化**
   - _Action_: `issues/ci_full_integration_tests.md` 等を作成し、今回スキップした結合テストの自動化を記録。

## 4. 検証プラン (Verification Plan)

- ファイルをプッシュし、GitHub Actions 上で全ジョブが Green になること。
- Kotlin のビルドが Gradle キャッシュによって 2回目以降高速化されること。

## 5. ガードレール (Guardrails)

- 既存の `scripts/` 内のビルドスクリプトを破壊しないこと。
- `macos-latest` はコストが高いため、可能な限り `ubuntu-latest` で動作するように構成すること。
