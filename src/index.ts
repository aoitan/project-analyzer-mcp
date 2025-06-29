import logger from './utils/logger.js';

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Server started.');
}

main().catch((error) => {
  logger.error('Failed to start MCP Server:', error);
  process.exit(1);
});
