# 大きな関数のコードチャンク化と表現方法

このドキュメントでは、大規模言語モデル（LLM）のコンテキストウィンドウの制約を考慮し、大きな関数をより小さなコードチャンクに分割する際の分割点と、そのチャンクの表現方法について詳述します。

## 1. 大きな関数を分割する際の分割点

大きな関数をより小さなコードチャンクに分割する際の、意味的または構造的な分割点として以下のものが考えられます。

- **関数内関数 (Nested Functions)**: 関数内に定義された別の関数。
- **クロージャ (Closures/Lambda Expressions)**: インラインで定義されたクロージャ式。
- **ブロックを構成する制御構造 (Control Flow Blocks)**: `if`, `for`, `while`, `switch`, `guard`, `do-catch` など、独立したコードブロックを形成する制御構造の各ブロック。これらは特定の条件やループ、エラーハンドリングのロジックをカプセル化しているため、意味的なまとまりとして分割できます。
- **大きな初期化ブロック (Large Initialization Blocks)**: 配列、辞書、構造体、クラスなどの、複数行にわたる複雑なデータ構造の初期化処理。
- **コメントで区切られたセクション (Comment-Delimited Sections)**: 開発者が意図的にコメントで区切っているコードのセクション。厳密な構文上の分割点ではないが、開発者の意図を反映した意味的なまとまりとして利用できます。
- **論理的なステップ (Logical Steps/Phases)**: 関数内で複数の明確な論理的ステップやフェーズがある場合、それぞれのステップを分割点とすることができます。
- **ヘルパー関数への抽出候補 (Candidates for Helper Functions)**: 関数内で繰り返し現れるパターンや、独立した機能を持つがまだ関数として抽出されていないコードブロック。将来的にヘルパー関数として抽出される可能性があり、チャンクとして分割するのに適しています。
- **エラーハンドリングブロック (Error Handling Blocks)**: `do-catch` ブロックの `catch` 部分や、`guard` 文の `else` 部分など、エラー処理に特化したブロック。

## 2. 分割したコードチャンクの表現方法

分割されたコードチャンクを表現する際には、LLMがそのチャンクのコンテキストと役割を理解しやすいように、以下の情報をチャンクに含めることが重要です。特に、元の大きな関数（親チャンク）のコード内容には、分割された部分のコードを直接含めず、その部分が別のチャンクとして存在することを示す「プレースホルダー」を挿入し、そのプレースホルダーと対応する子チャンクのIDとの「リレーション情報」を別途保持するアプローチを採用します。

### 2.1. 親チャンクのコード内容の表現

元の大きな関数のコード内容では、分割された部分を以下のようなプレースホルダーで置き換えます。

```swift
func largeFunction() {
    // ... 関数の冒頭部分 ...

    // <chunk_id: func_largeFunction_if_block_0>
    // ... ifブロックのコードは別のチャンクに ...

    // ... 中間部分 ...

    // <chunk_id: func_largeFunction_closure_1>
    // ... クロージャのコードは別のチャンクに ...

    // ... 関数の終端部分 ...
}
```

このプレースホルダーは、LLMに対して「この部分には詳細なコードがあるが、それは別のチャンクとして提供される」ことを示唆します。

### 2.2. 親チャンクのメタデータ（リレーション情報）の表現

親チャンクのメタデータには、そのチャンクが含む子チャンクへの参照を配列として保持します。

```json
{
  "id": "file_path::func_largeFunction",
  "type": "function",
  "code": "func largeFunction() {\n    // ... 関数の冒頭部分 ...\n\n    // <chunk_id: func_largeFunction_if_block_0>\n\n    // ... 中間部分 ...\n\n    // <chunk_id: func_largeFunction_closure_1>\n\n    // ... 関数の終端部分 ...\n}",
  "startLine": 1,
  "endLine": 20,
  "children": [
    {
      "chunkId": "file_path::func_largeFunction_if_block_0",
      "type": "if_statement",
      "startLineInParent": 5, // 親チャンク内での開始行
      "endLineInParent": 8, // 親チャンク内での終了行
      "placeholder": "// <chunk_id: func_largeFunction_if_block_0>"
    },
    {
      "chunkId": "file_path::func_largeFunction_closure_1",
      "type": "closure",
      "startLineInParent": 12,
      "endLineInParent": 15,
      "placeholder": "// <chunk_id: func_largeFunction_closure_1>"
    }
  ],
  "metadata": {
    "description": "大きな関数の概要"
  }
}
```

### 2.3. 子チャンクの表現

子チャンクは、そのチャンク自身の完全なコード内容と、親チャンクへの参照を持ちます。

```json
{
  "id": "file_path::func_largeFunction_if_block_0",
  "parentChunkId": "file_path::func_largeFunction",
  "type": "if_statement",
  "code": "if isValid(input) {\n    // ... ifブロックの詳細コード ...\n}",
  "startLine": 5, // 元ファイル内での開始行
  "endLine": 8, // 元ファイル内での終了行
  "metadata": {
    "description": "入力値の検証を行う条件分岐"
  }
}
```

### 2.4. チャンクに含める情報

- **チャンクID (Chunk ID)**: チャンクを一意に識別するためのID。階層的なID構造を導入します。
  - 例: `file_path::function_signature::block_type::index`
- **親チャンクID (Parent Chunk ID)**: そのチャンクがどのチャンク（関数、クラス、別のブロックなど）の内部に存在するかを示すID。
- **チャンクタイプ (Chunk Type)**: そのチャンクがどのような種類のコードブロックであるかを示すタイプ。
  - 例: `function`, `closure`, `if_statement`, `for_loop`, `variable_declaration`, `class_definition` など。
- **コード内容 (Code Content)**: チャンクに含まれる実際のコード。
- **開始行・終了行 (Start Line / End Line)**: チャンクが元のファイル内でどこからどこまでを占めるかを示す行番号。
- **オフセットと長さ (Offset / Length)**: 元のファイル内でのバイトオフセットとバイト長。
- **メタデータ (Metadata)**: チャンクの役割や目的を説明する短いテキスト。

このアプローチは、MCPの思想である「必要な時に必要なコンテキストを取得する」という点に非常に合致しており、LLMがコードベースをより効率的にナビゲートし、理解するのに役立つと考えます。
