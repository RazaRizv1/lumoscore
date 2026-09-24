// The REMOTE MCP endpoint — JSON-RPC over HTTP at POST /mcp.
//
// WHY REMOTE AT ALL. The stdio server people install with npm cannot be used by ChatGPT: it only
// speaks remote MCP, and so does every web and mobile client. A local server also means a reinstall
// for every fix. This endpoint is the same twelve tools behind a url, so connecting is a paste rather
// than an install, and a deploy reaches everyone at once.
//
// ONE URL, TWO THINGS. GET /mcp is the marketing page and stays exactly that — this file exports no
// GET handler unless the caller asks for an SSE stream, so the page keeps being served by the asset
// server through the middleware, SEO injection and all. POST /mcp is the server.
//
// NO AUTH, DELIBERATELY. Every read here is public ledger data and the writes only build a link for a
// human to approve, so there is no key to protect and nothing to sign. That is why this can be
// "paste the url" where a server holding credentials would need a sign-in first.
//
// The tools are IMPORTED, not reimplemented. Two copies of a price would eventually disagree, and the
// one an agent trusted would be whichever it happened to call.
import { TOOLS } from '../mcp/tools.js';

const VERSION = '0.1.0';
// The versions of the MCP spec this server knows how to answer. A client asking for something else
// gets the newest we support rather than a refusal -- the shapes below are compatible across these.
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST = SUPPORTED[0];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id',
  'access-control-expose-headers': 'mcp-protocol-version',
  'access-control-max-age': '86400',
};

function json(body, status = 200, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, CORS, extra || {}),
  });
}
const result = (id, r) => ({ jsonrpc: '2.0', id, result: r });
const error = (id, code, message) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } });

// JSON Schema for a tool, built from the same `schema` and `required` the stdio server advertises.
function schemaOf(t) {
  const props = {};
  for (const [k, v] of Object.entries(t.schema || {})) {
    props[k] = { type: v.type || 'string' };
    if (v.description) props[k].description = v.description;
  }
  return { type: 'object', properties: props, required: (t.required || []).slice() };
}

async function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return error(msg && msg.id, -32600, 'Not a JSON-RPC 2.0 request.');
  }
  const { id, method, params } = msg;

  if (method === 'initialize') {
    const asked = params && params.protocolVersion;
    return result(id, {
      protocolVersion: SUPPORTED.includes(asked) ? asked : LATEST,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'lumoscore', title: 'LumosCore', version: VERSION },
      instructions:
        'Live Stellar market data from LumosCore. The read tools answer directly. The write tools '
        + '(swap, add_liquidity, remove_liquidity, bridge, launch_token) DO NOT sign anything: they '
        + 'validate the request and return an approve_url the person opens to sign in their own '
        + 'wallet. Never tell a user a transaction has been sent — it has not been, until they approve it.',
    });
  }

  if (method === 'ping') return result(id, {});

  if (method === 'tools/list') {
    return result(id, {
      tools: TOOLS.map((t) => ({
        name: t.name,
        title: t.title,
        description: t.title,
        inputSchema: schemaOf(t),
      })),
    });
  }

  if (method === 'tools/call') {
    const name = params && params.name;
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return error(id, -32602, `Unknown tool "${name}".`);
    const args = (params && params.arguments) || {};
    const missing = (tool.required || []).filter((k) => args[k] === undefined || args[k] === '');
    if (missing.length) {
      // A protocol error would be wrong here: the call reached the right tool and it is the ARGUMENTS
      // that are short, which is something the agent can fix and retry. isError puts that in front of
      // the model instead of failing the transport.
      return result(id, { isError: true, content: [{ type: 'text', text: `Missing required argument(s): ${missing.join(', ')}` }] });
    }
    try {
      const r = await tool.run(args);
      return result(id, { content: r.content, isError: !!r.isError });
    } catch (e) {
      // A tool that cannot reach its upstream says so. Returning empty data would read to the agent as
      // "there are none", which is a different and much worse claim than "I could not look".
      return result(id, { isError: true, content: [{ type: 'text', text: (e && e.message) || 'Tool failed.' }] });
    }
  }

  // Everything the spec defines that this server does not offer. Answering "method not found" is the
  // correct reply and lets a client fall back cleanly.
  return error(id, -32601, `Method not found: ${method}`);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  // A client opening the optional SSE stream must be told plainly that there is not one, or it waits
  // on a page of HTML forever. Everything else is a browser asking for the marketing page, and that
  // is not this file's business.
  const accept = context.request.headers.get('accept') || '';
  if (accept.indexOf('text/event-stream') >= 0) {
    return json(error(null, -32601, 'This server does not offer an SSE stream. POST JSON-RPC to /mcp.'), 405);
  }
  return context.next();
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch (_) { return json(error(null, -32700, 'Invalid JSON.'), 400); }

  const version = request.headers.get('mcp-protocol-version');
  const hdr = { 'mcp-protocol-version': SUPPORTED.includes(version) ? version : LATEST };

  // A notification has no id and takes no response -- 202 with an empty body is what the spec asks
  // for. Replying to one with a JSON-RPC result makes strict clients drop the connection.
  const isNotification = (m) => m && m.id === undefined;

  if (Array.isArray(body)) {
    if (!body.length) return json(error(null, -32600, 'Empty batch.'), 400, hdr);
    const calls = body.filter((m) => !isNotification(m));
    if (!calls.length) return new Response(null, { status: 202, headers: Object.assign({}, CORS, hdr) });
    const out = [];
    for (const m of calls) out.push(await handle(m));   // sequential: the free plan meters subrequests
    return json(out, 200, hdr);
  }

  if (isNotification(body)) return new Response(null, { status: 202, headers: Object.assign({}, CORS, hdr) });
  return json(await handle(body), 200, hdr);
}
