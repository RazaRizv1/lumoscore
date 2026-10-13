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

// ---- limits -------------------------------------------------------------------------------------
//
// This endpoint is public and unauthenticated, and every tool behind it spends somebody else's
// budget: our own /lxapi functions and Horizon. Two defences, and the CHEAP one matters more.
//
// 1. CACHE THE READS. A repeat of the same question costs nothing upstream. This is what actually
//    protects Horizon, because the expensive traffic is not one abuser -- it is ten agents asking
//    the same thing about the same asset.
// 2. COUNT PER IP -- and read this before trusting it. The Cache API has no atomic increment, so the
//    counter is read-modify-write and concurrent requests all read the same stale value. MEASURED on
//    staging: 12 sequential requests counted 12; a burst of 320 across 8 connections counted almost
//    none and never tripped. It brakes a shell loop and does NOT stop a burst, which is backwards
//    from what matters, and it is also per-colo. Keep it for the naive case, but the real control is
//    a Cloudflare rate-limiting rule on POST /mcp at the edge, which is a dashboard setting rather
//    than something this file can do.
//
// So the cache in (1) is not the cheap half of the defence. It IS the defence.
//
// The ceiling is set by a real workload rather than a round number: screening the whole curated list
// is 58 assets x 2 calls, and an agent doing that should not be cut off halfway through its own
// legitimate question.
const RL_LIMIT = 240;        // requests per window, per IP, per colo
const RL_WINDOW = 60;        // seconds
const MAX_BODY = 64 * 1024;  // a JSON-RPC call is a few hundred bytes; this is 100x headroom
const MAX_BATCH = 8;

// How long each read stays fresh. A market moves; a curated roster does not. get_rewards is static
// copy pointing at a page, so it can sit for an hour.
const TTL = {
  get_orderbook: 15, get_quote: 15, get_market: 30, get_portfolio: 10,
  list_pools: 60, list_curated_assets: 300, get_rewards: 3600,
};

// Cache keys must live on our own zone, so they are built from the request's own origin under a path
// nothing serves.
const keyFor = (origin, parts) => new Request(origin + '/__mcp/' + parts.map(encodeURIComponent).join('/'));

// ---- what callers actually ask for ---------------------------------------------------------------
//
// RAZA 2026-10-11: "check what he tried to do with MCPs where our MCP wasnt capable enough ... i ask
// this to improve the mcp based on what people need mcp for". That question could not be answered,
// because this file computed the answer four times a request and threw it away every time:
//
//   handle() -32602  Unknown tool "X"      -- an agent naming a capability we do not have. THE signal.
//   handle() isError Missing argument(s)   -- right tool, could not drive it: a schema/wording problem.
//   handle() isError <tool threw>          -- Horizon flaking, or a tool genuinely broken.
//   handle() -32601  Method not found: X   -- clients expecting resources/, prompts/, completion/.
//
// The first is the feature request, in the agent's own words. The second is the documentation bug.
// Neither reaches us any other way: a POST here never renders the page, so /lxapi/pv is not called and
// nothing lands in `pageview`. Cloudflare's own analytics has request counts and no bodies.
//
// WHAT IS STORED: the method, the tool name asked for, an outcome, a short detail, the MCP client's
// self-reported name and version, the request's user agent, and the country. NOT the IP, NOT the
// arguments -- an argument can carry a wallet address, which is the one field here that identifies a
// person, and the tool NAME answers the question on its own.
//
// THE USER AGENT IS STORED, and that is a deliberate departure from lxapi/pv.js, which refuses it.
// The difference is what is at the other end: pv.js counts people reading pages, this counts programs
// calling an API. It is also the only way to tell two callers apart -- MCP over plain HTTP is
// stateless, so `clientInfo` arrives on `initialize` and never again, and without the UA every
// tools/call is anonymous and uncorrelatable.
const LOG_CAP_HOUR = 5000;   // ceiling on *successful* rows; failures are always written
const DETAIL_MAX = 300;
const AGENT_MAX = 180;
let MCP_TBL = 0;
let OK_WINDOW = 0, OK_COUNT = 0;

const DDL = 'CREATE TABLE IF NOT EXISTS mcp_call (ts INTEGER NOT NULL, day TEXT NOT NULL, '
  + 'method TEXT NOT NULL, tool TEXT, outcome TEXT NOT NULL, detail TEXT, client TEXT, '
  + 'client_version TEXT, protocol TEXT, agent TEXT, country TEXT)';

