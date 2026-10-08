// Token logos, proxied so the API key never reaches the browser.
//
// xrpl.to's thumbnail endpoint REQUIRES a key — it answers 401 without one, which is why every
// token on this site has been drawing letter initials. The key is a server-side credential, so the
// page cannot call that endpoint directly: putting it in front-end code would publish it to anyone
// who opens devtools, and it is the same key that carries this project's whole request budget.
//
// So the image is fetched here and passed through. The browser only ever sees /lxapi/xrplthumb.
//
// Cached hard. A token's logo effectively never changes, and every row of every market table asks
// for one, so this is the highest-volume endpoint in the project by a wide margin.

import { tokenId } from './_tokenid.js';
import { tokenIconUrl } from './xrpltoml.js';

const UP = 'https://api.xrpl.to/api/thumb/';
const TTL = 604800;                    // a week; logos do not move
// How long this endpoint stops asking after the upstream refuses.
//
// EIGHT SECONDS, DOWN FROM TWENTY (RAZA 2026-10-06: "whre are the asset logos?"). The cap being
// protected is per-SECOND, so eight is already generous for that — and twenty outlived the retries the
// pages make, which meant a table that hit the window stayed lettered even though it asked again. A
// breaker whose job is to protect prices and search must not also be the reason the logos never come
// back. Paired with the retries in trade.js and wallet.js, which are spaced to land after it reopens.
const BRK_TTL = 8;

// md5('rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha_4C554D4F53' + 30 zeros) — LUMOS, under the same scheme as every other token.
const LUMOS_ID = '5c4fb27e6ea19e0bde8900d2c0a7b177';

// Only the sizes xrpl.to actually serves. Anything else is rejected rather than passed through,
// so this cannot be turned into an open image proxy for arbitrary upstream paths.
const SIZES = [16, 32, 40, 48, 64, 96, 128];

// Bumped to walk away from poisoned entries. The LUMOS branch cached an Access login page as a PNG on every gated
// hostname, with a week's immutable TTL, and nothing a visitor can do shifts a bad answer sitting in the colo's cache
// — see [never cache a failure as an answer]. A new key is the only cheap way out.
// Bumped with the thin-image fallback: SOLO's near-black 150-byte webp is already sitting in the
// edge cache for a week under v2, and a fix nobody can see because the bad answer is cached is not
// a fix.
const CACHEV = '5';

