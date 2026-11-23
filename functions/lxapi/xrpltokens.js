// Market rows for the Trade page: the XRP Ledger's most-traded tokens.
//
// Separate from /lxapi/xrplprices on purpose. That one answers "what is this list of tokens worth",
// keyed by slug and stripped to three numbers. This one answers "what should the market table show",
// ordered by volume and carrying the columns that table has. Merging them would mean sending every
// caller the union of both, and the wallet does not need day high/low or TVL.
//
// One upstream page (top 100 by 24h volume), edge-cached. Same reasons as xrplprices: the anonymous
// tier is 333 requests per DAY per IP, so this cannot be fetched from the visitor's browser.
//
// LOGOS: each row carries `m`, the token's md5. The page turns that into /lxapi/xrplthumb?id=<m>,
// which proxies the image server-side -- xrpl.to's thumbnail endpoint needs the API key, and that
// key must never reach the browser. Initials remain the fallback when a token has no logo.

// Shared with xrplsearch and xrpltoken, so a token cannot be ticked on one surface and plain on
// another — which is worse than either answer on its own.
import { vouched, hidden, issuerName, issuerDomain, tickerOf, currencyOf, vouchedTokens } from './_unvouched.js';
import { issuerDomains } from './_issuerdomain.js';

const UP = 'https://api.xrpl.to/api';
const TTL = 120;

const json = (body, secs) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=' + secs,
    'access-control-allow-origin': '*',
  },
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function upstream(path, env) {
  // The User-Agent is required: without one the upstream answers 403 to everything. Measured.
  const headers = { accept: 'application/json', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(UP + path, { headers });
    if (r.ok) return r.json();
    if (r.status !== 429 || attempt === 1) throw new Error('upstream ' + r.status);
    const ra = Number(r.headers.get('retry-after'));
    await sleep(isFinite(ra) && ra > 0 && ra <= 5 ? ra * 1000 : 1200);
  }
  throw new Error('upstream 429');
}

const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };

import { loadVouched } from './_unvouched.js';