// EVERY FREE-TEXT COLUMN HERE IS WRITTEN BY THE CALLER, and the caller is anonymous. `tool` is
// whatever name they asked for, `detail` quotes their own argument back ("<img src=x onerror=…> is
// not an asset id"), `agent` is their user agent, and `client`/`client_version` are the clientInfo
// they declared on initialize. Only ts/day/method/outcome/country are ours.
//
// So the angle brackets and control characters come off at the WRITE, not at the read. Nothing
// renders this table yet, which is exactly why now is the time: the first admin view that prints
// `detail` would otherwise be stored XSS, and it would be written by someone who had no reason to
// think a log column was hostile. Escaping at the boundary cannot be forgotten by a later reader.
// An asset id, a tool name and a user agent never legitimately contain <, > or a control byte, so
// this costs no diagnostic value.
const clip = (s, n) => (s == null ? null : String(s)
  .replace(/[<>]/g, '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .slice(0, n));

// Written AFTER the response, through waitUntil, so a caller never waits on our bookkeeping and a
// broken database cannot turn a working read into a failure. One batch for the whole request: the
// free plan meters subrequests per invocation and a batch of 8 messages must not become 8 writes.
async function writeLog(env, rows) {
  const db = env && env.ADMIN_DB;
  if (!db || !rows.length) return;
  try {
    if (!MCP_TBL) { MCP_TBL = 1; await db.prepare(DDL).run(); }
    const stmt = db.prepare('INSERT INTO mcp_call (ts, day, method, tool, outcome, detail, client, '
      + 'client_version, protocol, agent, country) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)');
    // `method` is clipped HERE and not at the note() call: it is a caller-supplied JSON-RPC method
    // string, so method_not_found can carry anything at all, and the first argument of note() was the
    // one path that reached a column without passing through clip(). Everything else is already
    // clipped at its creation site; this line is the backstop for all of them.
    await db.batch(rows.map((r) => stmt.bind(
      r.ts, r.day, clip(r.method, 80), clip(r.tool, 80), r.outcome, clip(r.detail, DETAIL_MAX),
      clip(r.client, 80), clip(r.client_version, 40), clip(r.protocol, 40),
      clip(r.agent, AGENT_MAX), r.country)));
  } catch (_) {
    // A log that cannot be written is not an error the caller should ever hear about.
    MCP_TBL = 0;   // the table may not exist yet on this isolate; try the DDL again next time
  }
}

// `ping` is excluded on purpose -- a keepalive every few seconds would bury the four rows that matter
// under thousands that say nothing. Successful calls are capped per hour; failures never are, because
// the failures ARE the dataset.
function keep(outcome) {
  if (outcome !== 'ok' && outcome !== 'ok_cached') return true;
  const hour = Math.floor(Date.now() / 3600000);
  if (hour !== OK_WINDOW) { OK_WINDOW = hour; OK_COUNT = 0; }
  OK_COUNT += 1;
  return OK_COUNT <= LOG_CAP_HOUR;
}

async function rateLimit(origin, ip) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % RL_WINDOW);
  const key = keyFor(origin, ['rl', ip, String(start)]);
  const cache = caches.default;
  let n = 0;
  try {
    const hit = await cache.match(key);
    if (hit) n = +(await hit.text()) || 0;
    n += 1;
    await cache.put(key, new Response(String(n), { headers: { 'cache-control': 'max-age=' + RL_WINDOW } }));
  } catch (_) {
    // If the cache is unavailable the endpoint stays UP and unlimited rather than refusing everyone.
    // A broken brake should not become a closed door on a read-only public service.
    return { ok: true, n: 0, reset: start + RL_WINDOW };
  }
  return { ok: n <= RL_LIMIT, n, reset: start + RL_WINDOW };
}

// Same tool, same arguments -> same answer for TTL seconds. Arguments are sorted so {a,b} and {b,a}
// share one entry, and encoded whole rather than hashed: a hash collision here would serve one
// asset's order book under another asset's name, which is exactly the class of wrong number this
// server exists not to produce.
function cacheKeyFor(origin, name, args) {
  const keys = Object.keys(args || {}).sort();
  const canon = keys.map((k) => k + '=' + String(args[k])).join('&');
  if (canon.length > 512) return null;
  return keyFor(origin, ['t', name, canon || '-']);
}

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

