// SEP-1 stellar.toml for lumoscore.com — the domain's own statement of which assets are ours.
//
// This file is what makes a home_domain claim mean anything. An issuer writing "home_domain=lumoscore.com"
// is just an assertion by that issuer; SEP-1 only treats it as verified when THIS document, served from
// that domain, names the asset back. Wallets and explorers check both halves. Until now we served no toml
// at all (404), so every LumosCore mint was making a claim nothing could confirm.
//
// WHICH ASSETS GET LISTED, and why it is not simply "everyone claiming our domain":
//
//   1. the issuer declares home_domain = lumoscore.com      <- the asset's claim
//   2. the issuer ACCOUNT was created by our funding wallet  <- our proof
//
// Both are required. Condition 1 alone would be circular and dangerous: anyone on Stellar can set
// home_domain to lumoscore.com without permission, so a toml built on that would let a stranger mint
// "USDC", point it here, and be verified by us across every wallet that reads this file. Condition 2 cannot
// be forged -- an account's creator is fixed at creation and is on the ledger forever. Every one of the 24
// assets minted through the LumosCore launchpad satisfies it (checked: 24/24).
//
// This is also what makes the file self-maintaining: a new launchpad mint is funded by the same wallet, so
// it appears here on the next cache refresh with no deploy and no list to edit. A forgery never does.
const FUNDER = 'GA7VKQBOILVBDABEHRSVW72JM3OI54I2GSCCIHGNMECGUMKHLZG7JCDH';

// LUMOS is listed by name rather than by the funder rule. It is the platform's own token and predates the
// launchpad -- its issuer was created by a different wallet (GBMAZPFH…), so the rule below correctly does
// not recognise it. Naming it here is safe for the same reason the rule is: this file is our assertion, and
// we are the ones asserting. Note its issuer still declares home_domain=lumosdao.io on chain, so a wallet
// doing the SEP-1 round trip for LUMOS resolves via that domain's toml; this entry keeps our own document
// complete and is already correct should the issuer's home_domain ever move here.
const PLATFORM = [{
  code: 'LUMOS',
  issuer: 'GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S',
  name: 'Lumos Core',
  desc: 'LumosCore native utility token — powers platform fees and rewards.',
  image: 'https://lumoscore.com/assets/tokens/lumos.png',
}];
const DOMAIN = 'lumoscore.com';
// GUARDRAILS E12: a second host, because Horizon rate-limits at 100 requests per 5 minutes per IP and a
// throttled verification must not be mistaken for a failed one.
const HOSTS = ['https://horizon.stellar.org', 'https://horizon.stellar.lobstr.co'];
const PASSPHRASE = 'Public Global Stellar Network ; September 2015';

// Mints are rare, so the file can be cached hard. This also keeps Horizon load near zero: one refresh
// every six hours regardless of how many people or wallets fetch the toml.
const TTL = 21600;
const TTL_ERR = 300;
const TIMEOUT_MS = 6000;

// Free-plan Workers allow 50 subrequests per invocation and we spend one per issuer verification. The cap
// is stated in the output rather than silently truncating -- a toml that quietly drops assets is worse than
// one that says it is incomplete. Workers Paid raises the limit to 10,000, which removes the ceiling.
const MAX_VERIFY = 45;
// Every verification attempt, first tries and RETRIES alike, draws from this. 50 minus the two spent on
// candidates() and the icon manifest, minus a small margin. In practice ~19 assets claim our domain, so
// the first pass costs ~19 and the rest is retry headroom; the cap only binds if that grows a lot.
const VERIFY_BUDGET = 46;

