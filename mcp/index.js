#!/usr/bin/env node
// LumosCore MCP server — the thing /mcp has been advertising.
//
// stdio, because that is what "npm i -g @lumoscore/mcp" implies and what Claude Desktop, Cursor and
// the rest speak. No account, no API key: every read is public chain data, and every write is handed
// back to the human to sign.
//
// THIS PROCESS NEVER HOLDS A SECRET KEY. It is worth saying twice, because the obvious "improvement"
// is to let it sign so the agent can act end to end -- and that would hand an AI loop the ability to
// move funds with nobody watching. The write tools return a link instead; approval happens in
// LumosCore, in the user's own wallet.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, ApiError } from './tools.js';

const server = new Server(
  { name: 'lumoscore', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.title,
    inputSchema: { type: 'object', properties: t.schema, required: t.required },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }] };
  const args = req.params.arguments || {};
  const missing = (tool.required || []).filter((k) => args[k] === undefined || args[k] === null || args[k] === '');
  if (missing.length) {
    return { isError: true, content: [{ type: 'text', text: `Missing required argument(s): ${missing.join(', ')}` }] };
  }
  try {
    return await tool.run(args);
  } catch (e) {
    // An upstream failure is reported as itself. Returning an empty result would read to the agent as
    // "there is no such market" or "this account is empty", and it would act on that.
    const msg = e instanceof ApiError ? e.message : `${tool.name} failed: ${(e && e.message) || e}`;
    return { isError: true, content: [{ type: 'text', text: msg }] };
  }
});

// stdout is the protocol channel: anything written there that is not JSON-RPC corrupts the stream, so
// diagnostics go to stderr. This is the single easiest way to break an MCP server.
const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('lumoscore-mcp ready — ' + TOOLS.length + ' tools\n');