// `ctx` carries the per-request facts the log needs (user agent, country, protocol) and the array the
// rows are pushed onto. It is threaded rather than global because one POST can be a batch of eight,
// and each message in it has its own outcome.
async function handle(msg, origin, ctx) {
  const note = (method, outcome, tool, detail) => {
    if (!ctx || method === 'ping' || !keep(outcome)) return;
    const now = Date.now();
    ctx.log.push({
      ts: now, day: new Date(now).toISOString().slice(0, 10),
      method: method, tool: tool || null, outcome: outcome, detail: detail || null,
      client: ctx.client, client_version: ctx.clientVersion,
      protocol: ctx.protocol, agent: ctx.agent, country: ctx.country,
    });
  };

  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    note('(malformed)', 'bad_request', null, 'Not a JSON-RPC 2.0 request.');
    return error(msg && msg.id, -32600, 'Not a JSON-RPC 2.0 request.');
  }
  const { id, method, params } = msg;

  if (method === 'initialize') {
    const asked = params && params.protocolVersion;
    // THE ONE PLACE THE CLIENT NAMES ITSELF. MCP over plain HTTP has no session, so clientInfo arrives
    // here and never again -- recorded on this row, and on later rows only the user agent connects the
    // calls back to it. Written onto ctx as well so a batched initialize+tools/list share it.
    const ci = (params && params.clientInfo) || {};
    if (ci.name) { ctx.client = clip(ci.name, 80); ctx.clientVersion = clip(ci.version, 40); }
    note('initialize', 'ok', null, clip(asked, 40));
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
    note('tools/list', 'ok', null, null);
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
    if (!tool) {
      // THE ROW RAZA ASKED FOR. An agent reached this server, read the tool list, and still asked for
      // something that is not on it -- so it names a capability somebody wanted and we do not have.
      // Nothing else in the system records a wish; this is the only place one is ever spoken aloud.
      note('tools/call', 'unknown_tool', clip(name, 80), null);
      return error(id, -32602, `Unknown tool "${name}".`);
    }
    const args = (params && params.arguments) || {};
    const missing = (tool.required || []).filter((k) => args[k] === undefined || args[k] === '');
    if (missing.length) {
      // The ARGUMENT NAMES only, never their values: one of them is `account`, and a wallet address is
      // the single field here that would identify a person. The names are what diagnoses the schema.
      note('tools/call', 'missing_args', clip(name, 80), missing.join(','));
      // A protocol error would be wrong here: the call reached the right tool and it is the ARGUMENTS
      // that are short, which is something the agent can fix and retry. isError puts that in front of
      // the model instead of failing the transport.
      return result(id, { isError: true, content: [{ type: 'text', text: `Missing required argument(s): ${missing.join(', ')}` }] });
    }
    const ck = TTL[name] ? cacheKeyFor(origin, name, args) : null;
    if (ck) {
      try {
        const hit = await caches.default.match(ck);
        if (hit) {
          // Logged separately from a fresh call: a cached answer still means somebody asked, and
          // counting the two together would make the cache look like demand.
          note('tools/call', 'ok_cached', clip(name, 80), null);
          return result(id, await hit.json());
        }
      } catch (_) { /* a cache miss and a broken cache are the same thing here: do the work */ }
    }
    try {
      const r = await tool.run(args);
      const payload = { content: r.content, isError: !!r.isError };
      // A tool that ran and reported a problem is not the same as one that threw, and both are worth
      // separating from "the agent asked for something we do not have".
      note('tools/call', payload.isError ? 'tool_error' : 'ok', clip(name, 80),
        payload.isError ? ((r.content && r.content[0] && r.content[0].text) || null) : null);
      // Only a good answer is kept. Caching a failure would hold a "could not reach Horizon" in front
      // of every caller for the rest of the window, long after the outage that caused it.
      if (ck && !payload.isError) {
        try {
          await caches.default.put(ck, new Response(JSON.stringify(payload), {
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + TTL[name] },
          }));
        } catch (_) { /* unable to cache is not unable to answer */ }
      }
      return result(id, payload);
    } catch (e) {
      // A tool that cannot reach its upstream says so. Returning empty data would read to the agent as
      // "there are none", which is a different and much worse claim than "I could not look".
      note('tools/call', 'tool_threw', clip(name, 80), (e && e.message) || 'Tool failed.');
      return result(id, { isError: true, content: [{ type: 'text', text: (e && e.message) || 'Tool failed.' }] });
    }
  }

  // Everything the spec defines that this server does not offer. Answering "method not found" is the
  // correct reply and lets a client fall back cleanly.
  // Logged because it says which parts of MCP clients expect us to have -- resources/list and
  // prompts/list turning up repeatedly would be a roadmap item, not an error.
  note(method, 'method_not_found', null, clip(method, 80));
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

