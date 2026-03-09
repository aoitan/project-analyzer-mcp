# Implementation Plan: Issue 3 - Class Relation API Implementation

## 1. 概要とゴール (Summary & Goal)
LLMがコードベースのアーキテクチャ（クラス継承、インターフェース実装、プロパティ依存関係）を把握するための「クラス関連グラフ API」を実装する。

- **Must**:
  - `get_class_architecture(ClassName)` 相当の機能を提供し、指定したクラスの親クラス、実装インターフェース、依存プロパティを取得できること。
  - Kotlin および Swift 両方のパーサーで、クラス/インターフェースの構造情報を抽出できるよう拡張すること。
  - 抽出した情報をキャッシュし、MCPツールとして公開すること。
- **Want**:
  - クラス間の関係を自然言語で要約したメタデータを含める。

## 2. スコープ定義 (Scope Definition)
### ✅ In-Scope (やること)
- `kotlin-parser-cli` の拡張: クラスの継承（SuperTypes）やプロパティの型情報の抽出。
- `SwiftParser` の拡張: SourceKitten の出力から継承・実装情報を抽出。
- `CodeChunk` インターフェースの拡張: 継承関係や依存関係を保持するフィールドの追加。
- `AnalysisService` への新メソッド追加: `getClassArchitecture(className)` の実装。
- MCP サーバーへの新ツール登録: `get_class_architecture` ツールの追加。

### ⛔ Non-Goals (やらないこと/スコープ外)
- **詳細なコールグラフ解析**: 関数内部の呼び出し関係の完全な解決は Phase 2 とする。
- **外部ライブラリ依存の完全な解決**: 標準ライブラリ以外の外部依存の型解決は、現時点ではテキストベースのベストエフォートとする。

## 3. 実装ステップ (Implementation Steps)

1. [ ] **Step 1: 基礎定義の拡張 (TypeScript)**
   - `src/interfaces/parser.ts` の `CodeChunk` に `superTypes`, `interfaces`, `properties` などのフィールドを追加。
   - `src/types.ts` に必要な型定義を追加。
   - *Validation*: コンパイルが通ること。

2. [ ] **Step 2: Kotlin パーサーの拡張 (Kotlin)**
   - `kotlin-parser-cli/src/main/kotlin/KotlinAstParser.kt` を修正。
   - `KtClassOrObject` から `superTypeListEntries` やプロパティの型情報を抽出するようにする。
   - *Action*: `npm run build-kotlin-parser-cli` でビルド。
   - *Validation*: Kotlinファイルの解析結果に継承情報が含まれることを確認。

3. [ ] **Step 3: Swift パーサーの拡張 (TypeScript)**
   - `src/swiftParser.ts` を修正。
   - SourceKitten の `key.inheritedtypes` などを利用して継承・実装情報を抽出。
   - *Validation*: Swiftファイルの解析結果に継承情報が含まれることを確認。

4. [ ] **Step 4: AnalysisService の拡張 (TypeScript)**
   - `src/analysisService.ts` に `getClassArchitecture(className)` を追加。
   - キャッシュから指定されたクラス名を持つチャンクを探し、その関連情報を返すロジックを実装。
   - *Validation*: ユニットテスト `src/__tests__/analysisService.unit.test.ts` にテストケースを追加。

5. [ ] **Step 5: MCP ツールの公開 (TypeScript)**
   - `src/server.ts` に `get_class_architecture` ツールを登録。
   - *Validation*: `npm run test:integration` または `inspector` で動作確認。

## 4. 検証プラン (Verification Plan)
- **自動テスト**: `src/__tests__/integration/class_relation.test.ts` を新規作成し、Kotlin/Swift 両方のクラス構造が正しく取得できるか検証する。
- **手動テスト**: MCP Inspector を使用して、実プロジェクトのクラス名を指定し、期待通りの JSON が返るか確認する。

## 5. ガードレール (Guardrails for Coding Agent)
- 既存の `get_chunk` や `get_function_chunk` の挙動を壊さないこと。
- `CodeChunk` の ID 生成規則（シグネチャベース）を維持しつつ、必要に応じてメタデータを拡充する。
- パフォーマンス向上のため、大規模な探索は Lazy 更新とキャッシュを活用すること。
