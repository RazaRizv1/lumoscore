// Cloudflare Pages Function — the Trade-asset page's RANKED holder list (Stellar).
//
// WHY THIS STOPPED BEING A PROXY, 2026-11-16. This route used to forward one request to
// stellar.expert's /holders endpoint, which returned a ready-made ranking. That endpoint now answers
// 402 Payment Required for everyone, so we build the ranking from Horizon ourselves. Horizon hands out
// every trustline for free; it just will not sort them, so the whole set has to be read once.
//
// A PARTIAL SCAN IS NEVER SERVED. The client sets __lxDXAranked=1 on ANY non-empty response from this
// route and states "Top 10 / Top 50 hold" from it, so while a scan is unfinished this answers 204 and
// the page keeps polling. A FAILURE IS NEVER CACHED either.
//
// REWRITTEN 2026-11-18 FOR SPEED (RAZA: "Trade-asset --> holders taking forever to load. also once it
// loads, it doesnt show top 10 and top 50. It needs to load very quickly"). Measured on VELO, 23,508
// holders: the old route marked anything over 20,000 accounts "giant" and returned 204 FOREVER, after
// ~20s of scanning, and the page fell back to one unranked Horizon page (11-60s) with Top 10/50 dashed.
// Four changes:
//
//  1. PARALLEL, NOT SERIAL. /accounts?asset= pages by account id, and the cursor is just an account id
//     compared as a string -- so the id space can be cut into ranges and read side by side. A Stellar
//     account id is G + [A-D] + one of 32 chars, giving 128 natural ranges; each range starts at its own
//     3-char prefix as the cursor and ends where ids stop carrying that prefix. A small asset (<= 1,000
//     trustlines) still reads as ONE range: 128 requests for 50 holders would be absurd.
//  2. STREAMED, NOT PARSED. A page of 200 VELO accounts is ~7 MB (every account brings its full balance
//     list); JSON.parse-ing a dozen of those side by side would blow the 128 MB isolate. The body is read
//     chunk by chunk and only two things are pulled out with a regex: each account_id, and the ONE
//     balance object for this asset. Nothing else is ever materialised.
//  3. TWO HORIZONS. horizon.stellar.lobstr.co answered the same VELO page in ~4s against SDF's 11-14s;
//     ranges alternate between them and a failed page retries on the other.
//  4. KEPT AND REFRESHED IN THE BACKGROUND. The finished ranking (top KEEP rows) goes to KV -- which is
//     CONTENT_KV on this project; the old code only looked for LUMOS_KV/POOLS_KV, neither bound, so it
//     silently used the per-colo Cache API and nearly every visitor paid for a fresh scan. A ranking past
//     its TTL is STILL SERVED at once while a fresh one is built behind the response.
//
// Scan progress lives in the per-colo Cache API (immediately consistent where it was written -- KV reads
// are cached ~60s and would replay an old cursor), and each request advances it for at most STEP_MS, so
// the first visit to a big asset is a few polls of "Loading holders…" and every visit after is instant.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

const HOSTS = ['https://horizon.stellar.lobstr.co', 'https://horizon.stellar.org'];
const PAGE = 200;             // Horizon's maximum for /accounts
const KEEP = 2000;            // rows kept in the ranking (40 pages of 50 in the table)
const FRESH = 3600;           // a ranking younger than this is served without a refresh
const KEEP_FOR = 7 * 86400;   // ...and an older one is still served (stale-while-revalidate) for a week
const STEP_MS = 16000;        // wall time one request may spend advancing a scan
const CONC = 24;              // ranges read at once
const SMALL = 200;             // trustlines at or below this: one sequential range (a single page)
const GIANT = 250000;         // above this the full read is not worth it -- answer 204 for good (per TTL)
const VER = 'v2';
const B32 = '234567ABCDEFGHIJKLMNOPQRSTUVWXYZ';   // ASCII order: Horizon compares ids as strings

function kvOf(env) { return env && (env.LUMOS_KV || env.POOLS_KV || env.CONTENT_KV) || null; }

