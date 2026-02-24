# Implementation Plan: Issue #1 Adapter Layer Fix & Robustness

## 1. 概要とゴール (Summary & Goal)

Issue #1 で実装された LSP アダプター層の重大な欠陥（マルチバイト文字破損、プロセス監視漏れ、URIパースバグ）を修正し、実運用に耐えうる堅牢な基盤を構築する。

- **Must**:
  - `JsonRpcClient`: バイナリバッファリングによるマルチバイト文字対応。
  - `JsonRpcClient`: プロセス終了時のリクエスト強制拒否（reject）とタイムアウト実装。
  - `SourceKitLspAdapter`: `url` モジュールを使用した堅牢な URI/パス変換。
  - `SourceKitLspAdapter`: `symbolId` のパースバグ（`#` 分割）の修正。
- **Want**:
  - `AnalysisAdapter`: 状態確認用の `initialized` プロパティ追加。
  - `GraphNode`: `metadata` の型を `Record<string, unknown>` に改善。

## 2. スコープ定義 (Scope Definition)

### ✅ In-Scope (やること)

- **通信基盤の修正**: `src/utils/jsonRpcClient.ts`
- **アダプターロジックの修正**: `src/adapters/sourceKitLspAdapter.ts`
- **インターフェース・型定義の更新**: `src/interfaces/AnalysisAdapter.ts`, `src/types.ts`
- **テストの修正・強化**: `src/__tests__/jsonRpcClient.unit.test.ts` (新規), `src/__tests__/sourceKitLspAdapter.unit.test.ts`

### ⛔ Non-Goals (やらないこと/スコープ外)

- `AnalysisService` への実接続（DIの準備まで）。
- `getOutgoingCalls` の完全な実装（SourceKit-LSPの特有リクエストが必要なため、今回は適切なエラー/空返却に留める）。
- 既存の `SwiftParser` や `KotlinParser` のロジック変更。

## 3. 実装ステップ (Implementation Steps)

1. [ ] **Step 1: JsonRpcClient の堅牢化**
   - _Action_: `buffer: string` を `Buffer` 管理に変更。`handleData` をバイトベースの切り出しに修正。
   - _Action_: `sendRequest` に 30秒のタイムアウトを追加。
   - _Action_: プロセス終了イベントを永続的に監視し、未解決リクエストを `reject` する。
   - _Validation_: マルチバイト文字を含むパケット分割テストを追加。

2. [ ] **Step 2: 型定義とインターフェースの改善**
   - _Action_: `AnalysisAdapter` に `readonly initialized: boolean` を追加。
   - _Action_: `GraphNode.metadata` を `any` から `Record<string, unknown>` に変更。

3. [ ] **Step 3: SourceKitLspAdapter の URI/ID 処理修正**
   - _Action_: `path.resolve` + `file://` の手動結合を `url.pathToFileURL` に、逆を `url.fileURLToPath` + `decodeURIComponent` に変更。
   - _Action_: `symbolId` の区切り文字を `#` 以外（例: `|` や URI パラメータ形式）にするか、`lastIndexOf` で安全に切り分ける。
   - _Action_: ID生成時に `character` を含めるよう統一。

4. [ ] **Step 4: テストの修正と整合性確認**
   - _Action_: `sourceKitLspAdapter.unit.test.ts` でプライベートアクセスを避け、新設の `initialized` プロパティを使用するよう修正。
   - _Action_: モックで送信 URI の正確性を検証するアサーションを追加。

## 4. 検証プラン (Verification Plan)

- `npm test` がすべてパスすること。
- 特に `JsonRpcClient` の分割パケットテストがマルチバイト文字でパスすること。
- `SourceKitLspAdapter` の単体テストで、URI が `file: //path` のように壊れていないことを確認。

## 5. ガードレール (Guardrails)

- 既存の `JsonRpcClient` のインターフェース（メソッド名、引数）は維持し、内部実装のみを改善すること。
- `path` や `url` モジュールの使用において、OS依存の挙動（Windowsドライブレター等）に配慮すること。
