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
