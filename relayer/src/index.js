// LumosCore CCTP delivery relayer.
//
// WHY THIS EXISTS. A CCTP transfer burns on the source chain and mints NOTHING until someone calls
// receiveMessage() on the destination. Circle runs no relayer. LumosCore users connect a STELLAR wallet,
// so asking them to also connect an EVM wallet on the destination — and to hold gas there — is not a flow
// this product has. This worker does that last step for them.
//
// WHAT IT CAN AND CANNOT DO. receiveMessage mints to the recipient encoded INSIDE the attested message,
// so this key cannot redirect anyone's funds, cannot mint more, and cannot touch anything but its own gas.
// The worst a compromised relayer key can do is waste the gas it is holding. That is the whole reason this
// design is acceptable with a hot key.
//
// SAFETY RAILS, in order of how much they matter:
//   1. Only messages whose SOURCE domain is Stellar (27) are ever relayed.
//   2. The burn transaction must exist on Horizon and have succeeded — an unverifiable hash is dropped.
//   3. Per-destination minimum: delivering a $0.10 transfer on Ethereum mainnet can cost several dollars
//      of gas. Below the floor the transfer is marked "manual" with a reason, and the user claims it in the
//      Bridge page exactly as before. Nothing is lost, it just is not subsidised.
//   4. Simulate before sending. A message already delivered (by us, by the user, by anyone) reverts here
//      and is recorded as delivered rather than burning gas to find out.
//   5. Bounded retries with backoff, so a permanently failing item cannot drain the wallet in a loop.
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const MT = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';   // MessageTransmitterV2, same address on every EVM chain
const ABI = parseAbi(['function receiveMessage(bytes message, bytes attestation) returns (bool)']);

// domain -> chain. rpc is public infrastructure; swap for a paid endpoint if volume grows.
// minUsdc is the floor described above: gas on that chain vs the value being delivered.
const CHAINS = {
  0:  { name: 'Ethereum',    id: 1,     rpc: 'https://ethereum-rpc.publicnode.com',            minUsdc: 25 },
  1:  { name: 'Avalanche',   id: 43114, rpc: 'https://avalanche-c-chain-rpc.publicnode.com',   minUsdc: 1 },
  2:  { name: 'Optimism',    id: 10,    rpc: 'https://optimism-rpc.publicnode.com',            minUsdc: 0.25 },
  3:  { name: 'Arbitrum',    id: 42161, rpc: 'https://arbitrum-one-rpc.publicnode.com',        minUsdc: 0.25 },
  6:  { name: 'Base',        id: 8453,  rpc: 'https://base-rpc.publicnode.com',                minUsdc: 0.10 },
  7:  { name: 'Polygon',     id: 137,   rpc: 'https://polygon-bor-rpc.publicnode.com',         minUsdc: 0.25 },
  11: { name: 'Linea',       id: 59144, rpc: 'https://linea-rpc.publicnode.com',               minUsdc: 0.25 },
  14: { name: 'World Chain', id: 480,   rpc: 'https://worldchain-mainnet.g.alchemy.com/public', minUsdc: 0.25 },
};

const TTL = 60 * 60 * 24 * 30;   // a queue entry outlives any realistic delivery; the record is not the funds
const MAX_TRIES = 8;
const BATCH = 6;                       // per cron tick, so one bad minute cannot fan out
const BACKOFF_MS = [0, 15e3, 60e3, 300e3, 900e3, 3600e3, 10800e3, 21600e3];

const jr = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

function key(hash) { return 'pend:' + String(hash).toLowerCase(); }

async function irisLookup(env, hash) {
  const url = `${env.IRIS}/v2/messages/${env.SOURCE_DOMAIN}?transactionHash=${encodeURIComponent(hash)}`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return (d && d.messages && d.messages[0]) || null;
}

// The burn must be a real, successful Stellar transaction. Without this anyone could post arbitrary
// hashes and make the relayer spend its Horizon/Iris budget chasing ghosts.
async function burnIsReal(env, hash) {
  const r = await fetch(`${env.HORIZON}/transactions/${encodeURIComponent(hash)}`, { headers: { accept: 'application/json' } });
  if (!r.ok) return false;
  const t = await r.json().catch(() => null);
  return !!(t && t.successful);
}

async function deliver(env, rec, msg) {
  const cfg = CHAINS[rec.destDomain];
  if (!cfg) return { status: 'manual', reason: `no automatic delivery configured for destination domain ${rec.destDomain}` };
  if (!env.RELAYER_KEY) return { status: 'manual', reason: 'the delivery wallet is not configured' };

  const usdc = Number(rec.amount || 0) / 1e6;
  if (usdc < cfg.minUsdc) {
    return { status: 'manual', reason: `${usdc} USDC is below the ${cfg.minUsdc} USDC minimum for automatic delivery on ${cfg.name}, where gas would cost more than the transfer` };
  }

  const account = privateKeyToAccount(env.RELAYER_KEY);
  const chain = { id: cfg.id, name: cfg.name, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc] } } };
  const pub = createPublicClient({ chain, transport: http(cfg.rpc) });
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpc) });
  const data = encodeFunctionData({ abi: ABI, functionName: 'receiveMessage', args: [msg.message, msg.attestation] });

  // Simulate first. Already-delivered messages revert here, which is a SUCCESS state for the user.
  try {
    await pub.call({ account: account.address, to: MT, data });
  } catch (e) {
    const m = String((e && e.message) || e);
    if (/nonce already used|already used|used nonce/i.test(m)) return { status: 'delivered', note: 'already minted' };
    return { status: 'retry', reason: 'simulation failed: ' + m.slice(0, 180) };
  }

  const gas = await pub.estimateGas({ account: account.address, to: MT, data }).catch(() => 250000n);
  const hash = await wallet.sendTransaction({ to: MT, data, gas: (gas * 12n) / 10n });
  const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 120000 }).catch(() => null);
  if (!rcpt) return { status: 'sent', deliverHash: hash, note: 'submitted, receipt not seen yet' };
  if (rcpt.status !== 'success') return { status: 'retry', reason: 'destination tx reverted', deliverHash: hash };
  return { status: 'delivered', deliverHash: hash };
}