// The eight-byte PNG signature. Cheap, exact, and the one thing that would have caught the Access page.
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function isPng(buf) {
  if (!buf || buf.byteLength < 64) return false;
  const head = new Uint8Array(buf, 0, 8);
  for (let i = 0; i < 8; i++) if (head[i] !== PNG_SIG[i]) return false;
  return true;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // A token id is an md5: exactly 32 hex characters. Validated rather than forwarded, so nothing
  // else can be appended to the upstream path.
  let id = (url.searchParams.get('id') || '').trim().toLowerCase();

  // ...and the id is DERIVABLE, which is what lets the wallet draw logos at all.
  //
  // Every other list on this site takes the id from an API row (`m`), because it is listing tokens
  // the API just ranked. The wallet lists what an ACCOUNT holds, straight off account_lines, and a
  // holding is frequently nowhere near the top of any ranking — so there is no row to take it from,
  // and one lookup per holding would be dozens of requests to price a single page.
  //
  // The derivation itself is in _tokenid.js, shared with the OHLC endpoint.
  if (!id) id = await tokenId(url.searchParams.get('iss'), url.searchParams.get('cur'));

  if (!/^[0-9a-f]{32}$/.test(id)) {
    return new Response('bad id', { status: 400, headers: { 'cache-control': 'public, max-age=3600' } });
  }
  let w = parseInt(url.searchParams.get('w') || '48', 10);
  if (SIZES.indexOf(w) < 0) w = 48;

  const cache = caches.default;
  const key = new Request(url.origin + url.pathname + '?id=' + id + '&w=' + w + '&v=' + CACHEV, request);
  const hit = await cache.match(key);
  if (hit) return hit;

  // THE LUMOS MARK IS THIS PROJECT'S OWN (RAZA 2026-09-16: "Also fix lumos logo. Use the same logo that we're using on
  // Stellar"). The upstream holds a different artwork for the token, and it was being drawn on every surface that shows a
  // logo. Answering here — rather than at each of the dozen call sites — means one rule covers the lot, including rows that
  // arrive with an id and never name the issuer. The file is byte-identical to lumoscore.com's.
  //
  // IT SITS BEHIND THE CACHE NOW, where it always should have been (RAZA 2026-10-05: "why isn't LUMOS logo shown"). This
  // branch used to return above the cache lookup entirely, so the one logo this project actually owns was the only logo on
  // the site that was never cached at the edge: every row of every surface spent an origin subrequest on it, and the file
  // is a 160px PNG — 23.7 KB against the ~800 B the upstream serves for everything else. Measured on the deployed build:
  // ~190 ms per call versus ~115 ms for a cached one, thirty times the bytes, on a mark that never changes.
  //
  // That makes it the slowest and heaviest logo in any list, which is precisely the one that loses a race it is allowed to
  // lose only once — the wallet drew a letter instead. It is now cached for a week like the rest, and the page retries
  // before lettering, so neither half of that depends on the other.
  //
  // AND IT READS THE FILE THROUGH env.ASSETS, NOT THROUGH ITS OWN HOSTNAME (RAZA 2026-10-05: "lumos logo in Wallet --> My
  // assets is not showing up at all" — an empty slot, not even the letter the fallback draws).
  //
  // `fetch(url.origin + '/assets/...')` leaves the worker, comes back in through the edge, AND MEETS CLOUDFLARE ACCESS. The
  // staging alias is gated; a per-deployment hostname is not. So the subrequest got the Access login page, which is a 200,
  // so `own.ok` was true, and this served 51 KB of HTML under `content-type: image/png`. A browser cannot decode that into
  // anything, so the disc painted nothing at all — and because the page's own probe reads the STATUS, it saw 200 and never
  // drew the letter either. Every environment I can test is ungated, which is why this looked fine from here for weeks.
  //
  // env.ASSETS is the binding that reads the project's own static files directly. It never leaves the worker, so there is no
  // hostname and nothing for Access to gate.
  //
  // AND THE BYTES ARE CHECKED BEFORE THEY ARE CALLED A PNG. The signature check is the actual lesson here: whatever a
  // subrequest hands back, this must never label it `image/png` on trust. A 404 at least lets the page draw a letter.
  if (id === LUMOS_ID) {
    const href = url.origin + '/assets/tokens/lumos.png';
    const want = new Request(href, { headers: { accept: 'image/png,image/*' } });
    let own = null, src = 'assets';
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      own = await env.ASSETS.fetch(want).catch(() => null);
    }
    // `redirect: 'manual'` so a gated hostname cannot be followed into a 200 that is a login page. The
    // fallback is only reached when there is no ASSETS binding at all, and `x-lxsrc` says which path
    // answered — the alias is behind Access and cannot be checked from here, so the header is how anyone
    // confirms it on the host that actually has the problem.
    if (!own || !own.ok) { src = 'origin'; own = await fetch(want, { redirect: 'manual' }).catch(() => null); }
    const buf = own && own.ok ? await own.arrayBuffer().catch(() => null) : null;
    if (!isPng(buf)) {
      return new Response('no logo', { status: 404, headers: { 'cache-control': 'no-store', 'x-lxsrc': src + '-notpng' } });
    }
    const res = new Response(buf, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=' + TTL + ', immutable',
        'access-control-allow-origin': '*',
        'x-lxsrc': src,
      },
    });
    context.waitUntil(cache.put(key, res.clone()));
    return res;
  }

  // LOGOS YIELD, BECAUSE THEY ARE THE ONE THING HERE THAT CAN WAIT.
  //
  // RAZA 2026-10-06, twice in ten minutes: "why did the token prices suddenly disappeared" and "Why
  // isnt it searching ATOM asset". Two symptoms, one cause — xrpl.to answering 429. The budget is
  // shared by every endpoint in this directory, and with the key live the daily allowance is nowhere
  // near spent; what gets hit is the per-second burst. A wallet asking for sixty-five marks at once is
  // the single biggest consumer on the site, and it is competing with the two requests the reader is
  // actually waiting on.
  //
  // So once the upstream refuses, this stops asking for twenty seconds and leaves the headroom to
  // prices and search. A letter where a logo should be costs the reader nothing; a blank price column
  // and a search box that cannot find ATOM cost them the page.
  //
  // THE BREAKER IS NOT AN ANSWER ABOUT A TOKEN. It returns 429 — "ask me later" — and never 404, so no
  // row is ever told its mark does not exist; it is `no-store`, so it cannot settle into the colo as
  // that token's reply; and it sits BELOW the cache lookup and the LUMOS branch, so everything already
  // cached and our own mark keep serving straight through it. The page's own probe already treats 429
  // as retryable and holds its queue, so the two halves agree without knowing about each other.
  const brkKey = new Request(url.origin + url.pathname + '/__brk', request);
  if (await cache.match(brkKey)) {
    return new Response('upstream busy', { status: 429, headers: { 'cache-control': 'no-store', 'x-lxbrk': '1' } });
  }

  const headers = { accept: 'image/webp,image/*', 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)' };
  if (env && env.XRPLTO_API_KEY) headers['x-api-key'] = env.XRPLTO_API_KEY;

  // RAZA 2026-09-15: "WHys the logo for this asset not loading" / "some asset logos are not loading" — the image was there;
  // a refused upstream call answered with an error the browser then kept for ten minutes. One retry, and an error is never
  // cached, so the next view asks again.
  let upstream = null;
  // ONE retry, not three. xrpl.to's API policy is explicit -- "Honour Retry-After on a 429: back off, do not
  // retry" -- and four attempts against a burst cap is hammering it, which is how a key gets pulled. A wallet page
  // asking for a hundred logos is exactly the case that used to fan out here; it now backs off once for as long as
  // the upstream asks, and a missing logo is already handled quietly downstream (2026-09-24, with the real key live).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      upstream = await fetch(UP + id + '?w=' + w, { headers });
      if (upstream.ok || upstream.status === 401 || upstream.status === 404) break;
    } catch (e) { upstream = null; }
    const ra = upstream ? Number(upstream.headers.get('retry-after')) : 0;
    await new Promise((res) => setTimeout(res, isFinite(ra) && ra > 0 && ra <= 10 ? ra * 1000 : 600));
  }
  if (!upstream) return new Response('upstream unreachable', { status: 502, headers: { 'cache-control': 'no-store' } });

  // 401 here means the key is missing or rejected. Say so with a status the page can ignore
  // quietly — a missing logo must never break a row.
  if (!upstream.ok) {
    // Trip the breaker on a refusal, so the next sixty-four rows do not each find this out for
    // themselves. A 200 body is used because that is what the Cache API will store; its presence is
    // the whole signal, and its max-age is how long the breaker stays open.
    if (upstream.status === 429) {
      context.waitUntil(cache.put(brkKey, new Response('1', {
        headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=' + BRK_TTL },
      })));
    }
    // NO THUMBNAIL UPSTREAM IS NOT NO LOGO — the issuer may publish one in its own toml.
    //
    // RAZA 2026-10-07: "the logo will be taken from firstledger's toml since army was minted on
    // firstledger so they must be maintaining its toml somewhere". It is: ARMY's [[TOKENS]] block
    // carries `icon = https://ipfs.firstledger.net/ipfs/Qm…`. This is also the only place a token
    // minted minutes ago can have artwork at all, since xrpl.to has not indexed it yet — which
    // includes every token this launchpad issues.
    //
    // A FALLBACK, NOT THE PRIMARY SOURCE, and that is a cost decision. Reading a toml means
    // resolving the issuer's Domain and fetching a file from its host; doing that FIRST would add
    // two hops to every logo in every table, against an upstream that rate-limits. xrpl.to answers
    // for everything it has indexed in one cached call, so the toml is consulted only where that
    // comes back empty.
    //
    // Fetched HERE and streamed, never handed to the browser as a src: the url is a string an
    // anonymous account chose, so the issuer's host never sees a visitor's address, and the bytes
    // are type-checked below exactly as the upstream's are.
    const tIss = (url.searchParams.get('iss') || '').trim();
    const tCur = (url.searchParams.get('cur') || '').trim();
    if ((upstream.status === 404 || upstream.status === 401) && tIss && tCur) {
      const icon = await tokenIconUrl(tIss, tCur, url.origin, context);
      if (icon) {
        try {
          const ac2 = new AbortController();
          const t2 = setTimeout(() => ac2.abort(), 5000);
          const img = await fetch(icon, { headers: { accept: 'image/*' }, signal: ac2.signal, redirect: 'follow' });
          clearTimeout(t2);
          const ct = (img.headers.get('content-type') || '').toLowerCase();
          if (img.ok && ct.indexOf('image/') === 0 && ct.indexOf('svg') < 0) {
            const bytes = await img.arrayBuffer();
            // A logo is small. Anything larger is either not a logo or is meant to cost us.
            if (bytes.byteLength && bytes.byteLength <= 512 * 1024) {
              const tomlRes = new Response(bytes, {
                headers: {
                  'content-type': ct,
                  'cache-control': 'public, max-age=' + TTL,
                  'access-control-allow-origin': '*',
                  'x-lxsrc': 'toml',
                },
              });
              context.waitUntil(cache.put(key, tomlRes.clone()));
              return tomlRes;
            }
          }
        } catch (e) { /* the issuer's host is not ours to depend on */ }
      }
    }
    return new Response('no logo', {
      status: upstream.status === 401 ? 404 : upstream.status,
      headers: { 'cache-control': upstream.status === 404 || upstream.status === 401 ? 'public, max-age=600' : 'no-store' },
    });
  }

  const body = await upstream.arrayBuffer();

  // A 200 FROM THE UPSTREAM IS NOT PROOF OF A LOGO (RAZA 2026-10-08: "Why is SOLO asset on XRPL
  // showing incorrectly everywhere. Its logo is different").
  //
  // xrpl.to answers for SOLO with a perfectly valid 64x64 webp of 150 bytes which is almost entirely
  // black with a yellow-green speck in the middle. Decoded pixel by pixel on the deployed build: 100%
  // opaque, every colour from rgb(16,16,16) up, centre pixel rgb(207,244,31) — which is exactly the
  // dot in the screenshot. We were asking for the right token (the md5 recomputes from
  // issuer_currencyHex and matches what our own search returns) and proxying it faithfully. The
  // artwork upstream is simply wrong, and because it arrives as a 200 the fallbacks below — which
  // only ever fired on 404 and 401 — never got a chance to find the real one.
  //
  // THE FLOOR IS MEASURED, NOT GUESSED. Across sixteen of the busiest tokens at w=64 the smallest
  // REAL logo was 328 bytes (Equilibrium) and typical ones run 600-2000, against SOLO's 150; at
  // w=32 and w=128 SOLO came in at 124 and 268. `w * 4` sits between the two at every width this
  // endpoint serves, and a false positive is cheap — the replacement is still that token's own
  // published artwork, so the worst case is a different CORRECT logo, never a wrong one.
  if (body.byteLength >= w * 4) {
    const res = new Response(body, {
      headers: {
        'content-type': upstream.headers.get('content-type') || 'image/webp',
        'cache-control': 'public, max-age=' + TTL + ', immutable',
        'access-control-allow-origin': '*',
      },
    });
    context.waitUntil(cache.put(key, res.clone()));
    return res;
  }

  // THE ID IS ENOUGH; THE CALLERS DO NOT HAVE TO CHANGE. An md5 is one-way, so the toml and
  // XRPLMeta lookups below need the issuer and currency it was made from — and almost every caller
  // sends only `id`, which is why the existing 404 toml fallback has been largely unreachable from
  // the pool and trade tables. xrpl.to's own token endpoint maps the id straight back, using the
  // same upstream and key this file already holds, so one extra call on the rare thin image fixes
  // every caller at once. Asked for directly rather than through our own /lxapi/xrpltoken: a worker
  // fetching its own hostname meets Cloudflare Access on the gated alias and gets a login page
  // with a 200 on it, which is the trap documented for env.ASSETS above.
  let bIss = (url.searchParams.get('iss') || '').trim();
  let bCur = (url.searchParams.get('cur') || '').trim();
  if (!bIss || !bCur) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 4000);
      const meta = await fetch('https://api.xrpl.to/api/token/' + encodeURIComponent(id),
        { headers: { accept: 'application/json', 'user-agent': headers['user-agent'], ...(headers['x-api-key'] ? { 'x-api-key': headers['x-api-key'] } : {}) }, signal: ac.signal });
      clearTimeout(t);
      if (meta.ok) {
        const j = await meta.json();
        const tok = (j && (j.token || j)) || {};
        if (!bIss && typeof tok.issuer === 'string') bIss = tok.issuer.trim();
        if (!bCur && typeof tok.currency === 'string') bCur = tok.currency.trim();
      }
    } catch (e) { /* without it the upstream's own bytes still go out below */ }
  }
  const better = (bIss && bCur) ? await betterIcon(bIss, bCur, url.origin, context) : null;
  if (better) {
    context.waitUntil(cache.put(key, better.clone()));
    return better;
  }

  // BELOW A CERTAIN POINT THERE IS NO IMAGE TO DEFEND, so say 404 and let the page draw its letter.
  // DIPX's upstream logo is a 70-byte 64x64 square that is 100% pure black, and XRPLMeta's copy for
  // it is a 458x344 rectangle that is also entirely black — there is no artwork for this token
  // anywhere, and painting a black disc in a row of logos reads as a broken image, while the letter
  // the page already draws on a 404 reads as a token without a logo, which is the truth.
  //
  // A SEPARATE, MUCH LOWER BAR than the one that goes looking for a better source. Trying another
  // source costs nothing if it fails, so that threshold can sit high; discarding the only image
  // there is cannot be undone by the page, so this one is half of it — well under the 322 bytes of
  // the smallest real logo measured across the top hundred tokens.
  if (body.byteLength < w * 2) {
    return new Response('no logo', {
      status: 404,
      headers: { 'cache-control': 'public, max-age=600', 'x-lxsrc': 'blank' },
    });
  }

  // Otherwise the upstream's own bytes still go out: a poor logo beats an empty slot.
  //
  // AND THIS ONE IS NOT STORED. The cache key is the id and the width, not the query that produced
  // it, so caching a thin image fetched by a caller that sent no iss/cur would serve that same thin
  // image to every later caller that DID send them — the fix would work once and then be cached
  // out of existence. A short browser max-age keeps a list of sixty rows from re-asking, without
  // putting the poor answer where the good one belongs.
  return new Response(body, {
    headers: {
      'content-type': upstream.headers.get('content-type') || 'image/webp',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
      'x-lxsrc': 'upstream-thin',
    },
  });
}