// TAKES THE WHOLE CONTEXT NOW, not just { request }: the log needs env.ADMIN_DB to write to and
// waitUntil to write AFTER the response, so no caller ever pays for our bookkeeping.
export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;
  const version = request.headers.get('mcp-protocol-version');
  const hdr = { 'mcp-protocol-version': SUPPORTED.includes(version) ? version : LATEST };

  const ctx = {
    log: [],
    agent: clip(request.headers.get('user-agent'), AGENT_MAX),
    country: (request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || null,
    protocol: clip(version, 40),
    client: null, clientVersion: null,
  };
  // waitUntil is absent when this file is exercised outside the Workers runtime; falling back to a
  // bare call keeps that path working rather than throwing on a missing platform API.
  const flush = () => {
    if (!ctx.log.length) return;
    const p = writeLog(env, ctx.log.splice(0));
    if (context.waitUntil) context.waitUntil(p);
  };

  const len = +(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json(error(null, -32600, 'Request body too large.'), 413, hdr);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rl = await rateLimit(origin, ip);
  Object.assign(hdr, {
    'x-ratelimit-limit': String(RL_LIMIT),
    'x-ratelimit-remaining': String(Math.max(0, RL_LIMIT - rl.n)),
    'x-ratelimit-reset': String(rl.reset),
  });
  if (!rl.ok) {
    const wait = Math.max(1, rl.reset - Math.floor(Date.now() / 1000));
    // Recorded so a caller being turned away is visible. The brake is known to be leaky (see the note
    // on rateLimit), so a row here is also the only sign it ever engaged.
    const now = Date.now();
    ctx.log.push({
      ts: now, day: new Date(now).toISOString().slice(0, 10), method: '(pre-parse)',
      tool: null, outcome: 'rate_limited', detail: String(rl.n), client: null,
      client_version: null, protocol: ctx.protocol, agent: ctx.agent, country: ctx.country,
    });
    flush();
    return json(error(null, -32029, `Rate limit exceeded: ${RL_LIMIT} requests per ${RL_WINDOW}s. Retry in ${wait}s.`),
      429, Object.assign({ 'retry-after': String(wait) }, hdr));
  }

  let body;
  try { body = await request.json(); } catch (_) { return json(error(null, -32700, 'Invalid JSON.'), 400, hdr); }

  // A notification has no id and takes no response -- 202 with an empty body is what the spec asks
  // for. Replying to one with a JSON-RPC result makes strict clients drop the connection.
  const isNotification = (m) => m && m.id === undefined;

  if (Array.isArray(body)) {
    if (!body.length) return json(error(null, -32600, 'Empty batch.'), 400, hdr);
    // One request must not become fifty subrequests. The free plan allows 50 per invocation and a
    // batch is the cheapest way for a caller to spend them all at once, by accident or otherwise.
    if (body.length > MAX_BATCH) return json(error(null, -32600, `Batch too large: at most ${MAX_BATCH} messages.`), 400, hdr);
    const calls = body.filter((m) => !isNotification(m));
    if (!calls.length) return new Response(null, { status: 202, headers: Object.assign({}, CORS, hdr) });
    const out = [];
    for (const m of calls) out.push(await handle(m, origin, ctx));   // sequential: the free plan meters subrequests
    // One flush for the whole batch, so eight messages are eight ROWS but a single D1 write.
    flush();
    return json(out, 200, hdr);
  }

  if (isNotification(body)) return new Response(null, { status: 202, headers: Object.assign({}, CORS, hdr) });
  const reply = await handle(body, origin, ctx);
  flush();
  return json(reply, 200, hdr);
}
