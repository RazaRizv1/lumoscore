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
function buildQuery(hourly, withPath) {
  const PF = withPath ? ', requestPath: $path' : '';
  const F = '{ siteTag: $site, datetime_geq: $start, datetime_leq: $end, bot: 0' + PF + ' }';
  const series = hourly
    ? `series: rumPageloadEventsAdaptiveGroups(limit: 200, orderBy: [datetimeHour_ASC], filter: ${F}) { dimensions { t: datetimeHour } count sum { visits } }`
    : `series: rumPageloadEventsAdaptiveGroups(limit: 200, orderBy: [date_ASC], filter: ${F}) { dimensions { t: date } count sum { visits } }`;
  const pages = withPath ? '' : `pages: rumPageloadEventsAdaptiveGroups(limit: 1000, orderBy: [count_DESC], filter: ${F}) { dimensions { requestPath } count sum { visits } }`;
  return `query ($account: String!, $site: String!, $start: Time!, $end: Time!, $pstart: Time!${withPath ? ', $path: string' : ''}) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: ${F}) { count sum { visits } }
      prev: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $pstart, datetime_leq: $start, bot: 0${PF} }) { count sum { visits } }
      bots: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end, bot: 1${PF} }) { count }
      ${series}
      ${pages}
      referers: rumPageloadEventsAdaptiveGroups(limit: 1000, orderBy: [count_DESC], filter: ${F}) { dimensions { refererHost } count sum { visits } }
      countries: rumPageloadEventsAdaptiveGroups(limit: 300, orderBy: [count_DESC], filter: ${F}) { dimensions { countryName } count sum { visits } }
      devices: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: ${F}) { dimensions { deviceType } count }
      browsers: rumPageloadEventsAdaptiveGroups(limit: 200, orderBy: [count_DESC], filter: ${F}) { dimensions { userAgentBrowser } count }
      systems: rumPageloadEventsAdaptiveGroups(limit: 200, orderBy: [count_DESC], filter: ${F}) { dimensions { userAgentOS } count }
    }
  }
}`;
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
    const [cur, prev, cities, since] = await Promise.all([
      sess(startMs, now + 60000),
      sess(prevStartMs, startMs),
      (path
        ? db.prepare('SELECT country, city, region, COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview '
          + 'WHERE ts >= ?1 AND host = ?2 AND path = ?3 GROUP BY country, city, region ORDER BY views DESC LIMIT 3000').bind(startMs, H, path)
        : db.prepare('SELECT country, city, region, COUNT(*) AS views, COUNT(DISTINCT sid) AS sessions FROM pageview '
          + 'WHERE ts >= ?1 AND host = ?2 GROUP BY country, city, region ORDER BY views DESC LIMIT 3000').bind(startMs, H)).all(),
      db.prepare('SELECT MIN(ts) AS first FROM pageview WHERE host = ?1').bind(H).first(),
    ]);
    const byCountry = {};
    ((cities && cities.results) || []).forEach((r) => {
      const c = (r.country || '').toUpperCase() || '??';
      (byCountry[c] = byCountry[c] || []).push({ city: r.city || '', region: r.region || '', views: r.views, sessions: r.sessions });
    });
    const pack = (x) => (x ? { sessions: +x.sessions || 0, bounces: +x.bounces || 0, views: +x.views || 0 } : null);
    return { since: since && since.first ? since.first : null, cur: pack(cur), prev: pack(prev), cities: byCountry };
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
    // ?path=/trade/stellar -> every figure for that one page (the per-page panel). A path, nothing else, and bounded.
    let path = String(u.searchParams.get('path') || '');
    path = (path.charAt(0) === '/' && path.length <= 300) ? path : '';
    const ownP = ownStats(env && env.ADMIN_DB, start.getTime(), pstart.getTime(), path);
    const r = await fetch(GQL, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: buildQuery(hourly, !!path),
        variables: {
          account: ACCOUNT, site,
          start: start.toISOString(), end: end.toISOString(), pstart: pstart.toISOString(),
          ...(path ? { path } : {}),
        },
      }),
    });
    const d = await r.json();
    // GraphQL answers 200 with an errors array, so the status alone proves nothing. The message is
    // passed through verbatim: a wrong field name here is diagnosable only if the API's own words survive.
    if (d && d.errors && d.errors.length) {
      return json({ error: 'graphql', messages: d.errors.map((e) => e && e.message).filter(Boolean), site, found }, 200);
    }
    const acc = (((d || {}).data || {}).viewer || {}).accounts;
    if (!acc || !acc.length) return json({ error: 'no account data', site }, 200);
    const a = acc[0];

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
      site, siteFoundBy: found.how, siteCandidates: found.candidates || null,
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
