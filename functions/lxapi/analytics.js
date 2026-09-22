// Cloudflare Web Analytics, read through the GraphQL Analytics API.
//
// The beacon is already collecting -- lumoscore.com was added to Web Analytics with "automatic setup",
// so Cloudflare injects it at the edge and there is nothing to install. This only READS what is
// already there, which is why the admin panel has real history from day one rather than starting at
// zero.
//
// Admin-gated: business traffic figures, and functions/ is shared with the public projects.
//
// The token lives in CF_ANALYTICS_TOKEN, an encrypted binding. It is never returned in a response and
// never logged -- errors report the API's message, not the credential.
import { requireAdmin } from '../../_lib/adminauth.js';

const ACCOUNT = '72af0a6a015f52baf2578ddcf3b12ef3';
const GQL = 'https://api.cloudflare.com/client/v4/graphql';
const SITES = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/rum/site_info/list';
const HOST = 'lumoscore.com';
const SITE_TAG = '1c1acb7778c946578746f33ab23b99f0';   // lumoscore.com

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Finding the site tag.
//
// The obvious route -- the REST /rum/site_info/list endpoint -- returns 403 for a token with Account
// Analytics Read: that listing needs a different scope from the analytics data itself. Rather than ask
// for a broader token than this needs, the tag is discovered through the SAME GraphQL surface the data
// comes from, so one permission covers everything.
//
// Tried in order: an explicit ?site=, then GraphQL discovery, then the REST list as a last resort for
// accounts where it happens to be permitted.
async function discoverViaGraphql(token) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const q = `query ($account: String!, $start: Time!) {
    viewer { accounts(filter: { accountTag: $account }) {
      rumPageloadEventsAdaptiveGroups(limit: 20, orderBy: [count_DESC],
        filter: { datetime_geq: $start }) { dimensions { siteTag } count }
    } }
  }`;
  const r = await fetch(GQL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ query: q, variables: { account: ACCOUNT, start: since } }),
  });
  const d = await r.json();
  if (d && d.errors && d.errors.length) {
    throw new Error('discovery: ' + d.errors.map((e) => e && e.message).join('; '));
  }
  const acc = (((d || {}).data || {}).viewer || {}).accounts;
  const rows = (acc && acc[0] && acc[0].rumPageloadEventsAdaptiveGroups) || [];
  return rows.map((x) => ({ tag: x.dimensions && x.dimensions.siteTag, count: x.count }))
    .filter((x) => x.tag);
}