// WHERE A LAUNCHPAD MINT'S LOGO COMES FROM, and why not from stellar.expert.
//
// This file used to take every asset's image from stellar.expert's tomlInfo. That silently published
// nothing, because stellar.expert fills tomlInfo by reading THIS document -- so the image could only ever
// appear here if it already appeared here. Measured before the fix: 10 [[CURRENCIES]] blocks, one image=
// line, and that one the hardcoded LUMOS entry. Every launchpad token went out with no logo at all.
//
// The loop is broken by publishing images WE host. _tools/_launchicons.js writes the launchpad icons to
// assets/tokens/ and emits this manifest alongside them, so an image can only be named here if the file
// it names was written in the same run.
//
// It is read over HTTP rather than baked in so that adding an icon needs no edit to this file, and a
// missing or malformed manifest degrades to exactly the previous behaviour instead of breaking the toml.
const ICON_MANIFEST = '/assets/tokens/launchpad-icons.json';

// Serve image URLs on the origin this document was served from. A wallet only ever reads the copy at
// lumoscore.com, so in production these are lumoscore.com URLs; on a preview deploy they point at that
// preview, which is what makes the result checkable there instead of only after going live.
function originOf(request) {
  try {
    const u = new URL(request.url);
    if (u.protocol === 'https:' && /^[A-Za-z0-9.-]{1,253}$/.test(u.hostname)) return u.origin;
  } catch (e) { /* fall through */ }
  return 'https://' + DOMAIN;
}

// Never throws and never blocks the document: a toml without images is degraded, a toml that 500s is
// broken, and a broken one un-verifies every asset we have.
async function iconManifest(origin) {
  try {
    const r = await withTimeout(origin + ICON_MANIFEST);
    if (!r.ok) return {};
    const m = await r.json();
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    const out = {};
    for (const k of Object.keys(m)) {
      // An entry is either a bare path (older writes) or {image, name}. Both are accepted so the manifest
      // can gain names without invalidating what is already published.
      const v = m[k];
      const img = (v && typeof v === 'object') ? v.image : v;
      const name = (v && typeof v === 'object' && typeof v.name === 'string') ? v.name.slice(0, 80) : '';
      // desc rides along with name. Without this the field was read off the manifest and thrown away, so
      // every asset we host fell through to the client's generic line and all of them read identically.
      // Capped, single-line, and quote-stripped: it is written into a quoted TOML value.
      // Split/join rather than a regex: this value is written into a double-quoted TOML string, and a
      // stray quote or newline there would break the document for every wallet that parses it.
      const desc = (v && typeof v === 'object' && typeof v.desc === 'string')
        ? v.desc.split('"').join('').split("'").join('')
                .split('\r').join(' ').split('\n').join(' ')
                .split('\t').join(' ').trim().slice(0, 300) : '';
      // An entry with NO image is still kept. The manifest doubles as our register of which assets are
      // ours, and several are ours without artwork yet -- RICHARD, PUMP, PEPE, ZBS, FED, NEIRO and HULK
      // all declare our domain and were minted by our wallet, but stellar.expert records no domain for
      // them, so nothing else surfaces them. Dropping them here would keep them invisible for want of a
      // picture. They are still funder-checked below before anything is published.
      //
      // When there IS an image it must be a same-origin absolute path: a manifest that could name an
      // arbitrary host would let one bad write point every wallet at someone else's picture.
      const ok = typeof img === 'string' && img.charAt(0) === '/' && img.indexOf('//') !== 0;
      out[k] = { image: ok ? origin + img : '', name, desc };
    }
    return out;
  } catch (e) { return {}; }
}

function tomlResponse(body, ttl) {
  return new Response(body, {
    status: 200,
    headers: {
      // SEP-1 requires the file be readable cross-origin, or wallets cannot fetch it at all
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=' + ttl,
    },
  });
}

function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  return fetch(url, { signal: ctl.signal, cf: { cacheTtl: TTL, cacheEverything: true } })
    .finally(() => clearTimeout(t));
}