async function tick(env) {
  const list = await env.CCTP.list({ prefix: 'pend:', limit: 200 });
  const now = Date.now();
  let handled = 0;

  for (const k of list.keys) {
    if (handled >= BATCH) break;
    const rec = await env.CCTP.get(k.name, 'json');
    if (!rec) continue;
    if (rec.status === 'delivered' || rec.status === 'manual' || rec.status === 'dead') continue;
    if (rec.nextAt && now < rec.nextAt) continue;

    handled++;
    const msg = await irisLookup(env, rec.burnHash);

    if (!msg || msg.status !== 'complete' || !msg.attestation || msg.attestation === 'PENDING') {
      rec.status = 'awaiting-attestation';
      rec.tries = (rec.tries || 0) + 1;
      rec.nextAt = now + (BACKOFF_MS[Math.min(rec.tries, BACKOFF_MS.length - 1)] || 3600e3);
      if (rec.tries > MAX_TRIES) { rec.status = 'manual'; rec.reason = 'no attestation after repeated checks'; }
      await env.CCTP.put(k.name, JSON.stringify(rec), { expirationTtl: TTL });
      continue;
    }

    // Take the destination from Circle's decoded message, never from a default. Number(null) is 0, which
    // is Ethereum — an unknown domain must NOT quietly become the most expensive chain to deliver on.
    const d = msg.decodedMessage || {};
    const body = d.decodedMessageBody || {};
    const dom = Number(d.destinationDomain);
    if (Number.isFinite(dom)) rec.destDomain = dom;
    if (body.amount != null) rec.amount = body.amount;
    if (body.mintRecipient) rec.recipient = body.mintRecipient;
    if (!Number.isFinite(Number(rec.destDomain))) {
      rec.status = 'manual'; rec.reason = 'could not read the destination chain from the attestation';
      rec.updatedAt = now; await env.CCTP.put(k.name, JSON.stringify(rec), { expirationTtl: TTL });
      continue;
    }

    let out;
    try { out = await deliver(env, rec, msg); }
    catch (e) { out = { status: 'retry', reason: String((e && e.message) || e).slice(0, 180) }; }

    rec.status = out.status === 'retry' ? 'retrying' : out.status;
    rec.reason = out.reason || null;
    if (out.deliverHash) rec.deliverHash = out.deliverHash;
    if (out.status === 'retry' || out.status === 'sent') {
      rec.tries = (rec.tries || 0) + 1;
      rec.nextAt = now + (BACKOFF_MS[Math.min(rec.tries, BACKOFF_MS.length - 1)] || 3600e3);
      if (rec.tries > MAX_TRIES) { rec.status = 'manual'; rec.reason = (rec.reason || '') + ' — giving up, claim from the Bridge page'; }
    }
    rec.updatedAt = now;
    await env.CCTP.put(k.name, JSON.stringify(rec), { expirationTtl: TTL });
  }
  return handled;
}

export default {
  async scheduled(_evt, env, ctx) { ctx.waitUntil(tick(env)); },

  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    }

    // POST { burnHash } — called by the site the moment a burn lands.
    if (url.pathname === '/enqueue' && req.method === 'POST') {
      if (env.ENQUEUE_TOKEN && req.headers.get('x-lx-token') !== env.ENQUEUE_TOKEN) return jr({ error: 'unauthorised' }, 401);
      const body = await req.json().catch(() => ({}));
      const hash = String(body.burnHash || '').toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) return jr({ error: 'bad burnHash' }, 400);

      const existing = await env.CCTP.get(key(hash), 'json');
      if (existing) return jr({ ok: true, status: existing.status, already: true });
      if (!(await burnIsReal(env, hash))) return jr({ error: 'no such successful Stellar transaction' }, 400);

      const rec = { burnHash: hash, status: 'queued', tries: 0, createdAt: Date.now(), destDomain: null, amount: null, recipient: null };
      await env.CCTP.put(key(hash), JSON.stringify(rec), { expirationTtl: TTL });
      return jr({ ok: true, status: 'queued' });
    }

    // GET /status?hash=… — the Bridge page polls this to show delivery progress.
    if (url.pathname === '/status') {
      const hash = String(url.searchParams.get('hash') || '').toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) return jr({ error: 'bad hash' }, 400);
      const rec = await env.CCTP.get(key(hash), 'json');
      return jr(rec || { status: 'unknown' });
    }

    // Manual drain, handy while setting up: GET /run
    if (url.pathname === '/run') { const n = await tick(env); return jr({ ok: true, handled: n }); }

    return jr({ ok: true, service: 'lumoscore-cctp-relayer' });
  },
};
