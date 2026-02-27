# Implementation Plan: Issue #2 On-demand (Lazy) Edge Update (Revised)

## 1. 概要とゴール (Summary & Goal)
前回のレビュー指摘（ディスク残留、削除追従不足）に基づき、キャッシュ無効化ロジックを堅牢化し、変更に完全に同期する Lazy Update 機構を完成させる。

- **Must**:
    - `CacheManager`: `filePath` 単位でのキャッシュ物理削除（全関連JSONの削除）を実装。
    - `AnalysisService`: ファイル削除・読込失敗時にキャッシュをクリアし、古い情報を返さない。
    - ユニット/統合テストで「変更時」および「削除時」の挙動を検証。
- **Policy**:
    - **完全な同期**: 古い情報（stale chunk）がディスクに残らないことを保証する。

## 2. スコープ定義 (Scope Definition)
### ✅ In-Scope (やること)
- `src/cache/CacheManager.ts`: ファイルパスとチャンクIDの紐付け管理、および物理ファイル削除。
- `src/analysisService.ts`: `ensureLatestFileAnalysis` のエラーハンドリング（削除検知）強化。
- `src/__tests__/`: 変更・削除ケースの網羅的なテスト追加。

## 3. 実装ステップ (Implementation Steps)

1. [ ] **Step 1: CacheManager の物理削除実装**
    - *Action*: メタデータに `chunkIds: string[]` を保持させ、`clearCacheForFile` でこれら全てのファイルを `fs.rm` する。
2. [ ] **Step 2: AnalysisService の削除追従**
    - *Action*: `ensureLatestFileAnalysis` で `ENOENT` を検知した際、キャッシュをクリアし、クエリを中断（null返却）する。
3. [ ] **Step 3: テストによる検証 (TDD)**
    - *Action*: `AnalysisService` のユニットテストで `isFileChanged=true` のモックを作成し、再パースフローを検証。
    - *Action*: 統合テストでファイル削除後の `get_chunk` が `null` を返すことを検証。

## 4. 検証プラン (Verification Plan)
- `npm test` がパスすること。
- ディレクトリ内の `.json` ファイルが、再パース時に古いものが消え、新しいものだけになっていることを確認。
