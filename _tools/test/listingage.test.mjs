// Drives the REAL /lxapi/listing handler with a stubbed Horizon, and checks which payments buy a
// curated listing. Nothing is asserted from reading the source: rows that reach the database are
// counted, and the handler's own error text is read back.
import { onRequestPost } from '../../functions/lxapi/listing.js';

const FEE_ACCT = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
const PAYER = 'GACMOLVJSPD6U2LJXAMA5N5BDOXO7JZTEFMZBMQSGR7TZIIOVBLJENQI';
const ISSUER = 'GB3EGACGDTQX53JSGGFEJDXGNHSCPQMIZ2YZHILVPVGDUO3HXW4TA3KP';
const HASH = 'a'.repeat(64);
const HOUR = 3600 * 1000;

// Horizon says: this transaction succeeded at `when` and paid `amount` XLM to the fee collector.
function stubChain(when, amount) {
  globalThis.fetch = async (u) => {
    const url = String(u);
    const ok = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/\/operations/.test(url)) {
      return ok({ _embedded: { records: [
        { type: 'payment', to: FEE_ACCT, from: PAYER, asset_type: 'native', amount: String(amount) }] } });
    }
    if (/\/transactions\//.test(url)) return ok({ successful: true, created_at: new Date(when).toISOString() });
    if (/listingquote/.test(url)) return ok({ options: [{ code: 'XLM', amount: 1000 }] });
    if (/\/assets\?/.test(url)) return ok({ _embedded: { records: [{ asset_code: 'TEST' }] } });
    return new Response('{}', { status: 404 });
  };
}
function makeDb() {
  const rows = [];
  return { rows, prepare(sql) { return { bind(...a) { return {
    async first() { return null; },                       // never a duplicate
    async run() { if (/INSERT/i.test(sql)) rows.push(a); },
  }; } }; } };
}
async function submit(when, amount) {
  stubChain(when, amount);
  const db = makeDb();
  const res = await onRequestPost({
    request: new Request('https://lumoscore.com/lxapi/listing', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ network: 'stellar', code: 'TEST', issuer: ISSUER,
        descr: 'a test listing', txHash: HASH }) }),
    env: { ADMIN_DB: db },
  });
  return { status: res.status, body: await res.json(), rowsWritten: db.rows.length };
}

let fails = 0;
const check = (name, cond, detail) => {
  if (!cond) fails++;
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name.padEnd(56) + (detail || ''));
};

const now = Date.now();

{
  const r = await submit(now - 30 * 1000, 1200);
  check('a payment made 30 seconds ago buys a listing', r.body.ok === true && r.rowsWritten === 1,
    JSON.stringify(r.body).slice(0, 90));
}
{
  const r = await submit(now - 23 * HOUR, 1200);
  check('23 hours old is still inside the window', r.body.ok === true && r.rowsWritten === 1,
    JSON.stringify(r.body).slice(0, 90));
}
{
  const r = await submit(now - 25 * HOUR, 1200);
  check('25 hours old is refused, and nothing is written',
    r.body.ok === false && r.rowsWritten === 0 && /24 hours/.test(r.body.error || ''),
    (r.body.error || '').slice(0, 70));
}
{
  // The whole point: a large historical fee payment sitting in the collector's public history.
  const r = await submit(now - 200 * 24 * HOUR, 50000);
  check('a months-old fee payment cannot be claimed',
    r.body.ok === false && r.rowsWritten === 0 && /24 hours/.test(r.body.error || ''),
    (r.body.error || '').slice(0, 50));
}
{
  // Age must be reported before the amount, or a replayer is told to check the wrong thing.
  const r = await submit(now - 100 * HOUR, 1);
  check('a stale AND short payment reports the age, not the amount',
    /24 hours/.test(r.body.error || ''), (r.body.error || '').slice(0, 50));
}
{
  const r = await submit(now + 2 * HOUR, 1200);
  check('a payment dated in the future is refused',
    r.body.ok === false && r.rowsWritten === 0 && /future/.test(r.body.error || ''),
    (r.body.error || '').slice(0, 50));
}
{
  const r = await submit(now + 60 * 1000, 1200);
  check('a minute of clock skew is tolerated', r.body.ok === true && r.rowsWritten === 1,
    JSON.stringify(r.body).slice(0, 60));
}
{
  // The amount check must still work inside the window.
  const r = await submit(now - HOUR, 10);
  check('a fresh but short payment is still refused',
    r.body.ok === false && r.rowsWritten === 0 && /short/.test(r.body.error || ''),
    (r.body.error || '').slice(0, 50));
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed'));
process.exit(fails ? 1 : 0);
