'use strict';
require('dotenv').config({ path: __dirname + '/.env' });
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { connectDB } = require('./src/db');
const { createServer } = require('./src/mcp/server');

async function main() {
  await connectDB();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', async () => {
    await server.close().catch(() => {});
    process.exit(0);
  });
}

main().catch(err => {
  process.stderr.write(`[MCP stdio] Fatal: ${err.message}\n`);
  process.exit(1);
});
