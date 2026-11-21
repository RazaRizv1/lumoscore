// Cloudflare Pages Function — ALL-TIME swap volume per fee receipt, for the admin dashboard.
//
// WHY THIS EXISTS. RAZA, 2026-10-21: "i sure the mentioned volume isnt correct. I used it was close to
// $20K combined alltime ... why is it suddenly showing so less". The figure was not wrong, it was
// TRUNCATED, and it had been shrinking on its own for weeks.
//
// The admin page derives each receipt's volume from its transaction envelope, and envelopes came from
// ONE page of 200 (`loadEnvelopes` in _tools/_admin.js). Measured against the ledger that day:
//
//     436 payments on the collector · 366 inbound fee receipts · 200 envelopes fetched
//     -> 166 receipts returned null from grossOf() and contributed ZERO volume
//
// So "all time" meant "the most recent 200 receipts", and every new receipt pushed an older swap out
// of the window. The cap itself was a reasonable performance fix -- `join=transactions` costs roughly
// fourteen times the time -- it just silently changed what the number meant.
//
// WHY AT THE EDGE. It is public data, identical for every viewer, and _realdata.js already carried the
// note that this belongs in "a cached endpoint of our own". Doing it in the browser means one request
// per receipt on every admin page load; doing it here means once per cache period for everybody.
//
// WHY JSON OPERATIONS AND NOT XDR. The browser parses `envelope_xdr` with stellar-base. Bundling that
// SDK into a Function to parse 366 envelopes would be a large dependency for something Horizon already
// serves as JSON: /transactions/{hash}/operations gives the same operations with named fields. No SDK,
// no XDR, and the field mapping is spelled out at `grossOf` below so the two implementations can be
// compared line for line.
//
// WHAT IT IS NOT. It does not price anything. The admin page already owns pricing (`priceUsd`) and the
// rule that an asset we cannot price is REPORTED, never guessed at; moving that here would duplicate
// it and let the two disagree. This returns amounts per asset and the caller converts.
//
// Deliberately narrow: GET only, no parameters, one fixed upstream, one fixed account. Reads no
// secret and touches no funds.
//
// ADMIN ONLY, even though every byte of it is public on-chain. `functions/` is shared with the public
// projects, so without the guard this would answer on lumoscore.com — and while anyone may read the
// collector on Horizon, serving our own per-receipt trade sizes as a tidy JSON feed is a different
// thing from it being derivable. Same guard, same reasoning, as /lxapi/revenue; requireAdmin refuses a
// non-admin HOST before it even looks at a token, and the admin page's same-origin fetch carries the
// Access cookie by itself.
import { requireAdmin } from '../../_lib/adminauth.js';

const HORIZON = 'https://horizon.stellar.org';
// The Stellar fee collector. Same constant the admin page and _realdata.js use; if it ever changes it
// must change in all three, which is why it is named here rather than passed in by the caller --
// a caller-supplied account would let anyone point this at any wallet.
const FEE = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';

const PAGE = 200;          // Horizon's max per request
const OUT_TTL = 900;       // 15 min: older than this, the answer is refreshed in the background
const STALE_TTL = 604800;  // 7 days: how long the last good answer is kept to serve while refreshing
const OP_TTL = 86400;      // 24 h for one transaction's operations -- a settled ledger never changes
const CONC = 24;           // parallel operation fetches; see the note at fetchOps
const MAX_PAGES = 20;      // 4,000 receipts, far beyond today's 366. A guard, not a limit we expect to hit.

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // A failure is never cached as an answer -- see the note in lumoscore-cf-plan-limits: the bare
      // `cacheTtl` form froze a 429 in at a colo for its whole TTL.
      //
      // PRIVATE, and no CORS header. This is admin-gated business data read by one same-origin page;
      // a public max-age would invite a shared cache to hold it, and a wildcard origin would hand it
      // to any site that asked. The server-side store below is what makes it cheap, not the browser.
      'cache-control': (status && status >= 400) ? 'no-store' : ('private, max-age=' + (ttl || OUT_TTL)),
    },
  });
}

