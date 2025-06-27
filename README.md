# MCP Code Analysis Server

## 概要

このプロジェクトは、大規模言語モデル（LLM）が広範なコードベースを理解し、操作するのを容易にするためのMCP（Model Context Protocol）サーバーの実装です。大規模なソースコードファイルをより小さく、管理しやすい「コードチャンク」に分割し、それらの保存と取得を管理することを主な目的としています。

## 機能

### 現在実装済みの機能

- **MCPサーバー実装**: TypeScriptとNode.jsを使用し、`@modelcontextprotocol/sdk` を活用して構築されています。
- **コードチャンク化**: Swiftソースファイルを解析し、関数単位でコードチャンクを抽出します。外部ツールとしてSourceKittenを使用しています。
- **ローカルストレージとキャッシュ**: 解析されたコードチャンクは、インメモリキャッシュに保存されるほか、`data/chunks/` ディレクトリにJSONファイルとして永続化されます。
- **ツール**: 以下のツールが実装されています。
  - `analyze_project`: 指定されたプロジェクトを解析し、コードチャンクを抽出・保存します。
  - `get_chunk`: 指定されたチャンクID（関数のシグネチャ）に対応するコードチャンクの内容を返します。
  - `list_functions_in_file`: 指定されたファイルに含まれる関数の一覧（シグネチャ）を返します。
  - `get_function_chunk`: 指定されたファイル内の特定の関数のコードチャンク（内容）を返します。

### 将来実装予定の機能

- **言語サポートの拡張**: Kotlinなど、他のプログラミング言語への対応。
- **コードチャンクの粒度拡張**: 変数、プロパティ、クラス、パッケージなど、関数以外の単位でのチャンク取得。
- **依存関係グラフ**: コードチャンク間の関係と依存関係の解析、保持（メモリ上、将来的にはSQLiteなどの不揮発性ストレージ）。

## はじめに

### 前提条件

- Node.js (v18以上を推奨)
- npm
- SourceKitten (Swiftコード解析のため)
  - macOSの場合: `brew install sourcekitten`

### インストール

1.  リポジトリをクローンします。
    ```bash
    git clone [リポジトリのURL]
    cd [プロジェクトディレクトリ]
    ```
2.  依存関係をインストールします。
    ```bash
    npm install
    ```

## テストの実行

プロジェクトのテストはVitestを使用しています。

```bash
npm test
```

## 使用方法

### MCPサーバーの起動

MCPサーバーを起動するためのスクリプトはまだ用意されていませんが、`src/server.ts` の `createMcpServer` 関数を使用してサーバーインスタンスを作成できます。

### ツールの利用例

MCPサーバーはLLMからのツール呼び出しを想定しています。以下は、内部的なツールの呼び出し例です。

```typescript
import { toolConfigurations } from './src/server';

// プロジェクトの解析
const analyzeProjectTool = toolConfigurations.find((t) => t.name === 'analyze_project');
if (analyzeProjectTool) {
  analyzeProjectTool.callback({ projectPath: '/path/to/your/swift/project' });
}

// ファイル内の関数一覧の取得
const listFunctionsTool = toolConfigurations.find((t) => t.name === 'list_functions_in_file');
if (listFunctionsTool) {
  const functions = await listFunctionsTool.callback({
    filePath: '/path/to/your/swift/file.swift',
  });
  console.log(functions);
}

// 特定の関数のコードチャンクの取得
const getFunctionChunkTool = toolConfigurations.find((t) => t.name === 'get_function_chunk');
if (getFunctionChunkTool) {
  const chunk = await getFunctionChunkTool.callback({
    filePath: '/path/to/your/swift/file.swift',
    functionSignature: 'func yourFunction(param: String) -> Int', // 正しいシグネチャを指定
  });
  console.log(chunk);
}

// チャンクIDを指定してコードチャンクを取得
const getChunkTool = toolConfigurations.find((t) => t.name === 'get_chunk');
if (getChunkTool) {
  const chunkContent = await getChunkTool.callback({ chunkId: 'func yourFunction(param:) -> Int' }); // 正しいチャンクIDを指定
  console.log(chunkContent);
}
```

## プロジェクト構造

```
.gitignore
doc/
├── architecture.md
├── swift_parsing_details.md
└── tools_specification.md
package.json
package-lock.json
src/
├── __tests__/
│   ├── dummy.swift
│   └── server.test.ts
├── analysisService.ts
├── parser.ts
└── server.ts
tsconfig.json
vite.config.ts
```

## 貢献

貢献を歓迎します！バグ報告や機能提案については、Issueトラッカーをご利用ください。

## ライセンス

[ライセンス情報] (例: MIT License)
