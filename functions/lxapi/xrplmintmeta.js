// The metadata an XRPL launchpad minter types, kept.
//
// THE SAME BUG STELLAR HAD, STILL OPEN HERE. Its mintmeta.js records it: "FRANK was minted, the fee
// arrived, and the asset page showed nothing -- because nothing the minter entered had ever left his
// browser. Every mainnet mint since the migration is the same."
//
// This build is in that state now. launchpad.js collects a name, a description, socials and a logo
// into localStorage, and the whole launch flow POSTs to exactly two places: xrplcluster.com and
// /lxapi/xrplprices. Nothing the minter types or uploads is ever sent to us, so the moment the tab
// closes there is no copy of it anywhere — the token is on chain with artwork we do not have.
//
// This is the missing writer. It feeds `mintmeta:xrpl`, which xrp-ledger.toml.js already reads.
//
// PUBLISHED ON MINT, NOT HELD FOR APPROVAL (RAZA 2026-10-07: "publish on mint like stellar. what i
// said earlier was only applicable to the assets already minted"). Stellar's reasoning applies
// unchanged: a minter pays the fee and types their project's details as part of the flow, and should
// not watch their token sit nameless until a human clicks something.
//
// ---- WHAT MAKES A PUBLIC WRITER SAFE HERE -------------------------------------------------------
//
// A public upload route is otherwise a free way to fill KV with images. Stellar's answer is that the
// mint is its own ticket — "No verified mint, no stored bytes" — and the same holds here, but the
// check had to be built differently and the obvious version of it would have been WRONG.
//
// The toml generator says every listed issuer "was funded by the LumosCore launchpad wallet
// rLgbG2dUJBvC3uifB8zcCRWUSVXFcSZ2DJ, which is what makes this list forgery-proof". That describes
// the six historical mints. It does NOT describe a mint made today: mint.js line 218 funds the new
// issuer with `Account: user` — the MINTER'S own wallet. A verifier demanding our funder would have
// rejected every real mint while accepting nothing, and the failure would have looked like the
// launchpad being broken.
//
// What a mint through this launchpad actually proves, from mint.js's own plan:
//   * the user pays our fee collector            (step 1: Payment user -> FEE_COLLECTOR)
//   * the user funds the brand-new issuer         (step 2: Payment user -> issuer)
//   * the issuer ends up blackholed               (master key disabled, RegularKey burned)
//
// So the three are checked and TIED TOGETHER: the account that funded this issuer must be the same
// account that paid our fee. Reproducing that means paying us from the account that created the
// issuer and then throwing the issuer's keys away — which is the thing being claimed. Anyone can
// blackhole an account; nobody can retroactively become the account that funded it.
const RPCS = ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/'];

const FEE_COLLECTOR = 'rBDV4nwHzg5ByAYJtPWrbBZnuUXSUtFr94';
const ACCOUNT_ONE = 'rrrrrrrrrrrrrrrrrrrrBZbvji';     // the burn address a blackholed account points at
const LSF_DISABLE_MASTER = 0x00100000;

const ADDR_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const CUR_RE = /^([A-Za-z0-9]{1,3}|[0-9A-Fa-f]{40})$/;
const HASH_RE = /^[0-9A-Fa-f]{64}$/;

const SUB = 'xrplmint:';            // xrplmint:<CODE-ISSUER> -> one submission, kept for restore
const LIVE = 'mintmeta:xrpl';       // {id: {name, desc, image}} -- the one key the toml reads

const LIMITS = { name: 60, description: 1200, handle: 80, website: 200 };
const LOGO_MAX = 512 * 1024;
const LOGO_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

const json = (body, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  },
});

const clip = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

// A website the minter supplies is a link we would publish, so it gets the same treatment every
// other stranger-supplied url on this build gets: https, a real hostname, no credentials.
function safeSite(s, max) {
  const v = clip(s, max);
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch (e) { return ''; }
  if (u.protocol !== 'https:') return '';
  if (u.username || u.password) return '';
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return '';
  return u.toString().slice(0, max);
}

async function rpc(method, params) {
  let last = null;
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, params: [params || {}] }),
      });
      if (!r.ok) { last = 'node ' + r.status; continue; }
      const j = await r.json();
      if (j && j.result && j.result.status !== 'error') return j.result;
      last = (j && j.result && j.result.error_message) || 'ledger error';
    } catch (e) { last = 'unreachable'; }
  }
  return { __err: last || 'unreachable' };
}

// The account that funded this issuer, which on this ledger is fixed at creation.
//
// `account_tx` forward-ordered: the first transaction an account ever appears in is the Payment that
// brought it into existence, and its sender is the creator. This is the same fact the toml's funder
// walk relies on, read from the other end.
async function creatorOf(issuer) {
  const r = await rpc('account_tx', {
    account: issuer, forward: true, limit: 5, ledger_index_min: -1, ledger_index_max: -1,
  });
  if (r.__err) return { err: 'could not reach the XRP Ledger to check the mint; try again shortly' };
  for (const row of (r.transactions || [])) {
    const t = row.tx || row.tx_json || {};
    if (t.TransactionType === 'Payment' && t.Destination === issuer && t.Account) {
      return { creator: t.Account };
    }
  }
  return { err: 'could not find the transaction that created this issuer' };
}