// The finished ranking: KV (global) when bound, else the colo cache.
function mkStore(env) {
  const kv = kvOf(env);
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/' + encodeURIComponent(k), { method: 'GET' });
  return {
    async get(k) {
      if (kv) { try { const v = await kv.get(k, 'json'); if (v) return v; } catch (_) {} }
      try { const r = await cache.match(req(k)); return r ? await r.json() : null; } catch (_) { return null; }
    },
    async put(k, v, ttl) {
      const body = JSON.stringify(v);
      if (kv) { try { await kv.put(k, body, { expirationTtl: ttl }); } catch (_) {} }
      try {
        await cache.put(req(k), new Response(body, {
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + ttl } }));
      } catch (_) {}
    },
  };
}
// Scan progress: colo cache only (see the header).
const progReq = (k) => new Request('https://lumoscore.internal/prog/' + encodeURIComponent(k), { method: 'GET' });
async function progGet(k) { try { const r = await caches.default.match(progReq(k)); return r ? await r.json() : null; } catch (_) { return null; } }
async function progPut(k, v) {
  try { await caches.default.put(progReq(k), new Response(JSON.stringify(v), {
    headers: { 'content-type': 'application/json', 'cache-control': 'max-age=1800' } })); } catch (_) {}
}
async function progDel(k) { try { await caches.default.delete(progReq(k)); } catch (_) {} }

function toStroops(dec) {
  const s = String(dec == null ? '' : dec).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return '0';
  const dot = s.indexOf('.');
  const int = dot < 0 ? s : s.slice(0, dot);
  const frac = dot < 0 ? '' : s.slice(dot + 1);
  return (int + (frac + '0000000').slice(0, 7)).replace(/^0+(?=\d)/, '') || '0';
}
function cmpStr(x, y) {
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}
function topK(rows) {
  const seen = new Set(), out = [];
  rows.sort((a, b) => cmpStr(b[1], a[1]) || (a[0] < b[0] ? -1 : 1));
  for (const r of rows) { if (seen.has(r[0])) continue; seen.add(r[0]); out.push(r); if (out.length >= KEEP) break; }
  return out;
}

async function trustlines(code, issuer) {
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + '/assets?asset_code=' + encodeURIComponent(code) + '&asset_issuer=' + issuer);
      if (!r.ok) continue;
      const d = await r.json();
      const rec = d && d._embedded && d._embedded.records && d._embedded.records[0];
      if (!rec) return 0;
      const a = rec.accounts || {};
      return (+a.authorized || 0) + (+a.authorized_to_maintain_liabilities || 0) + (+a.unauthorized || 0);
    } catch (_) {}
  }
  return null;
}

// One page of one range, streamed. Returns { rows, last, n } or null on failure.
async function readPage(host, code, issuer, cursor, prefix, lim) {
  let r;
  try {
    r = await fetch(host + '/accounts?asset=' + encodeURIComponent(code + ':' + issuer)
      + '&limit=' + (lim || PAGE) + '&order=asc' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      { headers: { accept: 'application/json' } });
  } catch (_) { return null; }
  if (!r.ok || !r.body) return null;
  const ID = /"account_id":\s*"(G[A-Z2-7]{55})"/g;
  const BAL = new RegExp('\\{\\s*"balance":\\s*"([0-9.]+)"[^{}]*?"asset_code":\\s*"' + code
    + '",\\s*"asset_issuer":\\s*"' + issuer + '"', 'g');
  const rows = [], dec = new TextDecoder();
  let buf = '', last = null, n = 0, curId = null;
  const reader = r.body.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      if (done) buf += dec.decode();
      // Walk ids and balances in document order so each balance belongs to the id before it.
      let cut = done ? buf.length : Math.max(0, buf.length - 4096);
      const evs = [];
      ID.lastIndex = 0; let m;
      while ((m = ID.exec(buf)) && m.index < cut) evs.push([m.index, 'i', m[1]]);
      BAL.lastIndex = 0;
      while ((m = BAL.exec(buf)) && m.index < cut) evs.push([m.index, 'b', m[1]]);
      evs.sort((a, b) => a[0] - b[0]);
      for (const e of evs) {
        if (e[1] === 'i') {
          // THE RANGE ENDS HERE: ids arrive in order, so the first one outside the prefix means every
          // account after it belongs to another range. Stop reading -- a page is 11-16 MB (measured on
          // LUMOS, 200 accounts) and the download, not Horizon's query, is where the time goes.
          if (prefix && e[2].indexOf(prefix) !== 0) {
            try { reader.cancel(); } catch (_) {}
            return { rows, last: e[2], n, ended: true };
          }
          curId = e[2]; last = e[2]; n++;
        }
        else if (curId) { const st = toStroops(e[2]); if (st !== '0') rows.push([curId, st]); curId = null; }
      }
      buf = buf.slice(cut);
      if (done) break;
    }
  } catch (_) { return null; }
  return { rows, last, n };
}

