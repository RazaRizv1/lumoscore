// The live LumosCore API, and the two rules that keep this server honest.
//
// 1. IT HOLDS NO KEYS AND SIGNS NOTHING. Every read here is public data; every write returns a
//    prepared link for the human to approve in their own wallet. An MCP server runs inside an agent
//    loop, so a secret key in here would be a key an AI can spend without a person in the loop. That
//    is not a tradeoff worth making at any convenience.
//
// 2. IT INVENTS NOTHING. Each tool is backed by an endpoint that already serves the website, so the
//    agent sees the same numbers a visitor does. Where an endpoint cannot answer, the tool says so
//    rather than guessing -- a plausible wrong price is worse than a refusal, because the agent will
//    act on it.
// This module runs in two places now: Node, for the stdio server people install, and a Cloudflare
// Worker, for the remote endpoint at /mcp. `process` does not exist in a Worker, so reading it
// unguarded throws at import time and takes the whole endpoint down before it handles a request.
const ENV = (typeof process !== 'undefined' && process.env) || {};
const BASE = ENV.LUMOSCORE_API || 'https://lumoscore.com';
const UA = 'lumoscore-mcp/0.1.0 (+https://lumoscore.com/mcp)';
const TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

// ONE RETRY AFTER A TIMEOUT, and only after a timeout.
//
// /lxapi/pools measured 30.7s on a cold edge cache and 1.1s warm, against a 20s limit here -- so the
// first caller after the cache expired got "did not respond within 20s" and everyone behind them got
// an instant answer. Our giving up does not stop the origin finishing, so by the time a second request
// goes out the work is done and the cache is warm: the retry costs a second and turns the failure into
// the same answer everybody else gets. Nothing else is retried -- an HTTP error is an answer, and
// repeating a request that was actually refused only doubles the load on whatever refused it.
export async function api(path, { timeout = TIMEOUT_MS, _retried = false } = {}) {
  const url = BASE + path;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  let r;
  try {
    r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ctl.signal });
  } catch (e) {
    clearTimeout(t);
    if (e && e.name === 'AbortError' && !_retried) return api(path, { timeout, _retried: true });
    // A network failure is reported as one. Returning empty data here would read to the agent as
    // "there are no pools", which is a different and much worse claim than "I could not look".
    throw new ApiError(
      e && e.name === 'AbortError'
        ? `LumosCore did not respond within ${Math.round(timeout / 1000)}s, twice (${path})`
        : `Could not reach LumosCore (${path}): ${e && e.message}`, 0);
  }
  clearTimeout(t);
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = null; }
  if (!r.ok) throw new ApiError((body && (body.error || body.message)) || `${path} returned HTTP ${r.status}`, r.status);
  if (body === null) throw new ApiError(`${path} did not return JSON`, r.status);
  return body;
}

// A POST to our own edge. Only /lxapi/xrplpath needs it: ripple_path_find takes a body, and it is
// deliberately not cached, because a path depends on the asking account's balances and on the live
// book -- serving a neighbour's quote to someone else is how a swap gets signed at the wrong price.
//
// NOT RETRIED. The GET above retries a timeout because the work it abandoned is finishing anyway and
// warming a cache. Nothing here is cached, so a retry is a second full path-find against a node that
// is already slow, and the caller would wait twice for one answer.
export async function apiPost(path, body, { timeout = TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  let r;
  try {
    r = await fetch(BASE + path, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify(body), signal: ctl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    throw new ApiError(e && e.name === 'AbortError'
      ? `LumosCore did not respond within ${Math.round(timeout / 1000)}s (${path})`
      : `Could not reach LumosCore (${path}): ${e && e.message}`, 0);
  }
  clearTimeout(t);
  const text = await r.text();
  let out = null;
  try { out = text ? JSON.parse(text) : null; } catch (_) { out = null; }
  if (!r.ok) throw new ApiError((out && (out.error || out.message)) || `${path} returned HTTP ${r.status}`, r.status);
  if (out === null) throw new ApiError(`${path} did not return JSON`, r.status);
  return out;
}

// The XRP Ledger, read straight from a public node.
//
// RIPPLE'S OWN NODES FIRST, and the order is measured rather than aesthetic. xrplcluster.com answers
// a Cloudflare Worker with HTTP 418, so an endpoint that tried it first would fail on the remote /mcp
// while working perfectly from a laptop -- which is the worst way for this to break. s1 and s2 answer
// both. The same list and the same reasoning live in functions/lxapi/xrplparticipants.js.
//
// A rippled "error" in the body is a 200, so the status code alone proves nothing: actNotFound comes
// back as a successful HTTP response carrying a failure, and reading only r.ok would report an
// unfunded account as a working empty one.
const XRPL_RPCS = ['https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/', 'https://xrplcluster.com/'];

export async function xrplRpc(method, params, { timeout = TIMEOUT_MS } = {}) {
  let last = null;
  for (const node of XRPL_RPCS) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(node, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': UA },
        body: JSON.stringify({ method, params: [params || {}] }), signal: ctl.signal,
      });
      clearTimeout(t);
      if (!r.ok) { last = `HTTP ${r.status}`; continue; }
      const j = await r.json().catch(() => null);
      const res = j && j.result;
      if (!res) { last = 'no result in response'; continue; }
      // An account that does not exist is an ANSWER, so it is handed back for the caller to read
      // rather than treated as this node having failed and retried against the next one.
      if (res.error && res.error !== 'actNotFound') { last = res.error_message || res.error; continue; }
      return res;
    } catch (e) {
      clearTimeout(t);
      last = e && e.name === 'AbortError' ? `no response within ${Math.round(timeout / 1000)}s` : (e && e.message);
    }
  }
  throw new ApiError(`Could not reach the XRP Ledger (${method}): ${last || 'all nodes failed'}`, 0);
}

