# Implementation Plan: Issue #4 - Call Graph API Implementation

LLM が関数レベルの依存関係（呼び出し元・呼び出し先）を動的に取得し、処理フローや影響範囲を理解できるようにするための API を実装します。

## 1. 概要とゴール (Summary & Goal)

- **Must**:
  - 指定した関数（位置情報）から、呼び出し元（Caller）と呼び出し先（Callee）を特定の深さまで取得できること。
  - SourceKit-LSP を通じて、Swift コードのコールグラフを取得できること。
  - MCP ツール `get_call_graph` を提供し、LLM が利用可能にすること。
- **Want**:
  - 循環参照の検知と適切な処理。
  - レスポンスに LLM 向けの要約ヒント（自然言語メタデータ）を付与する。

## 2. スコープ定義 (Scope Definition)

### ✅ In-Scope (やること)

- `AnalysisAdapter` インターフェースに則った `SourceKitLspAdapter.getOutgoingCalls` の実装。
- `AnalysisService` への `getCallGraph` メソッドの追加。
- `src/server.ts` への `get_call_graph` メチャツールの登録。
- コールグラフ取得機能のユニットテストおよび統合テストの追加。

### ⛔ Non-Goals (やらないこと/スコープ外)

- **Kotlin のコールグラフ対応**: 今回は Swift (SourceKit-LSP) を優先し、Kotlin は将来の課題とする。
- **グラフの可視化**: SVG 生成などは Phase 3 以降とし、今回はデータ提供（JSON）に専念する。
- **大規模なリファクタリング**: 既存の `AnalysisService` の構造は維持する。

## 3. 実装ステップ (Implementation Steps)

1.  [ ] **Step 1: SourceKitLspAdapter の強化**
    - _Action_: `src/adapters/sourceKitLspAdapter.ts` の `getOutgoingCalls` を実装する。`textDocument/prepareCallHierarchy` と `callHierarchy/outgoingCalls` を使用。
    - _Validation_: `src/__tests__/sourceKitLspAdapter.unit.test.ts` にテストを追加。

2.  [ ] **Step 2: AnalysisService への Call Graph 探索ロジックの追加**
    - _Action_: `src/analysisService.ts` に `getCallGraph` を実装。再帰的に `depth` 分探索し、Caller/Callee を収集する。
    - _Validation_: `src/__tests__/analysisService.unit.test.ts` にテストを追加。

3.  [ ] **Step 3: MCP ツール get_call_graph の実装**
    - _Action_: `src/server.ts` に `get_call_graph` ツールを登録。
    - _Validation_: `src/__tests__/server.test.ts` にツールの呼び出しテストを追加。

4.  [ ] **Step 4: 統合テスト**
    - _Action_: 実際の Swift ファイル（`src/Example.swift` など）を使用して、コールグラフが正しく取得できるか確認。
    - _Validation_: `src/__tests__/integration/integration.test.ts` にケースを追加。

## 4. 検証プラン (Verification Plan)

- `npm run test:unit` がすべてパスすること。
- `get_call_graph` を呼び出した際、期待通りの JSON (Nodes/Edges 形式) が返ること。
- 深さを 2 以上に指定した際、子孫の呼び出し関係も含まれていること。

## 5. ガードレール (Guardrails for Coding Agent)

- 既存の `get_chunk` や `list_functions_in_file` の動作を壊さないこと。
- LSP の 0-indexed とプロジェクトの 1-indexed の変換を正確に行うこと。
- 無限ループを防ぐため、最大深度（例: 5）を制限すること。
