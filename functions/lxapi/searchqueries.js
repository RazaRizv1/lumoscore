// GET /lxapi/searchqueries -- the search terms that showed or brought people to LumosCore, for the admin Analytics page.
//
// WHY NOT FROM THE REFERRER (RAZA 2026-11-18: "any way to know the searched query on DuckDuckGo that brought the user
// to this page?"). Every major engine strips the terms from the referrer -- a visitor from DuckDuckGo arrives with
// "duckduckgo.com" and nothing else -- so no site can read them that way. The engines report them to the site's owner
// instead, so they are read from there:
//   * Google Search Console API (searchAnalytics.query), per day, through a service account RAZA adds to the property.
//   * Bing Webmaster Tools API (GetQueryStats), with an API key from his Bing account. DuckDuckGo's results come largely
//     from Bing, so this is as close to DuckDuckGo's queries as any site can get.
// Both are aggregated by the engines: clicks, impressions and position per query, never who searched.
//
// KEPT, NOT JUST READ: the engines keep 16 months (Google) and 6 months (Bing). Every day is stored in the admin
// database, so the history here outlives both.
//
// NO SCHEDULE ON PAGES: this syncs when the admin opens the section, at most every SYNC_HOURS, a few Google days per
// request (a first sync backfills BACKFILL_DAYS over several loads). Data lags: Google ~2 days, Bing ~a week.
//
// ADMIN ONLY. functions/ is deployed to lumoscore.com too; requireAdmin refuses anything but the admin host with a
// valid Access token. Secrets live on the lumoscore-admin project only:
//   GSC_SERVICE_ACCOUNT  the service account's JSON key (as downloaded from Google Cloud)
//   GSC_SITE             optional; the property, e.g. "sc-domain:lumoscore.com" (default) or "https://lumoscore.com/"
//   BING_WEBMASTER_KEY   the API key from Bing Webmaster Tools (Settings -> API access)
//   BING_SITE            optional; default "https://lumoscore.com/"
import { requireAdmin } from '../../_lib/adminauth.js';

const SYNC_HOURS = 6, BACKFILL_DAYS = 90, GOOGLE_DAYS_PER_CALL = 15, GOOGLE_LAG_DAYS = 2;   // 15 days a load: the backfill finishes in ~6 loads

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
const dayStr = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => dayStr(Date.parse(d + 'T00:00:00Z') + n * 86400000);

async function ensure(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS searchquery (day TEXT NOT NULL, engine TEXT NOT NULL, query TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, impressions INTEGER NOT NULL DEFAULT 0, position REAL, PRIMARY KEY (day, engine, query))'),
    db.prepare('CREATE TABLE IF NOT EXISTS searchsync (engine TEXT PRIMARY KEY, through TEXT, at INTEGER, error TEXT)'),
  ]);
}

