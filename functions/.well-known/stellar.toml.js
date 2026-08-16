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
const HORIZON = 'https://horizon.stellar.org';
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

// Was this issuer account created by us? The first operation on any account is its creation, and the
// funder recorded there cannot be changed afterwards.
async function fundedByUs(issuer) {
  try {
    const r = await withTimeout(HORIZON + '/accounts/' + issuer + '/operations?order=asc&limit=1');
    if (!r.ok) return false;
    const d = await r.json();
    const op = ((d._embedded || {}).records || [])[0] || {};
    if (op.type !== 'create_account') return false;
    return (op.funder || op.source_account) === FUNDER;
  } catch (e) { return false; }
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

export async function onRequestGet() {
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

  let list;
  try { list = await candidates(); }
  catch (e) { return tomlResponse(head.join('\n') + '\n# asset list temporarily unavailable\n', TTL_ERR); }

  const checked = list.slice(0, MAX_VERIFY);
  const verdicts = await Promise.all(checked.map((a) => fundedByUs(a.issuer)));
  // Platform assets first, then launchpad mints. Deduped by code|issuer so a platform asset that also
  // satisfies the funder rule cannot appear twice and give two conflicting entries for one asset.
  const seen = new Set();
  const ours = [];
  for (const a of PLATFORM.concat(checked.filter((_, i) => verdicts[i]))) {
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
    if (a.name) c.push('name=' + q(a.name));
    if (a.desc) c.push('desc=' + q(a.desc));
    if (a.image) c.push('image=' + q(a.image));
    // These are launchpad-issued tokens, not claims on an off-chain reserve. Saying so explicitly stops a
    // reader inferring a backing that does not exist.
    c.push('is_asset_anchored=false');
    body.push(c.join('\n'), '');
  }

  if (!ours.length) body.push('# no verified LumosCore assets found at this time', '');
  return tomlResponse(body.join('\n'), ours.length ? TTL : TTL_ERR);
}
