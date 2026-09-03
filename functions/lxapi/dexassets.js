// Cloudflare Pages Function — price a batch of Stellar assets in ONE request, server-side.
//
// Why this exists. Trade-main was making ~200 Horizon requests per visit from the browser, and a browser
// opens about six connections per host, so those ran as ~34 sequential rounds of ~400ms: the measured ~12s
// load. Worse, horizon.stellar.org rate-limits /trade_aggregations and answers 429 WITHOUT an
// Access-Control-Allow-Origin header, so the browser cannot even read the status -- it surfaces as an opaque
// "Failed to fetch". Prices then silently fell back to the lobstr mirror, which does not carry every asset,
// which is why ZERO and UPT rendered as a dash while node could fetch their prices fine.
//
// A server has neither limit: no six-connection cap, and no CORS. And because the response is cached at the
// edge, total Horizon load becomes a fixed handful of requests per minute regardless of how many people are
// on the site -- instead of 200 per visitor, which is what tripped the rate limit in the first place.
//
// Sized deliberately for the Workers FREE plan: 50 subrequests and 10ms CPU per invocation. Two upstream
// calls per asset means MAX_ASSETS is 16 (32 subrequests, comfortable margin), and the handling stays
// arithmetic-only -- no sparklines here, because parsing 168-bucket payloads would spend the CPU budget.
// The client batches its roster across a couple of calls.
//
// Narrow by construction: GET only, each asset must match CODE-GISSUER exactly, and the only host contacted
// is Horizon. Nothing here reads a secret or touches user funds.
const ASSET_RE = /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;

const H = 'https://horizon.stellar.org';
const MAX_ASSETS = 16;   // 2 subrequests each; the free plan allows 50
// Horizon allows 100 requests per 5 minutes PER IP (x-ratelimit-limit: 100, reset: 300). Refreshing the
// whole roster costs ~62 requests, so a 5-minute TTL is the shortest one that fits inside that budget --
// this number is set by Horizon, not by taste. Shorten it and the endpoint rate-limits itself.
const TTL = 300;
// 30 hourly bars: 24 for the window plus headroom so a bar older than the cutoff is present to measure
// the change against. Still ONE request per asset, which is what the metered budget cares about.
const HOURS_FETCH = 30;
const TTL_ERR = 15;
const TIMEOUT_MS = 6000;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + (ttl == null ? TTL : ttl),
      'access-control-allow-origin': '*',
    },
  });
}

function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  // cacheEverything lets a second invocation reuse an upstream body instead of paying the hop again
  return fetch(url, { signal: ctl.signal, cf: { cacheTtl: TTL, cacheEverything: true } })
    .finally(() => clearTimeout(t));
}

// Horizon 429s under load, and because its 429 carries no CORS header this failure is invisible to a
// browser -- which is exactly why the page used to show dashes. Here it is visible and cheap to ride out,
// so two backed-off retries turn a throttled moment into a slightly slower answer instead of a dash.
async function getJson(url) {
  let last;
  const delays = [0, 400, 1200];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const r = await withTimeout(url);
      if (r.ok) return r.json();
      last = new Error(String(r.status));
    } catch (e) { last = e; }
  }
  throw last;
}

function records(d) {
  return (d && d._embedded && d._embedded.records) || [];
}

// Horizon reports close/avg to seven decimal places, so an asset trading below 1e-7 comes back as a literal
// "0.0000000" and would render as a dash despite having a real price. The volume figures carry more
// precision, so derive it from them instead.
function priceOf(bar) {
  if (!bar) return 0;
  const close = +bar.close || 0;
  if (close > 0) return close;
  const avg = +bar.avg || 0;
  if (avg > 0) return avg;
  const b = +bar.base_volume || 0;
  const c = +bar.counter_volume || 0;
  return b > 0 && c > 0 ? c / b : 0;
}

