// TEST WALLETS (RAZA 2026-11-23): addresses the admin approves to test Launch and curated listing at the
// minimum price -- 0.5 of the network's own coin for the liquidity, 0.5 for the minting fee, and 0.5 for a
// listing -- instead of $25 / $250. Everyone else pays the normal price.
//
// Stored in the admin D1 (ADMIN_DB, table test_wallets), managed from the admin "Test wallets" page
// (functions/lxapi/testwallets.js, behind Cloudflare Access). The public site only ever asks "is this one
// address approved?" (functions/lxapi/testwallet.js): the list itself is never published.
//
// The listing endpoints call isTestWallet() with the address that PAID, so the low listing price is
// decided on the server and cannot be had by editing the page.

export const TEST_PRICE = 0.5;          // native coin: XLM, XRP, NEAR

export const NETS = {
  stellar: /^G[A-Z2-7]{55}$/,
  xrpl: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  near: /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$|^[0-9a-f]{64}$/,
};

export const SCHEMA = 'CREATE TABLE IF NOT EXISTS test_wallets ('
  + 'net TEXT NOT NULL, addr TEXT NOT NULL, label TEXT, added_at INTEGER NOT NULL, added_by TEXT, '
  + 'PRIMARY KEY (net, addr))';

// Canonical form: Stellar keys and XRPL addresses are case-sensitive as written; NEAR ids are lower case.
export function normAddr(net, a) {
  a = String(a == null ? '' : a).trim();
  return net === 'near' ? a.toLowerCase() : a;
}
export function validAddr(net, a) { return !!(NETS[net] && NETS[net].test(a)); }

// true / false; a missing binding or table is false (never an error that could block a normal payment).
export async function isTestWallet(env, net, addr) {
  const db = env && env.ADMIN_DB;
  if (!db || !NETS[net]) return false;
  const a = normAddr(net, addr);
  if (!validAddr(net, a)) return false;
  try {
    const r = await db.prepare('SELECT 1 AS x FROM test_wallets WHERE net = ?1 AND addr = ?2').bind(net, a).first();
    return !!r;
  } catch (e) { return false; }
}