// Horizon is read directly for balances: it is the ledger itself, so a portfolio answer cannot be
// stale relative to some cache of ours.
export async function horizon(path) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch('https://horizon.stellar.org' + path, { headers: { accept: 'application/json', 'user-agent': UA }, signal: ctl.signal });
    clearTimeout(t);
    if (r.status === 404) return null;                  // an unfunded account is a real answer, not an error
    if (!r.ok) throw new ApiError(`Horizon returned HTTP ${r.status}`, r.status);
    return await r.json();
  } catch (e) {
    clearTimeout(t);
    if (e instanceof ApiError) throw e;
    throw new ApiError(`Could not reach Horizon: ${e && e.message}`, 0);
  }
}

// NEAR, read from the same two hosts the website's own account page reads.
//
// WHY NOT OUR OWN /lxapi FOR A PORTFOLIO. There is no near-portfolio endpoint -- the account page
// calls these directly from the browser, and the two names below are lifted from its own reader
// (`RPC` and `FT_API` in lumoscore-account.html) rather than chosen here. Same rule as Horizon above:
// a balance read through a cache of ours could be stale against the chain it claims to describe.
//
// ONE CALL FOR EVERY TOKEN BALANCE, not one per token. FastNEAR's /ft returns every FT contract an
// account has ever touched in a single response. The obvious alternative -- ft_balance_of against each
// of the 72 curated contracts -- is 72 requests to a free public RPC for one portfolio answer, which
// is both slow and the kind of thing that gets an IP rate-limited.
const NEAR_RPC = 'https://free.rpc.fastnear.com';
const NEAR_FT = 'https://api.fastnear.com/v1/account/';

// A NEAR JSON-RPC call. Like rippled, NEAR reports failures INSIDE a 200 response: a missing account
// comes back as a successful HTTP request carrying `error`, so reading r.ok alone would turn "this
// account does not exist" into "this account is empty", which is a different and worse claim.
export async function nearRpc(method, params, { timeout = TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  let r;
  try {
    r = await fetch(NEAR_RPC, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || {} }), signal: ctl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    throw new ApiError(e && e.name === 'AbortError'
      ? `NEAR did not respond within ${Math.round(timeout / 1000)}s (${method})`
      : `Could not reach NEAR (${method}): ${e && e.message}`, 0);
  }
  clearTimeout(t);
  const j = await r.json().catch(() => null);
  if (!j) throw new ApiError(`NEAR ${method} did not return JSON`, r.status);
  // Handed back for the caller to read. UNKNOWN_ACCOUNT is an answer about the account, not a
  // failure of ours, and only the caller knows whether it is the expected one.
  if (j.error) {
    const c = (j.error.cause && j.error.cause.name) || j.error.name || '';
    if (/UNKNOWN_ACCOUNT|UNKNOWN_BLOCK/.test(c)) return { _nearError: c };
    throw new ApiError(`NEAR ${method} failed: ${c || JSON.stringify(j.error).slice(0, 160)}`, 0);
  }
  return j.result;
}

// Every fungible-token balance an account holds, in one request. A 404 is a real answer here too --
// an account FastNEAR has never indexed holds no tokens it can tell us about.
export async function nearFt(account) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(NEAR_FT + encodeURIComponent(account) + '/ft',
      { headers: { accept: 'application/json', 'user-agent': UA }, signal: ctl.signal });
    clearTimeout(t);
    if (r.status === 404) return null;
    if (!r.ok) throw new ApiError(`FastNEAR returned HTTP ${r.status}`, r.status);
    return await r.json();
  } catch (e) {
    clearTimeout(t);
    if (e instanceof ApiError) throw e;
    throw new ApiError(`Could not reach FastNEAR: ${e && e.message}`, 0);
  }
}

export const G_RE = /^G[A-Z2-7]{55}$/;
// CODE-ISSUER, the form the site uses in its urls, plus the bare native asset.
export const ASSET_RE = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/;

export function parseAsset(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  if (/^(xlm|native)$/i.test(v)) return { code: 'XLM', issuer: null, id: 'native' };
  const m = ASSET_RE.exec(v);
  if (m) return { code: m[1], issuer: m[2], id: v };
  return null;
}

export const web = (p) => BASE + p;
