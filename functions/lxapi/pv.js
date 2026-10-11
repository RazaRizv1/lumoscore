// First-party page views: the two things Cloudflare Web Analytics does not record.
//
// WHY THIS EXISTS (RAZA 2026-09-22: "its not showing the bounce rate ... when i tap on any country, it should show
// its cities"). Web Analytics' dataset has a country and no city, and it counts page views and arrivals but no
// SESSIONS -- which is what a bounce rate is made of. Its full field list (rumPageloadEventsAdaptiveGroups) was
// checked; neither exists anywhere in it. Only the site can know that two page views belong to one visit.
//
// WHAT IS STORED, one row per page view: the path (no query string), the host that referred the visitor (only when
// it is another site), the country / region / city Cloudflare attaches to the request, a coarse device class, the
// host the page was served on, and a random session id the page makes up and keeps in sessionStorage -- it lives
// for that browsing session only and is not tied to anything else; and since 2026-10-11 a daily visitor hash, so a
// person who comes back later the same day can be counted once rather than twice (see dailySalt below -- the salt
// is random, rotates every day and the previous day's is deleted, which is what keeps the hashes unlinkable).
// STILL NOT stored, and the hash does not change this: the IP address, the user agent, any cookie (there are
// none), the wallet address. The IP and user agent go into the hash and are never written down.
//
// Unauthenticated, like /lxapi/ev and /lxapi/act -- the visitor is anonymous by design. It is capped WITHOUT the KV
// rate limiter those use: KV allows 1,000 writes a day on this plan and the bridge record lives there too, while
// page views are far more frequent than wallet connections. The caps are D1 reads instead: 60 views per session per
// 10 minutes, and 2,000 an hour site-wide (real traffic is ~10 an hour). Rows older than 180 days are pruned.
const SID_RE = /^[a-z0-9]{12,40}$/;
let VID_READY = 0;
const PER_SID_10MIN = 60;
const PER_HOUR_ALL = 2000;
const KEEP_MS = 180 * 86400000;
const BOT_RE = /bot|crawler|spider|crawling|headless|lighthouse|pingdom|monitor|curl|wget|python|preview/i;
// A slow load is reported only past these. 5s to first byte is never a working connection, and a 20s load is
// the complaint itself. Ordinary traffic here is ~80ms, so nothing normal comes near them.
const PERF_TTFB_MS = 5000;
const PERF_LOAD_MS = 20000;
const PROTOCOLS = ['h3', 'h2', 'h2c', 'http/1.1', 'http/1.0', 'spdy/3.1', 'quic'];
const NAVTYPES = ['navigate', 'reload', 'back_forward', 'prerender'];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// ---- returning visitors, without ever storing an IP ---------------------------------------------
//
// RAZA asked to recognise returning visitors by IP. Storing the IP itself is the one thing not done
// here, and it should stay that way: an IP is personal data, it would have to be declared, and it is
// something that can be demanded later. The rest of this file is careful about exactly that -- the
// header above lists the IP among what is NOT stored.
//
// So keep the ANSWER and throw away the question. vid = sha256(salt + ip + user agent + host), kept
// to 16 hex characters: enough that a collision is not a practical concern at this traffic, short
// enough to be useless as an identifier on its own. The IP never reaches the database.
//
// THE SALT IS RANDOM, PER DAY, AND DESTROYED WITH THE DAY. This is what makes the hashes
// unlinkable: once a day's salt is gone, nobody -- including us -- can test an IP against the rows
// it produced, or connect them to yesterday's. That is also the limit of the feature, deliberately:
// it answers "did this person come back later today", never "is this the same person as last week".
// A single fixed secret would make every day linkable forever and would simply be a pseudonymous IP.
//
// INSERT OR IGNORE then SELECT, rather than checking first: two requests arriving together at
// midnight would otherwise generate two salts and split that day's visitors between them. The
// primary key settles which one wins and both then read it back.
async function dailySalt(db, day) {
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS pv_salt (day TEXT PRIMARY KEY, salt TEXT NOT NULL)').run();
    const fresh = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    await db.prepare('INSERT OR IGNORE INTO pv_salt (day, salt) VALUES (?1, ?2)').bind(day, fresh).run();
    const row = await db.prepare('SELECT salt FROM pv_salt WHERE day = ?1').bind(day).first();
    // Yesterday's salt is not kept "just in case". Keeping it is the whole thing this avoids.
    try { await db.prepare('DELETE FROM pv_salt WHERE day < ?1').bind(day).run(); } catch (_) { }
    return (row && row.salt) || '';
  } catch (_) { return ''; }
}