// KV when it is bound, Cache API otherwise -- the same mkStore shape pools.js uses, so this deploys
// safely whether or not the namespace exists. KV matters here because the Cache API is PER DATA
// CENTRE: without it every colo pays its own cold build.
function mkStore(env) {
  const kv = env && (env.LUMOS_KV || env.CONTENT_KV);
  if (kv) {
    return {
      kind: 'kv',
      async get(k) { try { return await kv.get(k, 'json'); } catch (_) { return null; } },
      async put(k, v, ttl) {
        try { await kv.put(k, JSON.stringify(v), { expirationTtl: Math.max(60, ttl) }); } catch (_) {}
      },
    };
  }
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/revvolume/' + encodeURIComponent(k));
  return {
    kind: 'cache',
    async get(k) { try { const r = await cache.match(req(k)); return r ? await r.json() : null; } catch (_) { return null; } },
    async put(k, v, ttl) {
      try {
        await cache.put(req(k), new Response(JSON.stringify(v), {
          headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + Math.max(60, ttl) },
        }));
      } catch (_) {}
    },
  };
}

async function getJson(url, ttl) {
  const r = await fetch(url, {
    headers: { accept: 'application/json' },
    cf: { cacheTtlByStatus: { '200-299': ttl, '300-399': 0, '400-599': 0 }, cacheEverything: true },
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return r.json();
}

// Every inbound fee receipt, oldest irrelevant -- we want all of them, so paging is exhaustive rather
// than capped. Cursor paging is inherently serial: page N+1 needs page N's paging_token.
async function allReceipts() {
  let url = HORIZON + '/accounts/' + FEE + '/payments?order=desc&limit=' + PAGE;
  const out = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    // Short TTL: the newest page changes whenever a fee lands. Older pages are stable but share the
    // same TTL, which costs little because each page URL is cached separately by the edge.
    const d = await getJson(url, 300);
    const recs = (d && d._embedded && d._embedded.records) || [];
    if (!recs.length) break;
    for (const o of recs) {
      // Paid TO the collector, and never the collector moving its own balance. Identical test to the
      // one in _realdata.js and the admin page.
      if (o.to === FEE && o.from && o.from !== FEE) out.push(o);
    }
    const next = d && d._links && d._links.next && d._links.next.href;
    if (!next || recs.length < PAGE) break;
    url = next;
  }
  return out;
}

// One receipt's gross, from JSON operations.
//
// FIELD MAPPING against the browser's XDR version (grossOf in _tools/_admin.js), so the two can be
// diffed rather than trusted:
//
//     XDR                                   JSON
//     o.type === "pathPaymentStrictSend"    o.type === "path_payment_strict_send"
//     o.destination                         o.to
//     o.sendAmount                          o.source_amount
//     o.sendAsset.isNative()                o.source_asset_type === "native"
//     o.sendAsset.code / .issuer            o.source_asset_code / o.source_asset_issuer
//     o.type setOptions/createAccount/      set_options / create_account /
//       liquidityPoolDeposit                  liquidity_pool_deposit
//
// The swap leg is the path payment whose destination is the PAYER -- a user swapping into their own
// account. The fee legs are whatever else in the same transaction pays the collector. Gross is the
// user's send amount plus the fee, denominated in the asset being sent, exactly as the browser does.
function grossOf(ops, from) {
  let swap = null, fee = 0, mint = false;
  for (const o of ops) {
    const t = o.type;
    if (t === 'set_options' || t === 'create_account' || t === 'liquidity_pool_deposit') mint = true;
    if (t === 'path_payment_strict_send' && o.to === from) { swap = o; continue; }
    if (o.to === FEE) fee += (+o.source_amount || +o.amount || 0);
  }
  const kind = swap ? 'trade' : (mint ? 'mint' : 'other');
  if (!swap) return { kind, code: null, iss: '', gross: 0 };
  const native = o_native(swap);
  const code = native ? 'XLM' : (swap.source_asset_code || null);
  if (!code) return { kind, code: null, iss: '', gross: 0 };
  return {
    kind,
    code,
    iss: native ? '' : (swap.source_asset_issuer || ''),
    gross: (+swap.source_amount || 0) + fee,
  };
}
function o_native(o) { return o.source_asset_type === 'native'; }

// Operations for one transaction. limit=50 because a LumosCore envelope is a handful of operations;
// the dust-spam transactions that also reach this collector carry 100, and truncating those is
// harmless — they contain no swap of ours either way.
//
// CONCURRENCY, not a loop. 366 receipts at ~150ms serial is ~55 seconds, which would blow the wall
// clock even though the paid plan allows the CPU. Twenty-four at a time brings a cold build to a few
// seconds. The paid plan's 10,000-subrequest ceiling makes the total (2 pages + 366 ops) a non-issue;
// on the old 50 cap this endpoint could not have existed.
async function fetchOps(hashes) {
  const out = new Map();
  let i = 0;
  async function worker() {
    for (;;) {
      const k = i++;
      if (k >= hashes.length) return;
      const h = hashes[k];
      try {
        const d = await getJson(HORIZON + '/transactions/' + h + '/operations?limit=50', OP_TTL);
        out.set(h, (d && d._embedded && d._embedded.records) || []);
      } catch (_) {
        // Left absent rather than stored as an empty list: "we could not read it" and "it had no
        // operations" must not collapse into one value. The caller counts it as unresolved.
        }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, hashes.length) }, worker));
  return out;
}

