// Cloudflare Pages Function -- the Stellar fee collector's payment history, for the admin panel. ADMIN ONLY.
//
// WHY (2026-11-21). Every admin page that shows revenue, volume or users read this history straight from
// Horizon in the browser: 200 payments a page, each page needing the previous one's cursor, so the pages ran
// one after another. Measured on Assets: the figures that depend on it filled in at ~5.5 s, and the pricing
// that waits for them at ~8 s. The history only ever GROWS -- a settled payment never changes -- so it is
// kept here and returned in one fast call, and a refresh reads only the payments newer than the newest one
// already held.
//
// SAME SHAPE AS HORIZON. `records` are Horizon's own payment records, newest first, with only the `_links`
// blocks dropped. loadRevenue() in _tools/_admin.js filters and labels them exactly as before, and falls
// back to reading Horizon itself whenever this answers anything but ok -- so a failure here costs speed,
// never figures.
//
// STALE-WHILE-REVALIDATE, as revvolume.js: the last good answer is kept a week and returned at once; when
// it is older than FRESH_MS one background refresh runs (a short lock stops every page load starting its
// own). A failed refresh leaves the previous answer in place; a failure is never stored as an answer.
//
// Narrow: GET only, no parameters, one fixed account, Horizon the only host. Reads no secret, touches no
// funds. Gated anyway, like revvolume and revenue: functions/ is shared with the public projects.
import { requireAdmin } from '../../_lib/adminauth.js';

const HORIZON = 'https://horizon.stellar.org';
const FEE = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
const PAGE = 200;            // Horizon's max
const MAX_PAGES = 20;        // 4,000 payments; today there are ~525. A guard, not an expected limit.
const FRESH_MS = 60 * 1000;  // older than this, refresh in the background (new fees show within a minute or two)
const STALE_TTL = 604800;    // keep the last good answer a week
const KEY = 'feeledger:v1';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': (status && status >= 400) ? 'no-store' : 'private, max-age=30',
    },
  });
}

function mkStore(env) {
  const kv = env && (env.LUMOS_KV || env.CONTENT_KV);
  if (kv) {
    return {
      kind: 'kv',
      async get(k) { try { return await kv.get(k, 'json'); } catch (_) { return null; } },
      async put(k, v, ttl) { try { await kv.put(k, JSON.stringify(v), { expirationTtl: Math.max(60, ttl) }); } catch (_) {} },
    };
  }
  const cache = caches.default;
  const req = (k) => new Request('https://lumoscore.internal/feeledger/' + encodeURIComponent(k));
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

async function getPage(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('horizon ' + r.status);
  const d = await r.json();
  const recs = (d && d._embedded && d._embedded.records) || null;
  if (!Array.isArray(recs)) throw new Error('horizon answered without records');
  return recs.map((x) => { const y = Object.assign({}, x); delete y._links; return y; });
}

// Everything, newest first. Used when nothing is held yet.
async function full() {
  let out = [];
  let cursor = '';
  for (let n = 0; n < MAX_PAGES; n++) {
    const recs = await getPage(HORIZON + '/accounts/' + FEE + '/payments?order=desc&limit=' + PAGE + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    out = out.concat(recs);
    if (recs.length < PAGE) return { records: out, capped: false };
    cursor = recs[recs.length - 1].paging_token;
  }
  return { records: out, capped: true };
}

// Only what arrived after the newest record held: oldest-first from that cursor, then flipped and put on top.
async function newer(held) {
  const top = held[0] && held[0].paging_token;
  if (!top) return null;                                  // nothing to anchor on: caller does a full read
  let add = [];
  let cursor = top;
  for (let n = 0; n < MAX_PAGES; n++) {
    const recs = await getPage(HORIZON + '/accounts/' + FEE + '/payments?order=asc&limit=' + PAGE + '&cursor=' + encodeURIComponent(cursor));
    add = add.concat(recs);
    if (recs.length < PAGE) break;
    cursor = recs[recs.length - 1].paging_token;
  }
  const seen = new Set(held.map((r) => r.id));
  const fresh = add.filter((r) => !seen.has(r.id)).reverse();
  return fresh.concat(held);
}

async function build(prev, kind) {
  let records, capped = false;
  if (prev && Array.isArray(prev.records) && prev.records.length) {
    records = await newer(prev.records);
    capped = !!prev.capped;
  }
  if (!records) { const f = await full(); records = f.records; capped = f.capped; }
  return { ok: true, records, count: records.length, capped, built: Date.now(), store: kind };
}

export async function onRequestGet(ctx) {
  const { request, env, waitUntil } = ctx;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const store = mkStore(env);

  const hit = await store.get(KEY);
  if (hit && Array.isArray(hit.records)) {
    if (Date.now() - (+hit.built || 0) > FRESH_MS) {
      const lock = await store.get(KEY + ':lock');
      if (!lock) {
        waitUntil((async () => {
          await store.put(KEY + ':lock', { at: Date.now() }, 60);
          const fresh = await build(hit, store.kind).catch(() => null);
          if (fresh) await store.put(KEY, fresh, STALE_TTL);
        })());
      }
    }
    return json(hit, 200);
  }

  const body = await build(null, store.kind).catch((e) => ({ error: String((e && e.message) || e) }));
  if (!body || body.error) return json({ ok: false, error: (body && body.error) || 'build failed' }, 502);
  waitUntil(store.put(KEY, body, STALE_TTL));
  return json(body, 200);
}