// The issuer's own toml first, then XRPLMeta — the two sources this build already trusts for a
// token's identity, in the order that prefers what the issuer publishes about itself. XRPLMeta is
// what actually rescues SOLO: it carries the real 100x100 red mark, and this build already reads it
// for descriptions, with attribution.
//
// Fetched here and streamed rather than handed to the browser as a src, exactly as the 404 path
// does: these urls are strings someone else chose, so a visitor's address never reaches them, and
// the bytes are type- and size-checked before they are called an image.
async function betterIcon(iss, cur, origin, context) {
  const urls = [];
  try {
    const own = await tokenIconUrl(iss, cur, origin, context);
    if (own) urls.push(own);
  } catch (e) { /* the issuer's host is not ours to depend on */ }
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const m = await fetch('https://s1.xrplmeta.org/token/' + encodeURIComponent(cur) + ':' + encodeURIComponent(iss),
      { headers: { accept: 'application/json' }, signal: ac.signal });
    clearTimeout(t);
    if (m.ok) {
      const j = await m.json();
      const ic = j && j.meta && j.meta.token && j.meta.token.icon;
      if (typeof ic === 'string' && /^https:\/\//i.test(ic) && ic.length <= 500) urls.push(ic);
    }
  } catch (e) { /* XRPLMeta is a convenience, never a dependency */ }

  for (const u of urls) {
    try {
      const ac2 = new AbortController();
      const t2 = setTimeout(() => ac2.abort(), 5000);
      const img = await fetch(u, { headers: { accept: 'image/*' }, signal: ac2.signal, redirect: 'follow' });
      clearTimeout(t2);
      const ct = (img.headers.get('content-type') || '').toLowerCase();
      if (!img.ok || ct.indexOf('image/') !== 0 || ct.indexOf('svg') >= 0) continue;
      const bytes = await img.arrayBuffer();
      // Big enough to be artwork, small enough not to be a payload aimed at us.
      if (!bytes.byteLength || bytes.byteLength > 512 * 1024) continue;
      // AND THE REPLACEMENT HAS TO BE BETTER THAN WHAT IT REPLACES. Caught by sweeping the pools:
      // DIPX's icon here is a 458x344 image that is ENTIRELY BLACK — rgb(0,0,0) and rgb(1,1,1), no
      // transparency — and a uniform image compresses to almost nothing, so it slipped under a floor
      // meant to catch thin files. It is served at natural size, not 64px, so the bar is higher than
      // the one upstairs: real artwork at its own resolution is kilobytes (SOLO's is 9.9 KB), while
      // a flat rectangle is a few hundred bytes whatever its dimensions.
      //
      // Erring high is the safe direction. Rejecting a good replacement only leaves the upstream
      // image we would have shown anyway; accepting a bad one puts a black box on the page.
      if (bytes.byteLength < 1200) continue;
      return new Response(bytes, {
        headers: {
          'content-type': ct,
          'cache-control': 'public, max-age=' + TTL,
          'access-control-allow-origin': '*',
          'x-lxsrc': 'better',
        },
      });
    } catch (e) { /* try the next source */ }
  }
  return null;
}