export async function onRequestGet(ctx) {
  const { request, env, waitUntil } = ctx;
  // First, before any upstream work — the same order revexclude uses, so a non-admin never costs us
  // a Horizon page.
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const store = mkStore(env);
  const KEY = 'revvolume:v1';

  // STALE-WHILE-REVALIDATE (2026-11-21). The answer used to expire after 15 minutes, and the next admin page
  // load then waited ~4 s while this rebuilt from Horizon -- measured as the slowest request on Assets, with
  // everything that needs volume queued behind it. Now the last good answer is kept for a week and returned
  // at once; when it is older than OUT_TTL one rebuild runs in the background (a short lock stops every page
  // load from starting its own). A failed rebuild leaves the previous answer in place -- never cached as one.
  const hit = await store.get(KEY);
  if (hit && hit.rows) {
    const age = Date.now() - (+hit.built || 0);
    if (age > OUT_TTL * 1000) {
      const lock = await store.get(KEY + ':lock');
      if (!lock) {
        waitUntil((async () => {
          await store.put(KEY + ':lock', { at: Date.now() }, 120);
          const fresh = await build(store.kind).catch(() => null);
          if (fresh) await store.put(KEY, fresh, STALE_TTL);
        })());
      }
    }
    return json(hit, 200, 60);
  }

  const body = await build(store.kind).catch((e) => ({ error: String((e && e.message) || e) }));
  // An unreachable Horizon is NOT zero volume. Say which it was and let the caller keep its own
  // fallback rather than publishing a confident nought.
  if (!body || body.error) return json({ ok: false, error: (body && body.error) || 'build failed', rows: [] }, 502);
  waitUntil(store.put(KEY, body, STALE_TTL));
  return json(body, 200, 60);
}

async function build(kind) {
  const receipts = await allReceipts();

  const hashes = [...new Set(receipts.map((r) => r.transaction_hash).filter(Boolean))];
  const opsBy = await fetchOps(hashes);

  const rows = [];
  let unresolved = 0, noSwap = 0;
  for (const r of receipts) {
    const ops = opsBy.get(r.transaction_hash);
    if (!ops) { unresolved++; continue; }           // could not read it — distinct from "no swap"
    const g = grossOf(ops, r.from);
    if (!g.gross) noSwap++;
    rows.push({
      h: r.transaction_hash,
      t: Date.parse(r.created_at) || 0,
      from: r.from,
      code: g.code,
      iss: g.iss,
      gross: g.gross,
      kind: g.kind,
      fee: +r.amount || 0,
      feeCode: r.asset_type === 'native' ? 'XLM' : (r.asset_code || ''),
      feeIss: r.asset_type === 'native' ? '' : (r.asset_issuer || ''),
    });
  }

  const body = {
    ok: true,
    rows,
    receipts: receipts.length,
    // Reported separately on purpose. `noSwap` is a fact about the transactions (mints, listing fees,
    // bridges whose fee rode elsewhere, dust spam); `unresolved` is a fact about US failing to read
    // them. Collapsing the two is what made the old number quotable as all-time.
    noSwap,
    unresolved,
    capped: receipts.length >= MAX_PAGES * PAGE,
    built: Date.now(),
    store: kind,
  };
  return body;
}
