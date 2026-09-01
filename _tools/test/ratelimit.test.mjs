// Drives the REAL /lxapi/ev and /lxapi/act handlers with an in-memory KV and D1, and counts how many
// rows actually reach the database. Nothing here re-implements the limiter; it only looks at writes.
import { onRequestPost as evPost } from '../../functions/lxapi/ev.js';
import { onRequestPost as actPost } from '../../functions/lxapi/act.js';

const ADDR = 'GACMOLVJSPD6U2LJXAMA5N5BDOXO7JZTEFMZBMQSGR7TZIIOVBLJENQI';
const hashN = (n) => String(n).padStart(64, '0');

function makeKv() {
  const m = new Map();
  return { store: m,
    async get(k) { const v = m.get(k); return v === undefined ? null : v; },
    async put(k, v) { m.set(k, v); } };
}
function makeDb() {
  const writes = [];
  return { writes, prepare() { return { bind(...a) { return { async run() { writes.push(a); } }; } }; } };
}
function post(url, body, ip) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip } });
}

let fails = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name.padEnd(52) + ' ' + got + (ok ? '' : '   EXPECTED ' + want));
};

// ---- ev: 30/min ceiling from one IP -----------------------------------------------------------
{
  const kv = makeKv(), db = makeDb();
  for (let i = 0; i < 100; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('ev: 100 beacons from one IP reach the db', db.writes.length, 30);
}
// ---- ev: a different IP is unaffected ----------------------------------------------------------
{
  const kv = makeKv(), db = makeDb();
  for (let i = 0; i < 40; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '1.1.1.1'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  const first = db.writes.length;
  for (let i = 0; i < 5; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '2.2.2.2'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('ev: a second IP still gets through after the first is capped', db.writes.length - first, 5);
}
// ---- act: 20/min ceiling ------------------------------------------------------------------------
{
  const kv = makeKv(), db = makeDb();
  for (let i = 0; i < 100; i++) {
    await actPost({ request: post('https://x/lxapi/act', { addr: ADDR, hash: hashN(i) }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('act: 100 submissions from one IP reach the db', db.writes.length, 20);
}
// ---- fails OPEN when KV is unavailable ----------------------------------------------------------
{
  const db = makeDb();
  const brokenKv = { async get() { throw new Error('kv down'); }, async put() { throw new Error('kv down'); } };
  for (let i = 0; i < 50; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: brokenKv } });
  }
  check('ev: KV throwing does not block real beacons', db.writes.length, 50);
}
{
  const db = makeDb();
  for (let i = 0; i < 50; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '9.9.9.9'), env: { ADMIN_DB: db } });
  }
  check('ev: no KV binding at all does not block beacons', db.writes.length, 50);
}
// ---- the refusal must be invisible to the page --------------------------------------------------
{
  const kv = makeKv(), db = makeDb();
  let last;
  for (let i = 0; i < 40; i++) {
    last = await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('ev: a throttled beacon still answers 200', last.status, 200);
  check('ev: ...and says why', (await last.json()).reason, 'rate');
}
// ---- validation still runs, and a rejected body costs no counter ---------------------------------
{
  const kv = makeKv(), db = makeDb();
  for (let i = 0; i < 60; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: 'nonsense' }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('ev: malformed addresses are still refused outright', db.writes.length, 0);
  for (let i = 0; i < 10; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('ev: junk did not burn the real quota', db.writes.length, 10);
}
// ---- the two endpoints must not share a counter --------------------------------------------------
{
  const kv = makeKv(), db = makeDb();
  for (let i = 0; i < 30; i++) {
    await evPost({ request: post('https://x/lxapi/ev', { addr: ADDR }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  const afterEv = db.writes.length;
  for (let i = 0; i < 20; i++) {
    await actPost({ request: post('https://x/lxapi/act', { addr: ADDR, hash: hashN(i) }, '9.9.9.9'),
      env: { ADMIN_DB: db, CONTENT_KV: kv } });
  }
  check('act is not throttled by ev having used its quota', db.writes.length - afterEv, 20);
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed'));
process.exit(fails ? 1 : 0);
