import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { createMcpServer } from './server';

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('MCP Server started.');
}

main().catch((error) => {
  console.error('Failed to start MCP Server:', error);
  process.exit(1);
});
