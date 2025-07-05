# 依存関係グラフ解析ツール仕様

このドキュメントは、MCPサーバーが提供する依存関係グラフ解析に関するツールの仕様を定義します。これらのツールは、大規模言語モデル（LLM）がコードベース内のエンティティ間の依存関係を理解し、問い合わせることを可能にします。

## ツール一覧

### 1. `analyze_dependencies`

プロジェクト全体の依存関係グラフを解析し、サーバーの内部キャッシュに保持します。この操作は、コードベースの変更後に依存関係グラフを最新の状態に保つために実行されます。

- **目的**: コードベースの依存関係を解析し、LLMが問い合わせ可能な形式で準備する。
- **入力パラメータ**:
    - `projectPath` (string, 必須): 解析するプロジェクトのルートディレクトリへの絶対パス。
- **出力**:
    - `content` (string): 解析の成功または失敗を示すメッセージ。
    - `isError` (boolean, オプショナル): エラーが発生した場合に `true`。
- **例**:
    ```json
    {
      "jsonrpc": "2.0",
      "id": "analyze_dependencies_1",
      "method": "tools/call",
      "params": {
        "name": "analyze_dependencies",
        "arguments": {
          "projectPath": "/path/to/your/project"
        }
      }
    }
    ```

### 2. `get_dependencies`

指定されたコードエンティティ（ファイル、関数など）の依存関係を取得します。

- **目的**: 特定のコードエンティティが依存している、または依存されている他のエンティティを特定する。
- **入力パラメータ**:
    - `filePath` (string, 必須): 依存関係を問い合わせるエンティティが含まれるファイルへの絶対パス。
    - `entitySignature` (string, オプショナル): 依存関係を問い合わせる特定のエンティティのシグネチャ（例: 関数のシグネチャ）。省略された場合、ファイル全体の依存関係が返されます。
    - `direction` (string, オプショナル): 依存関係の方向を指定します。
        - `"incoming"`: 指定されたエンティティに依存しているエンティティ（呼び出し元など）。
        - `"outgoing"`: 指定されたエンティティが依存しているエンティティ（呼び出し先など）。
        - `"both"` (デフォルト): 両方向の依存関係。
- **出力**:
    - `content` (array of objects): 依存関係のリスト。各オブジェクトは以下のプロパティを持つ。
        - `type` (string): 依存関係のタイプ（例: "function_call", "variable_access", "import"）。
        - `source` (object): 依存関係の起点となるエンティティの情報。
            - `filePath` (string): 起点エンティティのファイルパス。
            - `signature` (string, オプショナル): 起点エンティティのシグネチャ。
        - `target` (object): 依存関係の対象となるエンティティの情報。
            - `filePath` (string): 対象エンティティのファイルパス。
            - `signature` (string, オプショナル): 対象エンティティのシグネチャ。
    - `isError` (boolean, オプショナル): エラーが発生した場合に `true`。
- **例**:
    ```json
    {
      "jsonrpc": "2.0",
      "id": "get_dependencies_1",
      "method": "tools/call",
      "params": {
        "name": "get_dependencies",
        "arguments": {
          "filePath": "/path/to/your/project/src/MyFile.swift",
          "entitySignature": "func myFunction(param: String) -> Int",
          "direction": "outgoing"
        }
      }
    }
    ```