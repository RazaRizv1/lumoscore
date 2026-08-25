// Cloudflare Pages Function — resolve an asset's logo from its issuer's stellar.toml, server-side.
//
// SEP-1 says the toml is THE source for an asset's metadata, and it is: issuer -> home_domain ->
// /.well-known/stellar.toml -> the [[CURRENCIES]] entry -> image. The browser cannot follow that chain
// reliably, because SEP-1 also requires the toml host to send CORS headers and plenty do not -- lu.meme,
// skullfriend.com and stellardrones.keybase.pub all refuse in-browser today. Those assets ended up wearing
// a generated initials disc even though their real logo was published and reachable.
//
// A server has no such restriction. Fetching from our own origin turns "unreadable" into "one request",
// and it is why this exists rather than another client-side fallback.
//
// It also removes the reason for the hardcoded brand map: EURC, for one, has no tomlInfo image in
// stellar.expert's index but does publish one in Circle's toml. Hand-maintained logo URLs rot; the toml
// is maintained by the issuer.
//
// Deliberately narrow, so this cannot be used as an open proxy: GET only, the asset must match
// CODE-GISSUER exactly, only the issuer's OWN declared domain is contacted, and only the well-known path
// on it. Nothing here reads a secret or touches user funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;
const HOST_RE = /^[A-Za-z0-9.-]{1,253}$/;

// Long, because a toml changes about as often as a company rebrands. A miss costs two upstream hops, so
// the cache is what makes this affordable on a page listing 25 assets.
const TTL_HIT = 86400;   // 24h for a resolved logo
const TTL_MISS = 3600;   // 1h for "this asset publishes none" -- retry sooner in case one appears

// Some toml hosts are slow or dead. A row must not wait on them.
const TIMEOUT_MS = 4000;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + (ttl || TTL_MISS),
      'access-control-allow-origin': '*',
    },
  });
}

function withTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal, cf: { cacheTtl: TTL_HIT, cacheEverything: true } })
    .finally(() => clearTimeout(t));
}

// A minimal [[CURRENCIES]] reader. Not a general TOML parser: it walks the blocks and reads the handful of
// keys we need, which keeps it small and means a malformed value elsewhere in the file cannot break it.
function findCurrency(text, code, issuer) {
  const blocks = String(text || '').split('[[CURRENCIES]]');
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const get = (key) => {
      const lines = b.split('\n');
      for (let n = 0; n < lines.length; n++) {
        const ln = lines[n].trim();
        const eq = ln.indexOf('=');
        if (eq < 0) continue;
        if (ln.slice(0, eq).trim() !== key) continue;
        let v = ln.slice(eq + 1).trim();
        if (v.charAt(0) === '"') {
          const e = v.indexOf('"', 1);
          v = e > 0 ? v.slice(1, e) : v.slice(1);
        }
        return v;
      }
      return '';
    };
    if (get('code') !== code) continue;
    // An issuer line is optional in some tomls; when present it must agree, so a file cannot claim
    // an asset it does not issue.
    const iss = get('issuer');
    if (iss && iss !== issuer) continue;
    return {
      image: get('image') || '',
      name: get('name') || '',
      // The page needs these for the same reason it needs the image, and they are already in hand.
      desc: get('desc') || '',
      twitter: get('twitter') || '',
      telegram: get('telegram') || '',
      domainOnly: false,
    };
  }
  return null;
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const asset = q.get('asset') || '';
  if (!ASSET_RE.test(asset)) return json({ error: 'bad asset' }, 400, 60);

  const dash = asset.lastIndexOf('-');
  const code = asset.slice(0, dash);
  const issuer = asset.slice(dash + 1);

  try {
    // 1) the issuer names its own domain; we never guess one
    const accRes = await withTimeout('https://horizon.stellar.org/accounts/' + issuer, TIMEOUT_MS);
    if (!accRes.ok) return json({ image: '', domain: '', reason: 'issuer not found' }, 200, TTL_MISS);
    const acc = await accRes.json();
    const domain = (acc && acc.home_domain) || '';
    if (!domain) return json({ image: '', domain: '', reason: 'no home_domain' }, 200, TTL_MISS);
    if (!HOST_RE.test(domain)) {
      // some issuers put a whole URL in home_domain; only a bare host can be joined to the well-known path
      return json({ image: '', domain: domain, reason: 'home_domain is not a host' }, 200, TTL_MISS);
    }

    // 2) the toml on that domain, and only the well-known path
    const tomlRes = await withTimeout('https://' + domain + '/.well-known/stellar.toml', TIMEOUT_MS);
    if (!tomlRes.ok) return json({ image: '', domain: domain, reason: 'toml ' + tomlRes.status }, 200, TTL_MISS);
    const text = await tomlRes.text();

    const cur = findCurrency(text, code, issuer);
    if (!cur) return json({ image: '', domain: domain, reason: 'asset not in toml' }, 200, TTL_MISS);

    // Org-level socials as a fallback: many issuers declare them once for the org rather than per asset.
    const org = (key) => {
      const m = String(text || '').match(new RegExp('^\\s*' + key + '\\s*=\\s*["\']([^"\']+)["\']', 'im'));
      return (m && m[1]) || '';
    };
    const body = {
      image: cur.image,
      domain: domain,
      name: cur.name,
      desc: cur.desc,
      twitter: cur.twitter || org('ORG_TWITTER'),
      telegram: cur.telegram || org('ORG_TELEGRAM'),
    };
    // A block with copy but no artwork is still a useful answer, so it is no longer treated as a miss.
    if (!cur.image) { body.reason = 'no image key'; return json(body, 200, cur.desc ? TTL_HIT : TTL_MISS); }
    return json(body, 200, TTL_HIT);
  } catch (e) {
    const msg = String((e && e.message) || e);
    // an abort is a slow or dead host, not a bug -- cache it briefly so one bad domain cannot be retried
    // on every render
    return json({ image: '', domain: '', reason: /abort/i.test(msg) ? 'timeout' : msg }, 200, 300);
  }
}