// TOML strings are double-quoted; a stray quote or newline in an asset name would otherwise break the
// document for every consumer, so anything interpolated goes through here.
function q(v) {
  return '"' + String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim() + '"';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every upstream call shares one allowance, because exceeding it is not a slow response -- the Worker is
// killed and the whole document 502s. Retries draw from the same pool as first attempts, so a bad day
// upstream degrades this into "some assets undetermined" instead of "no toml at all".
function budget(n) {
  return { left: n, take() { if (this.left <= 0) return false; this.left--; return true; } };
}

// Was this issuer account created by us? The first operation on any account is its creation, and the
// funder recorded there cannot be changed afterwards.
//
// THREE-VALUED ON PURPOSE: true = ours, false = provably not ours, null = could not determine.
// It used to return false for any non-ok response, which quietly turned a Horizon 429 into "not ours" and
// dropped a real asset out of the document -- the list would shrink under rate-limiting and then be cached
// that way for six hours, with nothing to say it had. A null is never published (we must not vouch for an
// asset we could not check) but it IS counted, stated in the file, and it shortens the cache lifetime.
async function fundedByUs(issuer, b) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!b.take()) return null;                       // out of allowance -> unknown, NOT a denial
    try {
      const host = HOSTS[attempt % HOSTS.length];
      const r = await withTimeout(host + '/accounts/' + issuer + '/operations?order=asc&limit=1');
      // Throttled or upstream-broken: retryable, and emphatically not an answer.
      if (r.status === 429 || r.status >= 500) { await sleep(250 * (attempt + 1)); continue; }
      // A 404 IS an answer: no such account, so it is certainly not one we funded.
      if (!r.ok) return false;
      const d = await r.json();
      const op = ((d._embedded || {}).records || [])[0] || {};
      if (op.type !== 'create_account') return false;
      return (op.funder || op.source_account) === FUNDER;
    } catch (e) { await sleep(250 * (attempt + 1)); }  // timeout / network -> retry, do not conclude
  }
  return null;
}

async function candidates() {
  const u = 'https://api.stellar.expert/explorer/public/asset?search=' + DOMAIN + '&limit=200';
  const r = await withTimeout(u);
  if (!r.ok) return [];
  const d = await r.json();
  const recs = (d && d._embedded && d._embedded.records) || [];
  const out = [];
  for (const rec of recs) {
    if (String(rec.domain || '').toLowerCase() !== DOMAIN) continue;
    const dash = String(rec.asset || '').indexOf('-');
    if (dash < 1) continue;
    const code = rec.asset.slice(0, dash);
    const issuer = rec.asset.slice(dash + 1).split('-')[0];
    if (!/^G[A-Z2-7]{55}$/.test(issuer)) continue;
    const ti = rec.tomlInfo || rec.toml_info || {};
    out.push({ code, issuer, name: ti.name || rec.name || '', image: ti.image || '', desc: ti.desc || '' });
  }
  return out;
}

