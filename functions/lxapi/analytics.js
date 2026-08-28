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

const QUERY = `query ($account: String!, $site: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      totals: rumPageloadEventsAdaptiveGroups(
        limit: 1
        filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
      ) { count sum { visits } }
      byDay: rumPageloadEventsAdaptiveGroups(
        limit: 100
        orderBy: [date_ASC]
        filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
      ) { dimensions { date } count sum { visits } }
      pages: rumPageloadEventsAdaptiveGroups(
        limit: 10
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
      ) { dimensions { requestPath } count }
      referers: rumPageloadEventsAdaptiveGroups(
        limit: 10
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
      ) { dimensions { refererHost } count }
      countries: rumPageloadEventsAdaptiveGroups(
        limit: 10
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
      ) { dimensions { countryName } count }
      devices: rumPageloadEventsAdaptiveGroups(
        limit: 6
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }
      ) { dimensions { deviceType } count }
    }
  }
}`;

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;

  const token = env && env.CF_ANALYTICS_TOKEN;
  // A missing binding is reported as such rather than as an empty dashboard: "no traffic" and "we have
  // no way to ask" must not look the same.
  if (!token) return json({ error: 'no token', reason: 'CF_ANALYTICS_TOKEN is not set on this project' }, 200);

  const u = new URL(request.url);
  const days = Math.max(1, Math.min(90, parseInt(u.searchParams.get('days'), 10) || 30));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);

  try {
    const found = await siteTag(token, u.searchParams.get("site") || "");
    const site = found.tag;
    const r = await fetch(GQL, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          account: ACCOUNT, site,
          start: start.toISOString(), end: end.toISOString(),
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
    const flat = (rows, key) => (rows || []).map((x) => ({
      key: (x.dimensions && x.dimensions[key]) || '(none)',
      count: x.count,
    }));

    return json({
      site, siteFoundBy: found.how, siteCandidates: found.candidates || null, days,
      pageViews: tot ? tot.count : 0,
      visits: tot && tot.sum ? tot.sum.visits : 0,
      byDay: (a.byDay || []).map((x) => ({
        date: x.dimensions && x.dimensions.date,
        views: x.count,
        visits: x.sum ? x.sum.visits : 0,
      })),
      topPages: flat(a.pages, 'requestPath'),
      topReferers: flat(a.referers, 'refererHost'),
      topCountries: flat(a.countries, 'countryName'),
      devices: flat(a.devices, 'deviceType'),
    }, 200);
  } catch (e) {
    return json({ error: 'request failed', message: String((e && e.message) || e) }, 200);
  }
}