async function verifyMint(txHash, issuer) {
  // 1. The issuer must be sealed. An open issuer can mint more of itself, so its supply is not the
  //    thing the toml would be vouching for.
  const info = await rpc('account_info', { account: issuer, ledger_index: 'validated' });
  if (info.__err) return 'could not reach the XRP Ledger to check the issuer; try again shortly';
  const acct = info.account_data || {};
  const blackholed = acct.RegularKey === ACCOUNT_ONE && (Number(acct.Flags) & LSF_DISABLE_MASTER) !== 0;
  if (!blackholed) return 'that issuer is not blackholed, so this is not a completed LumosCore mint';

  // 2. Who created it.
  const c = await creatorOf(issuer);
  if (c.err) return c.err;

  // 3. The fee, paid by that same account to our collector, and validated on chain.
  const tx = await rpc('tx', { transaction: txHash.toUpperCase() });
  if (tx.__err) return 'that transaction could not be read from the XRP Ledger';
  const t = tx.tx_json || tx;
  if (tx.validated !== true) return 'that transaction is not validated yet';
  if (t.TransactionType !== 'Payment') return 'that transaction is not a payment';
  if (t.Destination !== FEE_COLLECTOR) return 'that transaction did not pay the LumosCore mint fee';
  if (t.Account !== c.creator) return 'the mint fee was not paid by the account that created this issuer';
  const paid = tx.meta && tx.meta.delivered_amount;
  if (!(typeof paid === 'string' && Number(paid) > 0)) return 'that transaction delivered no XRP';
  return null;
}

// Self-contained rather than imported from Stellar's listing.js, which this repo does not carry —
// an import that only resolves in the combined build would make the XRPL build alone fail to deploy.
// The key prefix and metadata shape are listing.js's exactly, so /lxapi/media serves these unchanged.
async function storeLogo(env, dataUri) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return { err: 'image storage unavailable' };
  const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUri || ''));
  if (!m) return { err: 'the logo must be a base64 image' };
  const type = m[1].toLowerCase();
  const ext = LOGO_TYPES[type];
  if (!ext) return { err: 'logo must be PNG, JPEG, WebP or GIF' };

  let buf;
  try {
    const bin = atob(m[2]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    buf = arr.buffer;
  } catch (e) { return { err: 'the logo could not be read' }; }

  if (!buf.byteLength) return { err: 'the logo is empty' };
  if (buf.byteLength > LOGO_MAX) {
    return { err: 'the logo is ' + Math.round(buf.byteLength / 1024) + 'KB, over the 512KB limit' };
  }
  const d = await crypto.subtle.digest('SHA-256', buf);
  const id = [...new Uint8Array(d)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('') + '.' + ext;
  await kv.put('media:' + id, buf, { metadata: { type, size: buf.byteLength, at: Date.now() } });
  return { id };
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

export async function onRequestPost({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ ok: false, error: 'submissions are unavailable right now' }, 503);

  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad request' }, 400);

  const code = String(b.code || '').trim();
  const issuer = String(b.issuer || '').trim();
  const txHash = String(b.txHash || '').trim();
  if (!CUR_RE.test(code)) return json({ ok: false, error: 'bad asset code' }, 400);
  if (!ADDR_RE.test(issuer)) return json({ ok: false, error: 'bad issuer' }, 400);
  if (!HASH_RE.test(txHash)) return json({ ok: false, error: 'missing mint transaction' }, 400);

  const id = code + '-' + issuer;

  // Idempotent by asset: a retry, a double click or a reopened tab must not store a second copy.
  let prev = null;
  try { prev = await kv.get(SUB + id, 'json'); } catch (e) { /* treat as absent */ }
  // A taken-down entry stays down — a resubmit is not a way to undo a removal.
  if (prev && prev.status === 'removed') return json({ ok: true, status: 'removed', already: true }, 200);

  // Checked BEFORE any bytes are stored, so an unverified submission costs us nothing.
  const bad = await verifyMint(txHash, issuer);
  if (bad) return json({ ok: false, error: bad }, 400);

  let logoId = prev ? (prev.logoId || null) : null;
  if (b.logo) {
    const st = await storeLogo(env, b.logo);
    if (st.err) return json({ ok: false, error: st.err }, 400);
    logoId = st.id;
  }

  const rec = {
    asset: id, code, issuer, txHash: txHash.toUpperCase(), status: 'live',
    name: clip(b.name, LIMITS.name),
    description: clip(b.description != null ? b.description : b.desc, LIMITS.description),
    website: safeSite(b.website, LIMITS.website),
    twitter: clip(b.twitter, LIMITS.handle),
    telegram: clip(b.telegram, LIMITS.handle),
    logoId: logoId || null,
    at: (prev && prev.at) || Date.now(),
    updated: Date.now(),
  };
  await kv.put(SUB + id, JSON.stringify(rec));

  // The one key xrp-ledger.toml.js reads, so building that document costs a single read rather than
  // a scan. PRESENT beats non-empty, as on the Stellar side: a field the request carries wins even
  // when empty, so a minter can clear a mistype; a field it omits keeps what is stored, so a partial
  // resubmit does not wipe an earlier correction.
  try {
    const map = (await kv.get(LIVE, 'json')) || {};
    const was = map[id] || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    map[id] = {
      name: has('name') ? rec.name : (was.name || ''),
      desc: (has('description') || has('desc')) ? rec.description : (was.desc || ''),
      image: has('logo')
        ? (rec.logoId ? '/lxapi/media?id=' + encodeURIComponent(rec.logoId) : '')
        : (was.image || ''),
    };
    await kv.put(LIVE, JSON.stringify(map));
  } catch (e) { /* the submission is stored either way; the map can be rebuilt from it */ }

  return json({ ok: true, status: 'live' }, 200);
}
