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

const UP = 'https://api.xrpl.to/api/thumb/';
const TTL = 604800;                    // a week; logos do not move
// How long this endpoint stops asking after the upstream refuses. Twenty seconds: longer than the
// burst window that caused it, shorter than anyone waits for a logo.
const BRK_TTL = 20;

// md5('rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha_4C554D4F53' + 30 zeros) — LUMOS, under the same scheme as every other token.
const LUMOS_ID = '5c4fb27e6ea19e0bde8900d2c0a7b177';

// Only the sizes xrpl.to actually serves. Anything else is rejected rather than passed through,
// so this cannot be turned into an open image proxy for arbitrary upstream paths.
const SIZES = [16, 32, 40, 48, 64, 96, 128];

// Bumped to walk away from poisoned entries. The LUMOS branch cached an Access login page as a PNG on every gated
// hostname, with a week's immutable TTL, and nothing a visitor can do shifts a bad answer sitting in the colo's cache
// — see [never cache a failure as an answer]. A new key is the only cheap way out.
const CACHEV = '2';

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
    return new Response('no logo', {
      status: upstream.status === 401 ? 404 : upstream.status,
      headers: { 'cache-control': upstream.status === 404 || upstream.status === 401 ? 'public, max-age=600' : 'no-store' },
    });
  }

  const body = await upstream.arrayBuffer();
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
