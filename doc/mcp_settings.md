# MCPサーバー 設定ファイル例

このドキュメントでは、様々なAgentからMCPサーバーを利用するための設定ファイルの例を示します。

## 1. Continue

ContinueでMCPサーバーを利用するには、`~/.continue/config.json` の `mcpServers` セクションに以下の設定を追加します。

```json
{
  "mcpServers": [
    {
      "name": "Code Analysis Server",
      "command": "npx",
      "args": ["-y", "mcp-code-analysis-server"],
      "env": {
        "MCP_CACHE_DIR": "/path/to/your/custom/cache"
      }
    }
  ]
}
```

## 2. Claude Desktop

Claude DesktopでMCPサーバーを利用するには、設定ファイル（Macの場合は `~/Library/Application Support/Claude/claude_desktop_config.json`）に以下の設定を追加します。

```json
{
  "mcpServers": {
    "mcp-code-analysis-server": {
      "command": "npx",
      "args": ["-y", "mcp-code-analysis-server"],
      "env": {}
    }
  }
}
```

## 3. gemini-cli

gemini-cliでMCPサーバーを利用するには、設定ファイル（例: `~/.gemini/settings.json`）に以下の設定を追加します。

```json
{
  "mcpServers": {
    "mcp-code-analysis-server": {
      "command": "npx",
      "args": ["-y", "mcp-code-analysis-server"],
      "env": {}
    }
  }
}
```
