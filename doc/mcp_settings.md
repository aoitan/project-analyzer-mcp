# MCPサーバー 設定ファイル例

このドキュメントでは、様々なAgentからMCPサーバーを利用するための設定ファイルの例を示します。

## 1. Continue

ContinueでMCPサーバーを利用するには、`~/.continue/mcpServers/mcp-code-analysis-server.yaml` に以下の設定を追加します。

```yaml
name: mcp-code-analysis-server
version: 0.0.1
schema: v1
mcpServers:
  - name: Code Analysis Server
    command: npm
    args:
      - start
    env: {}
```

## 2. Claude Code

Claude CodeでMCPサーバーを利用するには、`<PROJECT_ROOT>/.mcp.json` に以下の設定を追加します。

```json
{
  "mcpServers": {
    "mcp-code-analysis-server": {
      "command": "npm",
      "args": ["start"],
      "env": {}
    }
  }
}
```

## 3. gemini-cli

gemini-cliでMCPサーバーを利用するには、設定ファイル（例: `~/.gemini/settings.json`）に以下の設定を追加します。

```json
{
    :
  "mcpServers": {
    "mcp-code-analysis-server": {
      "command": "npm",
      "args": [ "start" ],
      "env": {}
    }
  }
}
```