async function oneAsset(code, issuer) {
  const type = code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12';
  const base = 'base_asset_type=' + type +
    '&base_asset_code=' + encodeURIComponent(code) +
    '&base_asset_issuer=' + issuer +
    '&counter_asset_type=native';

  const out = { px: 0, pc: null, chg: null, vol: null, high: null, low: null, tr: null, ho: null, su: null, dom: null };

  // A ROLLING 24 hours, summed from hourly bars -- not the current UTC day, which is what a daily bar
  // is and which empties itself every midnight. Selected by timestamp, not by count: bars exist only for
  // hours that traded, so "the newest 24" would quietly span days on a thin asset. HOURS_BACK over-fetches
  // a little so there is still a bar older than the cutoff to price the change against.
  const agg = getJson(H + '/trade_aggregations?' + base + '&resolution=3600000&order=desc&limit=' + HOURS_FETCH)
    .then((d) => {
      const r = records(d);
      if (!r[0]) return;
      const cut = Date.now() - 24 * 3600 * 1000;
      const win = r.filter((x) => +x.timestamp >= cut);
      // Price comes from the newest bar there is, even if the asset has not traded for a day -- a stale
      // price is a fact about a quiet asset, whereas zero would read as "worthless".
      out.px = priceOf(r[0]);
      out.vol = win.reduce((a, x) => a + (+x.counter_volume || 0), 0);
      out.tr = win.reduce((a, x) => a + (+x.trade_count || 0), 0);
      const his = win.map((x) => +x.high || 0).filter((v) => v > 0);
      const los = win.map((x) => +x.low || 0).filter((v) => v > 0);
      out.high = his.length ? Math.max.apply(null, his) : (+r[0].high || 0);
      out.low = los.length ? Math.min.apply(null, los) : (+r[0].low || 0);
      // What it was worth 24h ago: the last bar that closed BEFORE the cutoff. If the fetch does not reach
      // back that far (a very busy asset fills every hour), fall back to the oldest bar in the window.
      const older = r.find((x) => +x.timestamp < cut);
      const prev = older ? priceOf(older) : (win.length ? priceOf(win[win.length - 1]) : 0);
      // Yesterday's close rides along so the caller can recompute the move against a FRESHER price
      // than this bar carries (see lastprices.js) -- otherwise the table shows a live price beside a
      // percentage measured from a different one.
      if (prev > 0) out.pc = prev;
      if (prev > 0 && out.px > 0) out.chg = ((out.px - prev) / prev) * 100;
    })
    .catch(() => {});

  const meta = getJson(H + '/assets?asset_code=' + encodeURIComponent(code) + '&asset_issuer=' + issuer)
    .then((d) => {
      const rec = records(d)[0];
      if (!rec) return;
      if (rec.accounts) {
        out.ho = (+rec.accounts.authorized || 0) + (+rec.accounts.authorized_to_maintain_liabilities || 0);
      }
      if (rec.balances) {
        out.su = +rec.balances.authorized || +rec.balances.authorized_to_maintain_liabilities || null;
      } else if (rec.amount != null) {
        out.su = +rec.amount;
      }
      // The issuer's home_domain, free: Horizon hands back _links.toml pointing at
      // https://<home_domain>/.well-known/stellar.toml on this very record. Without it the client had no
      // domain for the curated assets at all, so they rendered as a generic "Stellar" tag on mobile and a
      // shortened G-address on desktop, and their logos never resolved because the toml was never fetched.
      const toml = rec._links && rec._links.toml && rec._links.toml.href;
      if (toml) {
        // host only, no regex: split on "//" then cut at the first "/"
        const after = String(toml).split('//')[1] || '';
        out.dom = after.split('/')[0] || null;
      }
    })
    .catch(() => {});

  await Promise.all([agg, meta]);
  return out;
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const raw = (q.get('a') || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!raw.length) return json({ error: 'no assets' }, 400, 60);
  if (raw.length > MAX_ASSETS) return json({ error: 'max ' + MAX_ASSETS + ' assets per call' }, 400, 60);

  const wanted = [];
  for (let i = 0; i < raw.length; i++) {
    if (!ASSET_RE.test(raw[i])) return json({ error: 'bad asset: ' + raw[i].slice(0, 24) }, 400, 60);
    const dash = raw[i].lastIndexOf('-');
    wanted.push({ key: raw[i], code: raw[i].slice(0, dash), issuer: raw[i].slice(dash + 1) });
  }

  try {
    const results = await Promise.all(wanted.map((w) => oneAsset(w.code, w.issuer).catch(() => null)));
    const a = {};
    let priced = 0;
    for (let i = 0; i < wanted.length; i++) {
      if (!results[i]) continue;
      a[wanted[i].key] = results[i];
      if (results[i].px > 0) priced++;
    }
    // A px of 0 is indistinguishable from "we got rate limited", so a batch that came back mostly unpriced
    // must not be cached for a full minute -- that would pin dashes on the page. Cache it briefly instead.
    const healthy = wanted.length === 0 || priced > 0;
    return json({ ok: 1, a: a }, 200, healthy ? TTL : TTL_ERR);
  } catch (e) {
    const msg = String((e && e.message) || e);
    return json({ error: /abort/i.test(msg) ? 'timeout' : msg }, 200, TTL_ERR);
  }
}
