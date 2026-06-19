'use strict';
const router = require('express').Router();
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createServer } = require('../mcp/server');

async function checkAuth(req, res) {
  const Settings = require('../models/Settings');
  const s = await Settings.findOne({ key: 'global' }).lean();
  const apiKey = s?.mcpApiKey;
  if (!apiKey) {
    res.status(503).json({ error: 'MCP API key not generated yet — open Settings to initialize it' });
    return false;
  }
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${apiKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function handle(req, res) {
  if (!await checkAuth(req, res)) return;
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('finish', () => server.close().catch(() => {}));
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}

router.post('/', handle);
router.get('/',  handle);
router.delete('/', async (req, res) => {
  if (!await checkAuth(req, res)) return;
  res.status(200).json({ ok: true });
});

module.exports = router;
