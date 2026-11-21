// Cloudflare Pages Function — the bridge's Axelar ITS route: gas estimate, and whether the recipient can receive.
//
// WHY A PROXY. api.axelarscan.io does not answer a browser preflight from our origin, so a direct call from the page
// is a CORS failure rather than a price. Nothing secret is involved here (unlike /lxapi/oneclick, which carries an
// API key); this exists purely to make the call from a place that has no CORS, and to cache the answer at the edge
// so every keystroke in the amount field does not become an upstream request.
//
// WHAT IS LET THROUGH. Two shapes, three upstreams, and a destination that must be one of the three chains the
// bridge actually offers on this route — so the endpoint cannot be turned into a general relay for anyone's API.
//
// The gas figure returned is XLM in STROOPS, which is what interchain_transfer's gas_token wants. It is Axelar's own
// estimate for relaying and executing the message on the destination; it is not LumosCore's fee and not the
// Stellar network fee.
const API = 'https://api.axelarscan.io/gmp/estimateGasFee';
const TIMEOUT_MS = 12000;
// Axelar's chain ids for the three destinations this route serves. Case matters, and it is NOT the case
// axelarscan's own asset registry uses: the Stellar ITS contract refuses 'ethereum' while accepting 'Ethereum',
// and refuses 'Solana' and 'XRPL' while accepting 'solana' and 'xrpl'. Every one of these four readings was taken
// from the live contract's own is_trusted_chain on 2026-11-10 rather than from a docs page or the registry.
//
// NOT HERE, and each for a measured reason: 'monad' is in the registry against Stellar but the Stellar ITS
// contract answers is_trusted_chain('monad') FALSE. 'hedera' and 'xrpl-evm' ARE trusted, but the only assets
// registered for them from Stellar are USDC.axl (a pure Soroban token with no trustline, so the bridge's
// classic-asset From list can never source it) and DT0 (named "Test token DT0"), which would have shown a route
// nobody could satisfy.
const DEST = { Ethereum: 1, solana: 1, xrpl: 1 };
const GAS_LIMIT = '200000';

// ---- can the recipient actually receive it? ----------------------------------------------------------------------
// ITS moves SHX, and on two of the three destinations SHX is not a native balance the recipient simply has:
//
//   xrpl    SHX is an IOU issued by the Axelar gateway (rfmS3zq…, 234,658,791 SHX outstanding, read 2026-11-10).
//           XRPL will not let an account receive an IOU with no trustline to its issuer, so the recipient must
//           sign a TrustSet and lock 0.2 XRP of reserve BEFORE the transfer.
//   solana  SHX is an SPL (Token-2022) mint. The delivery instruction is a bare `mintTo` — a real executed
//           delivery (4sbdLtuE…, slot 467773752) carries NO create-ATA instruction and no Idempotent log line, so
//           the ITS program does not create the recipient's token account. It must already exist.
//   Ethereum  an ERC-20 transfer needs nothing of the recipient.
//
// A FAILED READ IS NOT A VERDICT. These answer ready:1, ready:0, or ok:0 with no `ready` at all — the caller must
// treat the third as "could not check", never as "not ready", or an upstream hiccup silently blocks a good send.
// NEVER SIGNAL FAILURE WITH A 5xx FROM HERE. This zone replaces the body of any 5xx with Cloudflare's own
// 16-byte "error code: 502" text page, so a handled error returned as 502 reaches the page as unparseable
// plain text instead of JSON — which is exactly how the first version of this endpoint hid its real problem.
// Every failure below is 200 with { ok: 0 }, which is what the rest of /lxapi/ already does.
const SHX_XRPL_ISSUER = 'rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw';
const SHX_SOL_MINT = 'EFchnNkBvh4gSY5zqDgqRfuPR7mStBLvKBxPq5JUJcmP';
// Several upstreams per chain, tried in order, matching what the live xrpl endpoints here already do: a single
// host is a single point of failure, and the first version of this check had one.
const XRPL_RPCS = ['https://s2.ripple.com:51234/', 'https://s1.ripple.com:51234/', 'https://xrplcluster.com/'];
// Solana's public RPCs refuse an INDEXED query (getTokenAccountsByOwner with a mint filter) from any datacenter:
// measured 2026-11-10 against nine hosts — 403 "Your IP or provider is blocked", 403 "Indexed requests require a
// personal token", 400 "not available on free plan", 429. A browser is refused too, so proxying is not the issue.
// publicnode answers a PLAIN getAccountInfo, which is all this check needs once the address is derived.
const SOL_RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': ttl ? ('public, max-age=0, s-maxage=' + ttl) : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
}

