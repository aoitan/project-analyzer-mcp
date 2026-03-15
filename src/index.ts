import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';
import logger from './utils/logger.js';
import { config } from './config.js';

async function main() {
  // コマンドライン引数から --cache-dir を取得
  let cacheDir: string | undefined = undefined;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cache-dir' && i + 1 < args.length) {
      cacheDir = args[i + 1];
      break;
    }
  }

  // 指定がない場合は、環境変数またはデフォルト（config.cacheDir）
  cacheDir = cacheDir || config.cacheDir;

  logger.info(`Starting MCP Server with cacheDir: ${cacheDir}`);

  const server = createMcpServer(cacheDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Server started.');
}

main().catch((error) => {
  logger.error('Failed to start MCP Server:', error);
  process.exit(1);
});
