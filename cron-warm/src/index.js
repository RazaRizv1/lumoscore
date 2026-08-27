// Keeps /lxapi/pools warm so no visitor ever pays for a cold build.
//
// WHY THIS IS A SEPARATE WORKER. Cloudflare Pages Functions cannot run cron -- there is no `scheduled`
// handler on Pages, it is a Workers-only feature. So the site itself cannot schedule its own refresh;
// something outside has to poke it. This Worker exists for that one job and nothing else.
//
// It is deliberately dumb: it makes plain public GETs to an endpoint that is already public, reads no
// secret, and can do nothing a visitor refreshing the page could not do.

const SLEEP_MS = 20000;   // one build step is ~40 sequential Horizon pages, ~16s -- don't overlap them
const ROUNDS = 8;         // a full cold build takes 2-3 steps; 8 is headroom, not an expectation
const FRESH_MS = 900000;  // must match RANK_TTL in functions/lxapi/pools.js

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function warm(base, log) {
  for (let i = 0; i < ROUNDS; i++) {
    // The cache-buster is the point: the endpoint answers `public, max-age=120`, so without a varying
    // query the edge would hand us its own cached copy and the Function would never run.
    let d = null;
    try {
      const r = await fetch(base + '/lxapi/pools?per=25&page=1&warm=' + Date.now(),
        { headers: { 'user-agent': 'lumos-pool-warmer' } });
      if (r.ok) d = await r.json();
    } catch (e) { log.push('round ' + i + ': ' + e.message); }

    if (!d) { log.push('round ' + i + ': no response'); await sleep(SLEEP_MS); continue; }
    if (d.warming) { log.push('round ' + i + ': building, ' + (d.scanned || 0) + ' pools scanned'); await sleep(SLEEP_MS); continue; }

    // Served a ranking. If it is fresh we are done; if it is stale this request just kicked off a
    // refresh behind the response, so wait for that step and look again.
    const age = Date.now() - (d.ts || 0);
    if (age < FRESH_MS) { log.push('round ' + i + ': fresh (' + Math.round(age / 1000) + 's old, ' + d.ranked + ' pools)'); return log; }
    log.push('round ' + i + ': stale (' + Math.round(age / 1000) + 's), refresh triggered');
    await sleep(SLEEP_MS);
  }
  log.push('gave up after ' + ROUNDS + ' rounds');
  return log;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(warm(env.SITE || 'https://lumoscore.com', []));
  },
  // Manual trigger, so the schedule can be proved to work without waiting for it. Reports what it did.
  async fetch(request, env) {
    const log = await warm(env.SITE || 'https://lumoscore.com', []);
    return new Response(log.join('\n') + '\n', { headers: { 'content-type': 'text/plain' } });
  },
};