async function rpc(url, body, ms) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms || TIMEOUT_MS),
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return r.json();
}

// Try each host in turn; throw only once every one has failed, so one dead upstream is not a failed check.
// `rounds` repeats the whole list, which is what Solana needs: only ONE public host answers us at all, so a
// list of alternatives cannot absorb a blip there and a second pass is the only retry available.
async function rpcAny(urls, body, rounds) {
  let last;
  for (let i = 0; i < (rounds || 1); i++) {
    for (const u of urls) {
      try { return await rpc(u, body, 6000); } catch (e) { last = e; }
    }
  }
  throw last || new Error('no upstream');
}

// ---- deriving the Solana account the delivery actually mints to --------------------------------------------------
// The ITS handler mints to the recipient's ASSOCIATED token account, which is a program-derived address: the first
// sha256(seeds || bump || ATA program || "ProgramDerivedAddress") that is NOT a valid ed25519 point. So the only
// question worth asking is whether THAT address exists — and asking it this way is strictly more correct than the
// indexed query would have been, which could have found some other token account and answered "ready" wrongly.
//
// Verified against the real delivery 4sbdLtuE… : ATA(DpkmPuMip41U…, Token-2022, SHX) reproduces the exact account
// that transaction minted to (4YUQ8aaDU9kz…), and a second account in the same transaction matches too. Note the
// mint is TOKEN-2022, not classic SPL — the token program is one of the seeds, so the classic id derives a
// different, non-existent address.
const SOL_TOKEN_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const SOL_ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58dec(s) {
  const out = [0];
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) throw new Error('bad base58');
    for (let j = 0; j < out.length; j++) out[j] *= 58;
    out[0] += v;
    let c = 0;
    for (let k = 0; k < out.length; k++) { out[k] += c; c = out[k] >> 8; out[k] &= 0xff; }
    while (c) { out.push(c & 0xff); c >>= 8; }
  }
  for (let z = 0; z < s.length && s[z] === '1'; z++) out.push(0);
  return new Uint8Array(out.reverse());
}
function b58enc(buf) {
  let n = 0n;
  for (const b of buf) n = n * 256n + BigInt(b);
  let o = '';
  while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; }
  for (const b of buf) { if (b === 0) o = '1' + o; else break; }
  return o;
}
const ED_P = (1n << 255n) - 19n;
const ED_E = (ED_P - 1n) / 2n;
const ED_D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
function modpow(b, e) { let r = 1n; b %= ED_P; while (e > 0n) { if (e & 1n) r = r * b % ED_P; b = b * b % ED_P; e >>= 1n; } return r; }
// A compressed point is on the curve iff (y^2-1)/(d*y^2+1) is a square. u/v is a square exactly when u*v is
// (v/v^2 = 1/v and v^2 is always a square), so this costs ONE Legendre exponentiation per candidate rather than
// an inverse as well — which matters against this plan's 10ms CPU ceiling.
function onCurve(h) {
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? (h[i] & 0x7f) : h[i]);
  y %= ED_P;
  const yy = y * y % ED_P;
  const u = (yy - 1n + ED_P) % ED_P;
  const v = (ED_D * yy + 1n) % ED_P;
  if (v === 0n) return u === 0n;
  const w = u * v % ED_P;
  if (w === 0n) return true;
  return modpow(w, ED_E) === 1n;
}
async function deriveAta(owner) {
  const parts = [b58dec(owner), b58dec(SOL_TOKEN_PROGRAM), b58dec(SHX_SOL_MINT)];
  const prog = b58dec(SOL_ATA_PROGRAM);
  const tail = new TextEncoder().encode('ProgramDerivedAddress');
  let len = 0;
  for (const p of parts) len += p.length;
  len += 1 + prog.length + tail.length;
  for (let bump = 255; bump >= 0; bump--) {
    const buf = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { buf.set(p, o); o += p.length; }
    buf[o++] = bump;
    buf.set(prog, o); o += prog.length;
    buf.set(tail, o);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
    if (!onCurve(h)) return b58enc(h);
  }
  throw new Error('no bump');
}