export async function onRequest(context) {
  const { request, env } = context;
  // Admin-curated tokens (RAZA 2026-11-24, _netcurated.js) join the built-in list before anything reads it.
  await loadVouched(env);
  const url = new URL(request.url);
  const n = Math.min(100, Math.max(1, parseInt(url.searchParams.get('n') || '50', 10) || 50));

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?n=' + n, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let out;
  try {
    const bulk = await upstream('/tokens?limit=100&sort=vol24hxrp&order=desc&lightweight=true', env);

    // XRP per USD from the same response the prices came from, so the two cannot drift apart.
    const xrpPerUsd = Number(bulk && bulk.exch && bulk.exch.USD);
    const usdPerXrp = xrpPerUsd > 0 ? 1 / xrpPerUsd : null;

    const rows = [];
    for (const t of ((bulk && bulk.tokens) || [])) {
      const p = Number(t.exch);
      if (!isFinite(p)) continue;
      // Dropped before anything else reads it. This endpoint IS the roster -- the Trade table, the
      // asset page's curated test, the wallet and the swap pickers all come through here -- so one
      // skip here removes the token from all of them at once.
      if (hidden(t.issuer, t.currency)) continue;
      const mm = Array.isArray(t.maxMin24h) ? t.maxMin24h : [];
      rows.push({
        c: t.currency, i: t.issuer,
        n: String(t.name || ''),
        u: issuerName(t.issuer, t.currency, t.user),  // the issuer's display name, e.g. "Fuzzybear"
        p: p,                                  // price in XRP
        d: num(t.pro24h), w: num(t.pro7d),
        v: num(t.vol24hxrp), t: num(t.tvl),
        x: num(t.vol24htx),                    // trade count in 24h, for the Trades column
        m: String(t.md5 || ''),               // logo id; the page fetches it via /lxapi/xrplthumb
        hi: num(mm[0]), lo: num(mm[1]),
        h: num(t.holders),
        // MEMBERSHIP OF THIS LIST IS ITSELF THE VOUCH, hence `1` rather than `t.verified`.
        //
        // This endpoint IS the curated roster — the top of the XRP Ledger market by volume, which is
        // what the Trade table lists and what the asset page, the wallet and the search panel all
        // test against. The tick on those surfaces has meant "LumosCore lists this" since 2026-10-02,
        // and the asset page already implemented exactly that by testing membership here.
        //
        // The Trade TABLE did not: it read this `vf`, which is the upstream's gateway flag and is 0
        // for most of the roster, so the same token was ticked on the asset page and bare in the
        // table one click away. RAZA, 2026-10-17: "Why arent the curated assets on XRPL carrying
        // verification icon on Trade-main page. For eg phnix, bchamp, army, drop". Both surfaces now
        // read one field decided in one place.
        //
        // vouched() still has the final say, so the deny list can veto a row that is in the roster --
        // which is the whole point of its one entry: GateHub's USDC ranks ninth and must not be
        // ticked anywhere ("Remove curated and verification icon from this usdc because its not the
        // real by circle").
        //
        // NOT the Mints view: those rows are built in the browser from the launchpad, never from
        // here, and carry vf:0 of their own. The 2026-10-11 rule ("A MINT IS NOT CURATED") is
        // untouched by this.
        vf: vouched(t.issuer, t.currency, 1),
        o: String(t.origin || ''),
      });
      if (rows.length >= n) break;
    }

    // VOUCHED MEANS LISTED, not merely ticked. NO BACKTICKS IN THIS COMMENT.
    //
    // RAZA 2026-10-20: "ATOM is a curated asset but its not in the assets list on Trade-main page."
    // Measured: the roster is the top hundred by 24h volume, its lowest member trades 424.56 XRP a
    // day, and ATOM trades 0.22 — about 1,900x below the cut, so no ranking rule can ever reach it.
    // The allow list in _unvouched.js gave it a tick on every surface while this endpoint, which IS
    // the roster, still answered purely by volume. One token ticked everywhere and listed nowhere.
    //
    // Appended HERE rather than pinned in the page, for the reason stated at the top of this file:
    // the Trade table, the asset page's curated test, the wallet and the swap pickers all read this
    // response, and a token pinned into one of them would be missing from the other three. It also
    // means the next entry added to ALLOW appears everywhere with no second edit — which is the
    // mismatch that produced this report.
    //
    // AFTER the n cap on purpose. These rows are not competing for a ranked seat; they are listed
    // because we vouch for them, so a caller asking for the top 50 gets 50 ranked rows plus the
    // vouched ones. They are appended last, which is also where they sort once the page orders by
    // volume — honest about how little they trade.
    //
    // Degrades to absence: each lookup is independent, failures are swallowed, and the whole group
    // is given one ceiling so a slow upstream delays the market table by at most that much rather
    // than by one timeout per token. A vouched token that cannot be fetched is simply not listed
    // this minute, which is what the page showed before this existed.
    const have = new Set(rows.map((r) => r.i + '|' + tickerOf(r.c)));
    const missing = vouchedTokens().filter((v) => !have.has(v.issuer + '|' + v.ticker)
      && !hidden(v.issuer, currencyOf(v.ticker)));
    //
    // Each lookup races the ONE deadline and returns a row or null; nothing writes to rows from
    // inside a promise. A fetch that lands after the deadline has already lost its race and is
    // discarded — if it pushed instead, it could mutate the array between building the response and
    // serialising it, and two visitors a second apart would get different rows from one cache fill.
    if (missing.length) {
      const deadline = sleep(2500).then(() => null);
      const fetchOne = async (v) => {
        try {
          const one = await upstream('/token/' + encodeURIComponent(v.issuer + '-' + currencyOf(v.ticker)), env);
          const t = one && one.token;
          if (!t) return null;
          const p = Number(t.exch);
          if (!isFinite(p)) return null;
          const mm = Array.isArray(t.maxMin24h) ? t.maxMin24h : [];
          return ({
            c: t.currency, i: t.issuer,
            n: String(t.name || v.ticker),
            u: issuerName(t.issuer, t.currency, t.user),
            p: p,
            d: num(t.pro24h), w: num(t.pro7d),
            v: num(t.vol24hxrp), t: num(t.tvl),
            x: num(t.vol24htx),
            m: String(t.md5 || ''),
            hi: num(mm[0]), lo: num(mm[1]),
            h: num(t.holders),
            // Reads the same decision as every other row. It is in ALLOW by definition of being
            // here, so this is 1 — but it is asked, not asserted, so a later DENY entry would win.
            vf: vouched(t.issuer, t.currency, 1),
            o: String(t.origin || ''),
          });
        } catch (e) { return null; }            // not listed this minute
      };
      const got = await Promise.all(missing.map((v) => Promise.race([fetchOne(v), deadline])));
      for (const r of got) if (r) rows.push(r);
    }

    // Same stablecoin guard as xrplprices: USD here is derived from the XRP rate, and an inverted
    // ratio yields plausible-looking prices rather than an error. If nothing anchors it, send null
    // and let the page show XRP only.
    let usd = usdPerXrp;
    const peg = rows.find((r) => r.n === 'RLUSD');
    if (usd == null || !peg || !(peg.p * usd > 0.90 && peg.p * usd < 1.10)) usd = null;

    // Whole-market figures for the dashboard. They ride along in the SAME response the token rows
    // come from, so this costs no extra upstream call and cannot drift from the prices beside it.
    // Everything here is denominated in XRP unless the name says otherwise.
    const g = (bulk && bulk.global) || {};
    const h = (bulk && bulk.H24) || {};

    out = {
      ok: true, usd, count: rows.length,
      // How many tokens the ledger has, as opposed to how many this response carries. The dashboard
      // needs the former and was showing a mock 4,234 against a real 20,362.
      total: num(bulk && bulk.total),
      stats: {
        dexVol24: num(g.gDexVolume),
        tvl: num(g.totalTVL),
        marketcap: num(g.gMarketcap),
        trustlines: num(g.totalTrustLines),
        addresses: num(g.totalAddresses),
        activeAddresses24: num(h.activeAddresses24H),
        transactions24: num(h.transactions24H),
        tradedTokens24: num(h.tradedTokens24H),
        traders24: num(h.uniqueTraders24H),
      },
      rows,
      src: 'xrpl.to', attribution: 'Data by xrpl.to', attributionUrl: 'https://xrpl.to',
    };
  } catch (e) {
    // YESTERDAY'S PRICES BEAT AN EMPTY TABLE (RAZA 2026-09-17: "sometimes i get this error when i open trade main page" —
    // "Market data is unavailable right now"). The upstream allows 333 requests a DAY per IP and answers 429 once that is
    // spent, so the whole market table vanished for everyone until the cache warmed again.
    //
    // The last good answer is kept under its own key for a day and served when the live one fails, marked `stale` with the
    // time it was taken so the page can say so rather than passing old figures off as current.
    //
    // AND WHICHEVER ANSWER THIS IS, IT IS NOW HELD UNDER THE MAIN KEY (RAZA 2026-11-17, dashboard cards
    // grey for seconds). The stale copy used to be returned WITHOUT a cache.put, so during a 429
    // window every visitor paid the ~1.6s back-off-and-retry again and asked the refusing upstream
    // again. Held briefly so a refusal costs one upstream call per colo: the labelled stale copy 60s,
    // a plain failure 30s (seconds only -- never-cache-a-failure rule).
    const err = String((e && e.message) || e);
    const last = await cache.match(lastKey(url, n)).catch(() => null);
    const old = last ? await last.json().catch(() => null) : null;
    const isStale = !!(old && old.rows && old.rows.length);
    const res = isStale
      ? json({ ...old, stale: true, error: err }, 60)
      : json({ ok: false, error: err, rows: [] }, 30);
    res.headers.set('x-lx-upstream', isStale ? 'stale' : 'failed');
    context.waitUntil(cache.put(key, res.clone()));
    return res;
  }

  // THE ISSUER'S HOME DOMAIN, READ FROM THE LEDGER, for the line under each asset in the market table
  // (RAZA 2026-10-17: "Still shown the company/project name instead of the homedomain. For eg: it
  // should have been circle.com instead or just circle").
  //
  // NOT xrpl.to's `domain` field, even though it sits right there in the same payload and would have
  // been one line. That field is supplied by whoever listed the token, so a token can claim anything —
  // the four ATOMs claimed x.com and cosmos.github.io — which is the exact complaint _issuerdomain.js
  // was written for on 2026-10-02. The AccountRoot Domain is set by the issuing account itself, in a
  // transaction it signed, and that is what this resolves.
  //
  // Same call the search panel makes, so the two agree and share the per-issuer cache: a warm issuer
  // costs nothing, and the deadline means a cold one degrades to no domain rather than a slow table.
  let domReached = true;
  try {
    // 3000ms, NOT the 1200ms default. That default was chosen for the search box, where the domain is
    // a badge beside a result that must not wait for it; here the domain is the second line of every
    // row in the market table and a blank one is the bug RAZA reported twice. The lookups run in
    // parallel, so this is one 3s ceiling for all 99 issuers, not 99 of them — and a warm per-issuer
    // cache returns in milliseconds, so only a cold colo ever approaches it.
    const map = await issuerDomains(out.rows.map((r) => r.i), url.origin, context, null, 3000);
    // EVERY row is overwritten, the unresolved ones included — keeping a claimed domain for those
    // would make a row say "x.com" or nothing depending on how fast the ledger answered.
    for (const r of out.rows) r.dom = issuerDomain(r.i, r.c, map[r.i] || '');
    domReached = out.rows.every((r) => Object.prototype.hasOwnProperty.call(map, r.i));
  } catch (e) { for (const r of out.rows) r.dom = issuerDomain(r.i, r.c, ''); }

  // A cold run that could not reach every issuer is cached briefly, so the first visitor's slow ledger
  // call does not become everyone else's answer while the per-issuer cache warms.
  const res = json(out, domReached ? TTL : 30);
  res.headers.set('x-lx-upstream', 'live');
  context.waitUntil(cache.put(key, res.clone()));
  // …and the copy that outlives the upstream's daily budget.
  context.waitUntil(cache.put(lastKey(url, n), json({ ...out, cachedAt: Date.now() }, 86400)));
  return res;
}

// A second cache entry, kept for a day, holding the last answer the upstream actually gave.
function lastKey(url, n) {
  return new Request(url.origin + url.pathname + '?lastgood=1&n=' + n);
}