export async function onRequestGet(ctx) {
  const origin = originOf(ctx && ctx.request);
  const head = [
    '# LumosCore — SEP-1 stellar.toml',
    '#',
    '# Lists the assets minted through the LumosCore launchpad on Stellar mainnet.',
    '# An asset appears here only if its issuer account was created by the LumosCore funding wallet,',
    '# which is recorded on the ledger and cannot be forged. Declaring home_domain=lumoscore.com is not',
    '# sufficient on its own.',
    '',
    'VERSION="2.0.0"',
    'NETWORK_PASSPHRASE=' + q(PASSPHRASE),
    '',
    '[DOCUMENTATION]',
    'ORG_NAME="LumosCore"',
    'ORG_URL="https://lumoscore.com"',
    'ORG_LOGO="https://lumoscore.com/assets/tokens/lumos.png"',
    'ORG_DESCRIPTION="Multi-chain DeFi on Stellar — trade, pools, launchpad and cross-chain bridge."',
    '',
  ];

  let list, icons;
  // iconManifest never rejects, so this still fails exactly and only when the asset list does.
  try { [list, icons] = await Promise.all([candidates(), iconManifest(origin)]); }
  catch (e) { return tomlResponse(head.join('\n') + '\n# asset list temporarily unavailable\n', TTL_ERR); }

  // THE CANDIDATE LIST CANNOT COME FROM stellar.expert ALONE. Its index does not carry every asset that
  // declares our domain -- WAZAAA, GROK, WHALEUM and XLIQM are all absent from it, and were therefore
  // never even considered here, which looked from the outside exactly like failing verification. They
  // are not: each one's issuer was created by our funding wallet, checked on the ledger.
  //
  // The icon manifest knows CODE and ISSUER for every asset we host, so it is seeded as candidates too.
  // This widens who gets ASKED, never who gets believed: the funder rule below still decides, so an
  // entry appearing here cannot vouch for itself.
  for (const k of Object.keys(icons)) {
    const dash = k.indexOf('-');
    if (dash < 1) continue;
    const code = k.slice(0, dash), issuer = k.slice(dash + 1);
    if (!/^[A-Za-z0-9]{1,12}$/.test(code) || !/^G[A-Z2-7]{55}$/.test(issuer)) continue;
    const mi = icons[k] || {};
    const hit = list.find((a) => a.code === code && a.issuer === issuer);
    if (hit) {
      // Already discovered through stellar.expert. Its tomlInfo is a mirror of THIS document, so it can
      // never be the source of a name or description we have not published yet -- the manifest is. Fill
      // in only what the discovered record is missing, so a real upstream value is never overwritten.
      if (!hit.name && mi.name) hit.name = mi.name;
      if (!hit.desc && mi.desc) hit.desc = mi.desc;
      continue;
    }
    list.push({ code, issuer, name: mi.name || '', image: '', desc: mi.desc || '' });
  }

  const checked = list.slice(0, MAX_VERIFY);
  const b = budget(VERIFY_BUDGET);
  const verdicts = await Promise.all(checked.map((a) => fundedByUs(a.issuer, b)));
  const unknown = verdicts.filter((v) => v === null).length;
  // Platform assets first, then launchpad mints. Deduped by code|issuer so a platform asset that also
  // satisfies the funder rule cannot appear twice and give two conflicting entries for one asset.
  const seen = new Set();
  const ours = [];
  for (const a of PLATFORM.concat(checked.filter((_, i) => verdicts[i] === true))) {
    const k = a.code + '|' + a.issuer;
    if (seen.has(k)) continue;
    seen.add(k); ours.push(a);
  }

  const body = [head.join('\n')];
  if (list.length > MAX_VERIFY) {
    body.push('# NOTE: ' + list.length + ' candidate assets found but only the first ' + MAX_VERIFY
      + ' could be verified in this request; the rest are omitted rather than listed unchecked.', '');
  }

  for (const a of ours) {
    const c = ['[[CURRENCIES]]', 'code=' + q(a.code), 'issuer=' + q(a.issuer), 'display_decimals=7'];
    // Our own manifest wins for BOTH fields. a.name/a.image (stellar.expert's tomlInfo) stay as the
    // fallback: correct for an asset that publishes through some other domain, and empty for our mints.
    const mine = icons[a.code + '-' + a.issuer] || {};
    const name = mine.name || a.name;
    const img = mine.image || a.image;
    if (name) c.push('name=' + q(name));
    if (a.desc) c.push('desc=' + q(a.desc));
    if (img) c.push('image=' + q(img));
    // These are launchpad-issued tokens, not claims on an off-chain reserve. Saying so explicitly stops a
    // reader inferring a backing that does not exist.
    c.push('is_asset_anchored=false');
    body.push(c.join('\n'), '');
  }

  // An incomplete list must say so and must not be cached hard. Six hours of a silently shortened toml
  // would un-verify a real asset across every wallet that reads this file.
  if (unknown) {
    body.push('# NOTE: ' + unknown + ' asset(s) could not be verified in this request (upstream '
      + 'unavailable or rate-limited). They are omitted rather than listed unchecked, and this document '
      + 'is cached briefly so it refreshes soon.', '');
  }

  if (!ours.length) body.push('# no verified LumosCore assets found at this time', '');
  return tomlResponse(body.join('\n'), (ours.length && !unknown) ? TTL : TTL_ERR);
}