// xrpl: a trustline exists for receiving only if its LIMIT is above zero — a line left at limit 0 is on the
// ledger and still cannot take a delivery, so presence alone is the wrong test.
async function readyXrpl(addr) {
  const j = await rpcAny(XRPL_RPCS, {
    method: 'account_lines',
    params: [{ account: addr, peer: SHX_XRPL_ISSUER, ledger_index: 'validated' }],
  });
  const res = j && j.result;
  if (!res) throw new Error('no result');
  // An unfunded account answers actNotFound. That is a definite "cannot receive", not a failed read.
  if (res.error === 'actNotFound') return { ready: 0, why: 'unfunded' };
  if (res.error) throw new Error(String(res.error));
  const lines = res.lines || [];
  const hit = lines.some((l) => l && l.currency === 'SHX' && Number(l.limit) > 0);
  return { ready: hit ? 1 : 0, why: hit ? '' : 'no-trustline' };
}

// A missing account answers result.value === null, which is a definite "cannot receive" — not a failed read.
// Anything else (an rpc error, a shape we do not recognise) throws, and the caller turns that into "could not
// check". The two must never collapse into one answer.
async function readySolanaAt(ata) {
  const j = await rpcAny(SOL_RPCS, {
    jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
    params: [ata, { encoding: 'base64' }],
  }, 2);
  if (j && j.error) throw new Error(String((j.error && j.error.message) || 'rpc error'));
  if (!j || !j.result || !('value' in j.result)) throw new Error('no result');
  const v = j.result.value;
  if (v === null) return { ready: 0, why: 'no-token-account', ata };
  // It exists, but it must be a Token-2022 account for this mint, not some unrelated account at that address.
  if (v.owner !== SOL_TOKEN_PROGRAM) return { ready: 0, why: 'no-token-account', ata };
  return { ready: 1, why: '', ata };
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const op = q.get('op');
  if (op !== 'gas' && op !== 'ready') return json({ ok: 0, error: 'unknown op' }, 400);
  const dest = String(q.get('dest') || '');
  if (!DEST[dest]) return json({ ok: 0, error: 'unsupported destination' }, 400);

  if (op === 'ready') {
    const addr = String(q.get('addr') || '');
    // Length-bounded and character-bounded before it reaches an upstream, so this cannot be used to post
    // arbitrary strings anywhere. The page validates the address properly first; this is the backstop.
    if (!addr || addr.length > 64 || !/^[0-9A-Za-z]+$/.test(addr)) return json({ ok: 0, error: 'bad address' }, 400);
    if (dest === 'Ethereum') return json({ ok: 1, dest, ready: 1 }, 200, 300);
    if (dest === 'solana' && /[0OIl]/.test(addr)) return json({ ok: 0, error: 'bad address' }, 400);
    // Derive BEFORE the read, and hand the derived address back even when the read fails. Deriving needs no
    // network, so it always succeeds; only the chain read is flaky from here, because one public host serves
    // every Solana check and it rate-limits Cloudflare's shared edge IPs (~6% of calls, measured on prod —
    // 60/60 from a residential IP). With this address the PAGE can finish the check over its own connection.
    let ata = null;
    if (dest === 'solana') {
      try { ata = await deriveAta(addr); }
      catch (e) { return json({ ok: 0, error: 'bad address' }, 400); }
    }
    try {
      const out = dest === 'xrpl' ? await readyXrpl(addr) : await readySolanaAt(ata);
      return json({ ok: 1, dest, ready: out.ready, why: out.why, ata }, 200, 30);
    } catch (e) {
      // NO `ready` FIELD ON PURPOSE. See the note above: the caller must not read this as "not ready".
      // 200, not 5xx: this zone would otherwise replace the body with its own error page (see the note at the top).
      // `ata` still rides along so the page can retry the read itself — see the note above.
      return json({ ok: 0, error: 'check unavailable', ata }, 200);
    }
  }

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sourceChain: 'stellar', destinationChain: dest, gasLimit: GAS_LIMIT, sourceTokenSymbol: 'XLM' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // The endpoint answers with a bare number as text, not JSON. Read it as text and validate it IS a number --
    // an HTML error page would otherwise parse as NaN and quietly become a zero-gas transfer that never relays.
    const t = (await r.text()).trim();
    if (!r.ok || !/^[0-9]{1,18}$/.test(t)) return json({ ok: 0, error: 'estimate unavailable' }, 200);
    const stroops = t;
    return json({ ok: 1, dest, stroops, xlm: Number(stroops) / 1e7 }, 200, 60);
  } catch (e) {
    // 200 with ok:0 for the same reason as above — a 502 here would reach the page as Cloudflare's text page.
    return json({ ok: 0, error: 'Axelar unreachable' }, 200);
  }
}
