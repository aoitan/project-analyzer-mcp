# コードチャンク粒度拡張ツール仕様

このドキュメントは、MCPサーバーが提供するコードチャンクの粒度拡張に関するツールの仕様を定義します。これらのツールは、大規模言語モデル（LLM）がコードベース内の関数以外の要素（変数、プロパティ、クラスなど）をより詳細な粒度で理解し、問い合わせることを可能にします。

## ツール一覧

### 1. `get_chunk` (拡張)

指定されたチャンクIDに対応するコードチャンクの内容を返します。`entityType` パラメータを追加することで、関数以外の要素のチャンクも取得できるように拡張します。

- **目的**: 特定のコードエンティティのコードチャンクを取得する。
- **入力パラメータ**:
  - `chunkId` (string, 必須): 取得するコードチャンクのユニークなID（例: 関数のシグネチャ、クラス名、変数名など）。
  - `filePath` (string, オプショナル): チャンクIDがユニークでない場合に、チャンクの特定を助けるためのファイルパス。
  - `entityType` (string, オプショナル): 取得するエンティティのタイプ（例: "function", "class", "property", "variable"）。指定がない場合は、既存の動作（関数チャンクの取得）を維持します。
- **出力**:
  - `content` (string): コードチャンクの内容。
  - `isError` (boolean, オプショナル): エラーが発生した場合に `true`。
- **例**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": "get_chunk_1",
    "method": "tools/call",
    "params": {
      "name": "get_chunk",
      "arguments": {
        "chunkId": "MyClass",
        "filePath": "/path/to/your/project/src/MyFile.kt",
        "entityType": "class"
      }
    }
  }
  ```

### 2. `list_entities_in_file` (新規)

指定されたファイルに含まれる特定のタイプのエンティティの一覧を返します。既存の `list_functions_in_file` を置き換える、より汎用的なツールとして定義します。

- **目的**: 指定されたファイルに含まれる特定のタイプのコードエンティティの一覧（IDとシグネチャ）を取得する。
- **入力パラメータ**:
  - `filePath` (string, 必須): エンティティをリストアップするファイルへの絶対パス。
  - `entityType` (string, オプショナル): リストアップするエンティティのタイプ（例: "function", "class", "property", "variable"）。指定がない場合は、すべてのタイプのエンティティを返します。
  - `language` (string, オプショナル): ファイルのプログラミング言語（例: "swift", "kotlin"）。指定がない場合は、ファイル拡張子から自動判断します。
- **出力**:
  - `content` (array of objects): エンティティのリスト。各オブジェクトは以下のプロパティを持つ。
    - `id` (string): エンティティのユニークなID。
    - `signature` (string): エンティティのシグネチャ（表示名）。
    - `type` (string): エンティティのタイプ（例: "function", "class", "property"）。
  - `isError` (boolean, オプショナル): エラーが発生した場合に `true`。
- **例**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": "list_entities_1",
    "method": "tools/call",
    "params": {
      "name": "list_entities_in_file",
      "arguments": {
        "filePath": "/path/to/your/project/src/MyFile.kt",
        "entityType": "property"
      }
    }
  }
  ```

### 3. `get_entity_chunk` (新規)

指定されたファイル内の特定のエンティティのコードチャンク（内容）を返します。既存の `get_function_chunk` を置き換える、より汎用的なツールとして定義します。

- **目的**: 指定されたファイル内の特定のコードエンティティのコードチャンクを取得する。
- **入力パラメータ**:
  - `filePath` (string, 必須): エンティティが含まれるファイルへの絶対パス。
  - `entitySignature` (string, 必須): 取得するエンティティのシグネチャ。
  - `entityType` (string, オプショナル): 取得するエンティティのタイプ（例: "function", "class", "property", "variable"）。指定がない場合は、既存の動作（関数チャンクの取得）を維持します。
  - `language` (string, オプショナル): ファイルのプログラミング言語（例: "swift", "kotlin"）。指定がない場合は、ファイル拡張子から自動判断します。
- **出力**:
  - `content` (string): コードチャンクの内容。
  - `isError` (boolean, オプショナル): エラーが発生した場合に `true`。
- **例**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": "get_entity_chunk_1",
    "method": "tools/call",
    "params": {
      "name": "get_entity_chunk",
      "arguments": {
        "filePath": "/path/to/your/project/src/MyClass.kt",
        "entitySignature": "val myProperty: String",
        "entityType": "property"
      }
    }
  }
  ```