async function siteTag(token, explicit) {
  if (explicit) return { tag: explicit, how: 'given' };
  if (SITE_TAG) return { tag: SITE_TAG, how: 'pinned' };
  let found = [];
  try { found = await discoverViaGraphql(token); } catch (e) { found = []; }
  if (found.length === 1) return { tag: found[0].tag, how: 'graphql', candidates: found };
  if (found.length > 1) {
    // More than one site on the account (lumoscore.com and blipradar.com). Busiest wins, and every
    // candidate is returned so the choice is visible rather than silently made.
    return { tag: found[0].tag, how: 'graphql-busiest', candidates: found };
  }
  const r = await fetch(SITES, {
    headers: { authorization: 'Bearer ' + token },
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!r.ok) throw new Error('could not identify the Web Analytics site: GraphQL discovery returned nothing and the site list gave ' + r.status);
  const d = await r.json();
  const list = (d && d.result) || [];
  const hit = list.filter((s) => {
    const z = (s && s.ruleset && (s.ruleset.zone_name || s.ruleset.zoneName)) || '';
    return z === HOST;
  })[0] || list[0];
  if (!hit) throw new Error('no Web Analytics site found on this account');
  return { tag: hit.site_tag || hit.siteTag, how: 'rest' };
}

// HUMANS ONLY (bot: 0) for every list and total, with the bot share reported beside them (RAZA 2026-09-22, "improve
// the overall design and make it more understandable"): a crawler's page view is not a visitor. Every field used here
// was checked against the schema of rumPageloadEventsAdaptiveGroups -- bot, datetimeHour, userAgentBrowser,
// userAgentOS, the bot filter and the *_ASC / count_DESC orders all exist. There is NO city and NO session field in it;
// those come from our own table (pageview, functions/lxapi/pv.js) below.
// ALL ROWS, NOT A TOP TEN (RAZA 2026-09-22: "Full and accurate stats are not shown ... i need to view all, from highest hits
// to at least 1 hit"). The lists were capped at 10-50 groups; they now ask for up to 1,000 (the API allows 10,000) and
// the page paginates. PER PAGE: with a path, every figure is filtered to that one page (requestPath is a filter field).
// SPLIT IN TWO, AND SMALLER ON A RETRY (RAZA 2026-09-22: "Could not read analytics: unable to execute query, please try
// again later", on 90D). That message is Cloudflare refusing a query that asks for too much at once -- the lists had grown
// to 1,000 groups each and 90 days of rows behind them. The headline figures and the lists are now two smaller queries
// sent together, and a refusal is retried once with shorter lists rather than shown to the reader.
function headQuery(hourly, withPath) {
  const PF = withPath ? ', requestPath: $path' : '';
  const F = '{ siteTag: $site, datetime_geq: $start, datetime_leq: $end, bot: 0' + PF + ' }';
  const series = hourly
    ? `series: rumPageloadEventsAdaptiveGroups(limit: 200, orderBy: [datetimeHour_ASC], filter: ${F}) { dimensions { t: datetimeHour } count sum { visits } }`
    : `series: rumPageloadEventsAdaptiveGroups(limit: 200, orderBy: [date_ASC], filter: ${F}) { dimensions { t: date } count sum { visits } }`;
  return `query ($account: String!, $site: String!, $start: Time!, $end: Time!, $pstart: Time!${withPath ? ', $path: string' : ''}) {
  viewer { accounts(filter: { accountTag: $account }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: ${F}) { count sum { visits } }
      prev: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $pstart, datetime_leq: $start, bot: 0${PF} }) { count sum { visits } }
      bots: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end, bot: 1${PF} }) { count }
      ${series}
  } }
}`;
}
function listQuery(withPath, big) {
  const PF = withPath ? ', requestPath: $path' : '';
  const F = '{ siteTag: $site, datetime_geq: $start, datetime_leq: $end, bot: 0' + PF + ' }';
  const L = big ? { p: 600, r: 600, c: 250, b: 100, s: 100 } : { p: 150, r: 150, c: 150, b: 40, s: 40 };
  const pages = withPath ? '' : `pages: rumPageloadEventsAdaptiveGroups(limit: ${L.p}, orderBy: [count_DESC], filter: ${F}) { dimensions { requestPath } count sum { visits } }`;
  return `query ($account: String!, $site: String!, $start: Time!, $end: Time!${withPath ? ', $path: string' : ''}) {
  viewer { accounts(filter: { accountTag: $account }) {
      ${pages}
      referers: rumPageloadEventsAdaptiveGroups(limit: ${L.r}, orderBy: [count_DESC], filter: ${F}) { dimensions { refererHost } count sum { visits } }
      countries: rumPageloadEventsAdaptiveGroups(limit: ${L.c}, orderBy: [count_DESC], filter: ${F}) { dimensions { countryName } count sum { visits } }
      devices: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: ${F}) { dimensions { deviceType } count }
      browsers: rumPageloadEventsAdaptiveGroups(limit: ${L.b}, orderBy: [count_DESC], filter: ${F}) { dimensions { userAgentBrowser } count }
      systems: rumPageloadEventsAdaptiveGroups(limit: ${L.s}, orderBy: [count_DESC], filter: ${F}) { dimensions { userAgentOS } count }
  } }
}`;
}
// One GraphQL call. Returns { acc, errors } -- the caller decides whether an error is worth a retry.
async function gql(token, query, variables) {
  const r = await fetch(GQL, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const d = await r.json();
  const errors = (d && d.errors && d.errors.length) ? d.errors.map((e) => e && e.message).filter(Boolean) : null;
  const acc = ((((d || {}).data || {}).viewer || {}).accounts || [])[0] || null;
  return { acc, errors };
}

// Our own page views: sessions (so a bounce rate), and cities per country. Only rows served on lumoscore.com count.
// A bounce is a session with exactly one page view. Missing table or binding -> null, never an error for the page.
// With a path: the bounce rate of visits that STARTED on that page (the usual "entry page" bounce), and the cities
// of the people who viewed it.
async function ownStats(db, startMs, prevStartMs, path) {
  if (!db) return null;
  const H = 'lumoscore.com';
  try {
    const now = Date.now();
    const sess = (w0, w1) => (path
      ? db.prepare(
        'SELECT COUNT(*) AS sessions, SUM(CASE WHEN s.n = 1 THEN 1 ELSE 0 END) AS bounces, SUM(s.n) AS views FROM '
        + '(SELECT sid, COUNT(*) AS n, MIN(ts) AS t0 FROM pageview WHERE ts >= ?1 AND ts < ?2 AND host = ?3 GROUP BY sid) s '
        + 'WHERE (SELECT x.path FROM pageview x WHERE x.sid = s.sid AND x.ts = s.t0 AND x.host = ?3 LIMIT 1) = ?4'
      ).bind(w0, w1, H, path)
      : db.prepare(
        'SELECT COUNT(*) AS sessions, SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END) AS bounces, SUM(n) AS views '
        + 'FROM (SELECT sid, COUNT(*) AS n FROM pageview WHERE ts >= ?1 AND ts < ?2 AND host = ?3 GROUP BY sid)'
      ).bind(w0, w1, H)).first();
    const [cur, prev, cities, since, refs] = await Promise.all([
      sess(startMs, now + 60000),
      sess(prevStartMs, startMs),
      (path
        ? db.prepare('SELECT country, city, region, COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview '
          + 'WHERE ts >= ?1 AND host = ?2 AND path = ?3 GROUP BY country, city, region ORDER BY views DESC LIMIT 3000').bind(startMs, H, path)
        : db.prepare('SELECT country, city, region, COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview '
          + 'WHERE ts >= ?1 AND host = ?2 GROUP BY country, city, region ORDER BY views DESC LIMIT 3000').bind(startMs, H)).all(),
      db.prepare('SELECT MIN(ts) AS first FROM pageview WHERE host = ?1').bind(H).first(),
      (path
        ? db.prepare("SELECT ref, COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview WHERE ts >= ?1 AND host = ?2 AND path = ?3 AND ref <> '' GROUP BY ref ORDER BY views DESC LIMIT 500").bind(startMs, H, path)
        : db.prepare("SELECT ref, COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview WHERE ts >= ?1 AND host = ?2 AND ref <> '' GROUP BY ref ORDER BY views DESC LIMIT 500").bind(startMs, H)).all(),
    ]);
    const byCountry = {};
    ((cities && cities.results) || []).forEach((r) => {
      const c = (r.country || '').toUpperCase() || '??';
      (byCountry[c] = byCountry[c] || []).push({ city: r.city || '', region: r.region || '', views: r.views, sessions: r.sessions });
    });
    const pack = (x) => (x ? { sessions: +x.sessions || 0, bounces: +x.bounces || 0, views: +x.views || 0 } : null);
    // the counter went live on lumoscore.com at this moment (main 7c7c7074); before any row exists, that is the honest start
    return { since: since && since.first ? since.first : Date.parse('2026-09-22T16:59:00Z'), cur: pack(cur), prev: pack(prev), cities: byCountry,
      refs: ((refs && refs.results) || []).map((r) => ({ ref: r.ref, views: r.views, sessions: r.sessions })) };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;

  const token = env && env.CF_ANALYTICS_TOKEN;
  // A missing binding is reported as such rather than as an empty dashboard: "no traffic" and "we have
  // no way to ask" must not look the same.
  if (!token) return json({ error: 'no token', reason: 'CF_ANALYTICS_TOKEN is not set on this project' }, 200);

  const u = new URL(request.url);
  // range=24h|7d|30d|90d ("no way to view 24H visits"); ?days= still accepted from older pages
  const RANGES = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
  const range = RANGES[u.searchParams.get('range')] ? u.searchParams.get('range')
    : ({ 1: '24h', 7: '7d', 30: '30d', 90: '90d' }[parseInt(u.searchParams.get('days'), 10)] || '30d');
  const days = RANGES[range];
  const hourly = range === '24h';
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const pstart = new Date(start.getTime() - days * 86400000);   // the same length of time, immediately before

  try {
    const found = await siteTag(token, u.searchParams.get("site") || "");
    const site = found.tag;
    // ?live=1 -> WHO IS ON THE SITE RIGHT NOW (RAZA 2026-09-22: "its also important to know who's live on the platform and
    // from where and on which page"). Only our own page views can answer this: Cloudflare's analytics is aggregated with a
    // delay. One row per session seen in the last 5 minutes, with the page it is on, its city and country. The session id
    // is shortened to six characters -- enough to tell two visitors apart on screen, useless for anything else.
    if (u.searchParams.get('live')) {
      const db = env && env.ADMIN_DB;
      if (!db) return json({ live: { sessions: 0, views: 0, rows: [], reason: 'no db' } }, 200);
      const since = Date.now() - 300000, H2 = 'lumoscore.com';
      try {
        const [now, tot] = await Promise.all([
          db.prepare(
            'SELECT p.sid AS sid, p.ts AS ts, p.path AS path, p.country AS country, p.region AS region, p.city AS city, p.device AS device '
            + 'FROM pageview p JOIN (SELECT sid, MAX(ts) AS t FROM pageview WHERE ts > ?1 AND host = ?2 GROUP BY sid) m '
            + 'ON m.sid = p.sid AND m.t = p.ts WHERE p.host = ?2 ORDER BY p.ts DESC LIMIT 100'
          ).bind(since, H2).all(),
          db.prepare('SELECT COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview WHERE ts > ?1 AND host = ?2').bind(since, H2).first(),
        ]);
        return json({ live: {
          windowMinutes: 5,
          sessions: (tot && +tot.sessions) || 0,
          views: (tot && +tot.views) || 0,
          rows: ((now && now.results) || []).map((r) => ({
            id: String(r.sid || '').slice(0, 6), sid: r.sid, ts: r.ts, path: r.path,
            country: (r.country || '').toUpperCase(), region: r.region || '', city: r.city || '', device: r.device || '',
          })),
        } }, 200);
      } catch (e) { return json({ live: { sessions: 0, views: 0, rows: [], error: String((e && e.message) || e) } }, 200); }
    }

    // ?session=<sid> -> what that visitor has been doing: the pages of the visit and the links and buttons pressed,
    // newest first. Both halves come from our own records; nothing here exists in Cloudflare's analytics.
    const sess = String(u.searchParams.get('session') || '');
    if (sess) {
      const db = env && env.ADMIN_DB;
      if (!/^[a-z0-9]{6,40}$/.test(sess) || !db) return json({ journey: { rows: [] } }, 200);
      const H3 = 'lumoscore.com', from = Date.now() - 6 * 3600000;
      try {
        const r3 = await db.prepare(
          "SELECT ts, path, 'page' AS kind, '' AS label, '' AS href FROM pageview WHERE sid = ?1 AND host = ?2 AND ts > ?3"
          + " UNION ALL SELECT ts, path, kind, label, href FROM pvevent WHERE sid = ?1 AND host = ?2 AND ts > ?3"
          + ' ORDER BY ts DESC LIMIT 100'
        ).bind(sess, H3, from).all();
        return json({ journey: { sid: sess.slice(0, 6), rows: ((r3 && r3.results) || []).map((r) => ({ ts: r.ts, path: r.path, kind: r.kind, label: r.label || '', href: r.href || '' })) } }, 200);
      } catch (e) { return json({ journey: { rows: [], error: String((e && e.message) || e) } }, 200); }
    }

    // ?refhost=t.co -> WHICH link on that site brought the visits (RAZA 2026-09-22: "which exact tweet or page brought that
    // visit"). refererPath is what the other site let the browser send: t.co gives the exact short link of the tweet's
    // link, forums and blogs give their page, while Google, Bing and chatgpt.com send their bare address only -- search
    // queries have not been passed to websites since search went encrypted. Paired with the page it landed on here.
    const refhost = String(u.searchParams.get('refhost') || '');
    if (refhost) {
      if (!/^[a-z0-9.:()_-]{1,120}$/i.test(refhost)) return json({ error: 'bad refhost' }, 200);
      const rp = String(u.searchParams.get('path') || '');
      const pathF = (rp.charAt(0) === '/' && rp.length <= 300) ? ', requestPath: $path' : '';
      const RQ = `query ($account: String!, $site: String!, $start: Time!, $end: Time!, $rh: string${pathF ? ', $path: string' : ''}) {
  viewer { accounts(filter: { accountTag: $account }) {
    refPaths: rumPageloadEventsAdaptiveGroups(limit: 300, orderBy: [sum_visits_DESC], filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end, bot: 0, refererHost: $rh${pathF} }) { dimensions { refererPath requestPath } count sum { visits } }
  } }
}`;
      const vars = { account: ACCOUNT, site, start: start.toISOString(), end: end.toISOString(), rh: refhost === '(none)' ? '' : refhost };
      if (pathF) vars.path = rp;
      const rr = await fetch(GQL, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ query: RQ, variables: vars }) });
      const rd = await rr.json();
      if (rd && rd.errors && rd.errors.length) return json({ error: 'graphql', messages: rd.errors.map((e) => e && e.message).filter(Boolean) }, 200);
      const ra = ((((rd || {}).data || {}).viewer || {}).accounts || [])[0] || {};
      return json({ range, refhost, refPaths: (ra.refPaths || []).map((x) => ({
        ref: (x.dimensions && x.dimensions.refererPath) || '', landing: (x.dimensions && x.dimensions.requestPath) || '',
        visits: x.sum ? x.sum.visits : 0, views: x.count,
      })).filter((x) => x.visits > 0) }, 200);
    }

    // ?path=/trade/stellar -> every figure for that one page (the per-page panel). A path, nothing else, and bounded.
    let path = String(u.searchParams.get('path') || '');
    path = (path.charAt(0) === '/' && path.length <= 300) ? path : '';
    const ownP = ownStats(env && env.ADMIN_DB, start.getTime(), pstart.getTime(), path);
    const vars = { account: ACCOUNT, site, start: start.toISOString(), end: end.toISOString(), pstart: pstart.toISOString(), ...(path ? { path } : {}) };
    const lvars = { account: ACCOUNT, site, start: vars.start, end: vars.end, ...(path ? { path } : {}) };
    // the two halves together; if Cloudflare refuses the lists (they are the expensive half), ask again for shorter ones
    let [head, lists] = await Promise.all([ gql(token, headQuery(hourly, !!path), vars), gql(token, listQuery(!!path, true), lvars) ]);
    if (lists.errors) lists = await gql(token, listQuery(!!path, false), lvars);
    // the headline figures are cheap; a refusal there is worth reporting verbatim rather than guessing
    if (head.errors) return json({ error: 'graphql', messages: head.errors, site, found }, 200);
    if (!head.acc) return json({ error: 'no account data', site }, 200);
    // lists that still fail leave the page with its totals and chart rather than nothing at all
    const a = Object.assign({}, head.acc, lists.acc || {});
    const listErrors = lists.errors || null;

    const tot = (a.totals && a.totals[0]) || null;
    const prv = (a.prev && a.prev[0]) || null;
    const bot = (a.bots && a.bots[0]) || null;
    const flat = (rows, key) => (rows || []).map((x) => ({
      key: (x.dimensions && x.dimensions[key]) || '(none)',
      count: x.count,
      visits: x.sum ? x.sum.visits : undefined,
    }));
    const own = await ownP;

    return json({
      site, siteFoundBy: found.how, siteCandidates: found.candidates || null, listErrors,
      range, days, hourly, path: path || null, start: start.toISOString(), end: end.toISOString(),
      pageViews: tot ? tot.count : 0,
      visits: tot && tot.sum ? tot.sum.visits : 0,
      prev: { pageViews: prv ? prv.count : 0, visits: prv && prv.sum ? prv.sum.visits : 0 },
      botViews: bot ? bot.count : 0,
      series: (a.series || []).map((x) => ({
        t: x.dimensions && x.dimensions.t,
        views: x.count,
        visits: x.sum ? x.sum.visits : 0,
      })),
      topPages: flat(a.pages, 'requestPath'),
      topReferers: flat(a.referers, 'refererHost'),
      countries: flat(a.countries, 'countryName'),
      devices: flat(a.devices, 'deviceType'),
      browsers: flat(a.browsers, 'userAgentBrowser'),
      systems: flat(a.systems, 'userAgentOS'),
      own,
    }, 200);
  } catch (e) {
    return json({ error: 'request failed', message: String((e && e.message) || e) }, 200);
  }
}