function freshScan(total) {
  const ranges = [];
  if (total != null && total <= SMALL) ranges.push({ p: '', c: '', d: 0 });
  else for (const a of 'ABCD') for (const b of B32) ranges.push({ p: 'G' + a + b, c: 'G' + a + b, d: 0 });
  // Page size per range: what the range should hold plus slack. Horizon answers a small page much sooner
  // (median 0.5s vs 1.8s to first byte, measured on LUMOS), and the read stops at the range's end anyway.
  const lim = ranges.length > 1 && total != null ? Math.max(10, Math.min(PAGE, Math.ceil(total / ranges.length * 1.3) + 5)) : PAGE;
  return { t: Date.now(), total, ranges, lim, top: [], count: 0 };
}

// Advance a scan for up to STEP_MS. Mutates and returns it; s.done when every range finished.
async function step(s, code, issuer) {
  const until = Date.now() + STEP_MS;
  let next = 0, failed = 0;
  const found = [];
  async function worker(w) {
    for (;;) {
      if (Date.now() > until) return;
      while (next < s.ranges.length && s.ranges[next].d) next++;
      if (next >= s.ranges.length) return;
      const g = s.ranges[next++];
      for (let k = 0; k < 60 && !g.d && Date.now() <= until; k++) {
        // LOBSTR first (several times SDF's throughput, measured), SDF only as the retry.
        let pg = await readPage(HOSTS[0], code, issuer, g.c, g.p, s.lim);
        if (!pg) pg = await readPage(HOSTS[1], code, issuer, g.c, g.p, s.lim);
        if (!pg) { failed++; break; }
        for (const row of pg.rows) if (!g.p || row[0].indexOf(g.p) === 0) found.push(row);
        if (pg.ended || pg.n < (s.lim || PAGE) || !pg.last || (g.p && pg.last.indexOf(g.p) !== 0)) g.d = 1;
        else g.c = pg.last;
      }
    }
  }
  const ws = [];
  for (let w = 0; w < CONC; w++) ws.push(worker(w));
  await Promise.all(ws);
  s.count += found.length;
  s.top = topK(s.top.concat(found));
  s.done = s.ranges.every((g) => g.d);
  s.failed = failed;
  return s;
}

function rankedBody(rows, offset, limit, count) {
  const slice = rows.slice(offset, offset + limit);
  const body = {
    _embedded: { records: slice.map((r, i) => ({ account: r[0], balance: r[1], paging_token: String(offset + i + 1) })) },
    _links: {},
    count,
  };
  const next = offset + slice.length;
  if (next < rows.length) body._links.next = { href: '/lxapi/holders?cursor=' + next };
  return body;
}
const NONE = (why) => new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'x-lx-holders': why } });

// Runs (or resumes) a scan; writes the ranking when it completes. Returns the finished ranking or null.
async function advance(store, KEY, PKEY, code, issuer) {
  let s = await progGet(PKEY);
  if (!s) {
    const total = await trustlines(code, issuer);
    if (total != null && total > GIANT) { await store.put(KEY, { giant: 1, t: Date.now() }, 86400); return { giant: 1 }; }
    s = freshScan(total);
  }
  await step(s, code, issuer);
  if (s.done) {
    const out = { done: 1, t: Date.now(), rows: s.top, count: s.count };
    await store.put(KEY, out, KEEP_FOR);
    await progDel(PKEY);
    return out;
  }
  await progPut(PKEY, s);
  return null;
}

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const q = new URL(request.url).searchParams;
  const asset = q.get('asset') || '';
  if (!ASSET_RE.test(asset)) {
    return new Response('{"error":"bad asset"}', {
      status: 400, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  const cut = asset.lastIndexOf('-');
  const code = asset.slice(0, cut), issuer = asset.slice(cut + 1);
  const limit = Math.min(parseInt(q.get('limit'), 10) || 50, PAGE);
  const offset = Math.max(0, parseInt(q.get('cursor'), 10) || 0);
  const store = mkStore(env);
  const KEY = 'hold:' + VER + ':' + asset, PKEY = KEY + ':scan';

  const held = await store.get(KEY);
  if (held && held.giant && Date.now() - (held.t || 0) < 86400000) return NONE('giant');
  if (held && held.done && held.rows) {
    if (Date.now() - (held.t || 0) > FRESH * 1000 && ctx.waitUntil) {
      ctx.waitUntil(advance(store, KEY, PKEY, code, issuer).catch(() => {}));   // refresh behind the answer
    }
    return new Response(JSON.stringify(rankedBody(held.rows, offset, limit, held.count)), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
  }
  const out = await advance(store, KEY, PKEY, code, issuer);
  if (out && out.giant) return NONE('giant');
  if (out && out.done) {
    return new Response(JSON.stringify(rankedBody(out.rows, offset, limit, out.count)), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
  }
  return NONE('scanning');
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  return new Response('{"error":"method not allowed"}', {
    status: 405, headers: { 'content-type': 'application/json', allow: 'GET' } });
}