async function visitorId(db, request, day, ua, host) {
  try {
    const ip = request.headers.get('cf-connecting-ip') || '';
    if (!ip) return '';
    const salt = await dailySalt(db, day);
    if (!salt) return '';
    const buf = new TextEncoder().encode(salt + '|' + ip + '|' + ua + '|' + host);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(dig)).slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { return ''; }
}
function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
function deviceOf(ua) {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export async function onRequestPost({ request, env }) {
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, reason: 'no db' }, 200);
  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOT_RE.test(ua)) return json({ ok: false, reason: 'bot' }, 200);

  let b = null;
  try { b = JSON.parse(await request.text()); } catch (_) { return json({ ok: false, reason: 'bad body' }, 200); }

  // A CLICK (RAZA 2026-09-22: "also show their live activity, for eg: clicks and pages. just like ... Plausible"). Only
  // what the link or button SAYS, and for a link leaving the site its destination host -- never typed text, amounts,
  // addresses or any form value. Capped harder than page views: 200 an hour per session, 6,000 an hour site-wide.
  if (b && b.kind === 'click') {
    const csid = String(b.sid || ''), cpath = String(b.path || '');
    if (!SID_RE.test(csid) || cpath.charAt(0) !== '/') return json({ ok: false, reason: 'bad click' }, 200);
    const label = clip(String(b.label || '').replace(/\s+/g, ' ').trim(), 80);
    const href = /^[a-z0-9.-]{1,100}$/i.test(String(b.href || '')) ? String(b.href).toLowerCase() : '';
    if (!label && !href) return json({ ok: false, reason: 'empty' }, 200);
    const t = Date.now();
    let chost = ''; try { chost = new URL(request.url).hostname.replace(/^www\./, ''); } catch (_) { }
    try {
      const lim = await db.prepare(
        'SELECT (SELECT COUNT(*) FROM pvevent WHERE sid = ?1 AND ts > ?2) AS s, (SELECT COUNT(*) FROM pvevent WHERE ts > ?2) AS h'
      ).bind(csid, t - 3600000).first();
      if (lim && ((+lim.s || 0) >= 200 || (+lim.h || 0) >= 6000)) return json({ ok: false, reason: 'rate' }, 200);
      await db.prepare('INSERT INTO pvevent (ts, sid, path, kind, label, href, host) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
        .bind(t, csid, clip(cpath.split('?')[0], 200), 'click', label, href, chost).run();
      if (Math.random() < 0.005) await db.prepare('DELETE FROM pvevent WHERE ts < ?1').bind(t - KEEP_MS).run();
    } catch (e) { return json({ ok: false, reason: 'write failed' }, 200); }
    return json({ ok: true }, 200);
  }

  // A LOAD THAT TOOK ABSURDLY LONG, reported by the page that suffered it (RAZA, repeatedly: "I've already
  // opened LumosCore 15+ seconds ago but the page just wont load ... now its been over 45 seconds").
  //
  // Nothing we could measure from outside showed it -- the origin answers in ~80ms, forty cache-busted probes
  // never once went over 1.5s -- because whatever is wrong happens before the response reaches the browser.
  // The browser is the only party that can see that, and it already knows: PerformanceNavigationTiming has the
  // protocol it was actually served over, the DNS and connect times, and the time to first byte. Nobody was
  // reading it.
  //
  // Only the pathological ones are sent, so this is a handful of rows a month rather than a metric. The LABEL IS
  // BUILT HERE from numbers, never from a string the page supplied: this endpoint is unauthenticated, so text
  // taken on trust from the client would be text an attacker can write into the admin's activity feed.
  if (b && b.kind === 'perf') {
    const psid = String(b.sid || ''), ppath = String(b.path || '');
    if (!SID_RE.test(psid) || ppath.charAt(0) !== '/') return json({ ok: false, reason: 'bad perf' }, 200);
    const num = (v) => { const n = Math.round(+v); return (isFinite(n) && n >= 0 && n <= 600000) ? n : 0; };
    const ttfb = num(b.ttfb), load = num(b.load), dns = num(b.dns), conn = num(b.conn), dl = num(b.dl);
    // The same threshold the page applies, enforced again here -- a client is free to lie about being slow.
    if (ttfb < PERF_TTFB_MS && load < PERF_LOAD_MS) return json({ ok: false, reason: 'not slow' }, 200);
    const proto = PROTOCOLS.indexOf(String(b.proto || '').toLowerCase()) >= 0 ? String(b.proto).toLowerCase() : '?';
    const navt = NAVTYPES.indexOf(String(b.nav || '')) >= 0 ? String(b.nav) : '';
    const s = (ms) => (ms / 1000).toFixed(1);
    const label = clip('slow ' + s(load || ttfb) + 's · ' + proto + ' · dns ' + s(dns) + ' conn ' + s(conn)
      + ' ttfb ' + s(ttfb) + ' dl ' + s(dl) + (navt && navt !== 'navigate' ? ' · ' + navt : ''), 80);
    const t = Date.now();
    let phost = ''; try { phost = new URL(request.url).hostname.replace(/^www\./, ''); } catch (_) { }
    try {
      const lim = await db.prepare(
        "SELECT (SELECT COUNT(*) FROM pvevent WHERE sid = ?1 AND kind = 'perf' AND ts > ?2) AS s,"
        + " (SELECT COUNT(*) FROM pvevent WHERE kind = 'perf' AND ts > ?2) AS h"
      ).bind(psid, t - 3600000).first();
      if (lim && ((+lim.s || 0) >= 10 || (+lim.h || 0) >= 500)) return json({ ok: false, reason: 'rate' }, 200);
      await db.prepare('INSERT INTO pvevent (ts, sid, path, kind, label, href, host) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
        .bind(t, psid, clip(ppath.split('?')[0], 200), 'perf', label, '', phost).run();
    } catch (e) { return json({ ok: false, reason: 'write failed' }, 200); }
    return json({ ok: true, recorded: label }, 200);
  }

  const sid = String((b && b.sid) || '');
  let path = String((b && b.path) || '');
  let ref = String((b && b.ref) || '');
  if (!SID_RE.test(sid)) return json({ ok: false, reason: 'bad sid' }, 200);
  if (path.charAt(0) !== '/') return json({ ok: false, reason: 'bad path' }, 200);
  path = clip(path.split('?')[0].split('#')[0], 200);
  ref = /^[a-z0-9.-]{1,100}$/i.test(ref) ? ref.toLowerCase() : '';

  // the host the page was served on: lumoscore.com is the site; staging and previews are kept apart so a test
  // can never inflate the real figures (the admin reads host = 'lumoscore.com' only)
  let host = '';
  try { host = new URL(request.url).hostname.replace(/^www\./, ''); } catch (_) { }
  const cf = request.cf || {};
  const country = clip(cf.country || '', 2).toUpperCase();
  const region = clip(cf.region || '', 80);
  const city = clip(cf.city || '', 80);
  const now = Date.now();

  try {
    const lim = await db.prepare(
      'SELECT (SELECT COUNT(*) FROM pageview WHERE sid = ?1 AND ts > ?2) AS s, (SELECT COUNT(*) FROM pageview WHERE ts > ?3) AS h'
    ).bind(sid, now - 600000, now - 3600000).first();
    if (lim && ((+lim.s || 0) >= PER_SID_10MIN || (+lim.h || 0) >= PER_HOUR_ALL)) return json({ ok: false, reason: 'rate' }, 200);
    const day = new Date(now).toISOString().slice(0, 10);
    // Added to an existing table, so the column may not be there yet. Same lazy pattern sendmail.js
    // uses: attempt it once per isolate and ignore the "duplicate column" that every later boot gets.
    if (!VID_READY) { VID_READY = 1; try { await db.prepare('ALTER TABLE pageview ADD COLUMN vid TEXT').run(); } catch (_) { } }
    const vid = await visitorId(db, request, day, ua, host);
    await db.prepare(
      'INSERT INTO pageview (ts, day, sid, path, ref, country, region, city, device, host, vid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)'
    ).bind(now, day, sid, path, ref, country, region, city, deviceOf(ua), host, vid).run();
    if (Math.random() < 0.005) await db.prepare('DELETE FROM pageview WHERE ts < ?1').bind(now - KEEP_MS).run();
  } catch (e) {
    return json({ ok: false, reason: 'write failed' }, 200);
  }
  return json({ ok: true }, 200);
}