// ---- Google: a service-account JWT (RS256) exchanged for an access token ------------------------------------------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = (s) => b64u(new TextEncoder().encode(s));
async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64uStr(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = String(sa.private_key || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + b64u(sig) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) throw new Error('Google sign-in failed: ' + ((j && (j.error_description || j.error)) || r.status));
  return j.access_token;
}
async function syncGoogle(env, db, st) {
  let sa;
  try { sa = JSON.parse(env.GSC_SERVICE_ACCOUNT); } catch (_) { throw new Error('GSC_SERVICE_ACCOUNT is not valid JSON'); }
  const site = env.GSC_SITE || 'sc-domain:lumoscore.com';
  const last = dayStr(Date.now() - GOOGLE_LAG_DAYS * 86400000);
  let from = st && st.through ? addDays(st.through, 1) : dayStr(Date.now() - BACKFILL_DAYS * 86400000);
  if (from > last) return { through: st.through, added: 0, done: true };
  const token = await googleToken(sa);
  let through = st && st.through, added = 0, d = from;
  for (let i = 0; i < GOOGLE_DAYS_PER_CALL && d <= last; i++, d = addDays(d, 1)) {
    const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(site) + '/searchAnalytics/query', {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: d, endDate: d, dimensions: ['query'], rowLimit: 5000, dataState: 'final' }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error('Search Console: ' + ((j && j.error && j.error.message) || ('HTTP ' + r.status)) + (r.status === 403 ? ' (is the service account added as a user on ' + site + '?)' : ''));
    const rows = (j && j.rows) || [];
    if (rows.length) {
      await db.batch(rows.map((x) => db.prepare('INSERT OR REPLACE INTO searchquery (day, engine, query, clicks, impressions, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind(d, 'google', String(x.keys && x.keys[0] || '').slice(0, 300), Math.round(x.clicks || 0), Math.round(x.impressions || 0), x.position != null ? +x.position : null)));
      added += rows.length;
    }
    through = d;
  }
  return { through, added, done: through >= last };
}

// ---- Bing: GetQueryStats, the last ~6 months by week -------------------------------------------------------------
async function syncBing(env, db) {
  const site = env.BING_SITE || 'https://lumoscore.com/';
  const r = await fetch('https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?siteUrl=' + encodeURIComponent(site) + '&apikey=' + encodeURIComponent(env.BING_WEBMASTER_KEY), {
    headers: { accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error('Bing Webmaster: HTTP ' + r.status + (r.status === 400 || r.status === 401 || r.status === 403 ? ' (check the API key and that ' + site + ' is verified in Bing Webmaster Tools)' : ''));
  const rows = (j.d || []).map((x) => {
    const m = /\/Date\((\d+)/.exec(String(x.Date || ''));
    return { day: m ? dayStr(+m[1]) : null, q: String(x.Query || '').slice(0, 300), c: +x.Clicks || 0, i: +x.Impressions || 0,
      p: x.AvgImpressionPosition != null && +x.AvgImpressionPosition > 0 ? +x.AvgImpressionPosition / 10 : null };   // Bing reports position x10
  }).filter((x) => x.day && x.q);
  for (let i = 0; i < rows.length; i += 50) {
    await db.batch(rows.slice(i, i + 50).map((x) => db.prepare('INSERT OR REPLACE INTO searchquery (day, engine, query, clicks, impressions, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(x.day, 'bing', x.q, x.c, x.i, x.p)));
  }
  return { through: rows.reduce((m, x) => (x.day > m ? x.day : m), ''), added: rows.length, done: true };
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const db = env && env.ADMIN_DB;
  if (!db) return json({ ok: false, error: 'no database binding' });
  const u = new URL(request.url);
  const days = { '7d': 7, '28d': 28, '30d': 30, '90d': 90, '365d': 365 }[u.searchParams.get('range') || '28d'] || null;   // null = all time
  await ensure(db);

  const engines = {
    google: { connected: !!env.GSC_SERVICE_ACCOUNT, run: (st) => syncGoogle(env, db, st),
      setup: 'Not connected: add a Google service account to Search Console and set GSC_SERVICE_ACCOUNT on the lumoscore-admin project.' },
    bing: { connected: !!env.BING_WEBMASTER_KEY, run: () => syncBing(env, db),
      setup: 'Not connected: create an API key in Bing Webmaster Tools and set BING_WEBMASTER_KEY on the lumoscore-admin project.' },
  };
  const status = {};
  const states = await db.prepare('SELECT engine, through, at, error FROM searchsync').all();
  const byE = {}; for (const s of (states.results || [])) byE[s.engine] = s;
  for (const [name, e] of Object.entries(engines)) {
    const st = byE[name] || null;
    if (!e.connected) { status[name] = { connected: false, note: e.setup }; continue; }
    // A FAILED SYNC IS RETRIED SOON, not in SYNC_HOURS (RAZA 2026-11-18: a key pasted wrongly, then re-sent correctly, kept
    // showing "not valid JSON" -- the old error was stored and nothing was tried again for six hours). After an error the
    // next load tries again once RETRY_MIN has passed, which also keeps a broken setup from hammering the engine.
    const RETRY_MIN = 2;
    const failed = st && st.error && st.error !== 'backfilling';
    const stale = !st || !st.at || Date.now() - st.at > SYNC_HOURS * 3600000 || (name === 'google' && st.error === 'backfilling')
      || (failed && Date.now() - st.at > RETRY_MIN * 60000);
    let res = null, err = st ? st.error : null, tried = false;
    if (stale || u.searchParams.get('sync') === '1') {
      tried = true;
      try { res = await e.run(st); err = res.done ? null : 'backfilling'; }
      catch (x) { err = String((x && x.message) || x).slice(0, 300); }
      await db.prepare('INSERT OR REPLACE INTO searchsync (engine, through, at, error) VALUES (?1, ?2, ?3, ?4)')
        .bind(name, (res && res.through) || (st && st.through) || null, Date.now(), err).run();
    }
    status[name] = { connected: true, through: (res && res.through) || (st && st.through) || null,
      synced_at: tried ? Date.now() : (st && st.at) || null, added_now: res ? res.added : undefined,
      backfilling: err === 'backfilling' || undefined, error: err && err !== 'backfilling' ? err : undefined };
  }

  const since = days ? dayStr(Date.now() - days * 86400000) : '0000-00-00';
  const rows = await db.prepare(
    'SELECT query, engine, SUM(clicks) AS clicks, SUM(impressions) AS impressions, '
    + 'CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) END AS position, '
    + 'MIN(day) AS first_seen, MAX(day) AS last_seen FROM searchquery WHERE day >= ?1 '
    + 'GROUP BY query, engine ORDER BY clicks DESC, impressions DESC LIMIT 500').bind(since).all();
  const tot = await db.prepare('SELECT engine, SUM(clicks) AS clicks, SUM(impressions) AS impressions, COUNT(DISTINCT query) AS queries FROM searchquery WHERE day >= ?1 GROUP BY engine').bind(since).all();
  return json({ ok: true, range: days ? days + 'd' : 'all', since: days ? since : null, status,
    totals: tot.results || [], rows: (rows.results || []).map((r) => ({ ...r, position: r.position != null ? Math.round(r.position * 10) / 10 : null })) });
}
