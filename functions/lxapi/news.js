// Cloudflare Pages Function — crypto headlines, Stellar first.
//
//   /lxapi/news            -> { items:[{title,link,source,ts,img}], ts, sources }
//   /lxapi/news?limit=12   -> at most 12 items (default 12, cap 24)
//
// WHY THIS IS A FUNCTION AND NOT A FETCH IN THE PAGE.
//
// None of these publishers send an access-control-allow-origin header on their feeds, so a browser
// cannot read them: the request goes out and the response is thrown away before any script sees it.
// That is not something a retry or a different parser fixes. Reading them from the edge, where CORS does
// not apply, is the only way to put them on the page at all -- and it means one cached fetch serves
// every visitor instead of each of them hitting five publishers.
//
// SOURCES. Five general crypto outlets that publish a standard RSS feed and cover Stellar when there is
// Stellar news, which is the shape asked for: not a Stellar-only wire (there is barely enough volume to
// fill a row most weeks), but credible crypto press ranked so anything Stellar surfaces first.
//
// A dead or slow feed cannot take the section down with it: they are fetched in parallel, each with its
// own failure caught, and whatever answered in time is what gets returned. The response says which
// sources actually contributed, so a feed that has quietly gone away is visible rather than silent.
const FEEDS = [
  { name: 'CoinDesk',     url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'Bitcoin.com',  url: 'https://news.bitcoin.com/feed/' },
  { name: 'CryptoSlate',  url: 'https://cryptoslate.com/feed/' },
  { name: 'U.Today',      url: 'https://u.today/rss' },
];

const TTL = 900;          // 15 min at the edge: news is not a price, and five feeds per visitor is rude
const FETCH_MS = 4500;    // a slow publisher must not hold the whole response
const DEFAULT_N = 12;
const MAX_N = 24;

// What counts as Stellar-relevant. Deliberately narrow: "XLM" as a word, not as a substring, or the
// project names. A loose match on "stellar" alone would promote every article calling something a
// "stellar performance", which is exactly the sort of thing that makes a curated row look automated.
const STELLAR = /\b(xlm|stellar lumens|stellar network|stellar development foundation|sdf|soroban|lumens)\b/i;
const STELLAR_WORD = /\bstellar\b/i;

function json(body, status, ttl) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=' + ttl,
      'access-control-allow-origin': '*',
    },
  });
}

// Minimal RSS/Atom reading. A real XML parser is not available in a Worker and pulling one in for five
// fields would be a lot of bytes for very little; these feeds are machine-generated and regular.
function tag(block, name) {
  const m = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i').exec(block);
  return m ? m[1] : '';
}
function unwrap(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// The image, from whichever of the four places a feed happens to put it.
function image(block) {
  let m = /<media:content[^>]+url=["']([^"']+)["']/i.exec(block)
       || /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block)
       || /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i.exec(block)
       || /<img[^>]+src=["']([^"']+)["']/i.exec(block);
  const u = m ? m[1] : '';
  // http:// images are dropped rather than served: the page is https, so a browser blocks them anyway
  // and the card would render a broken frame instead of falling back to no image.
  return /^https:\/\//.test(u) ? u : '';
}

function parse(xml, source) {
  const out = [];
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blocks = xml.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const b = raw.split(isAtom ? /<\/entry>/i : /<\/item>/i)[0];
    const title = unwrap(tag(b, 'title'));
    let link = unwrap(tag(b, 'link'));
    if (!link) { const m = /<link[^>]+href=["']([^"']+)["']/i.exec(b); link = m ? m[1] : ''; }
    if (!title || !/^https?:\/\//.test(link)) continue;
    const when = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const ts = Date.parse(unwrap(when)) || 0;
    out.push({ title, link, source, ts, img: image(b) });
    if (out.length >= 20) break;   // no feed needs to contribute more than this
  }
  return out;
}

async function pull(feed) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), FETCH_MS);
    const r = await fetch(feed.url, {
      signal: ctl.signal,
      cf: { cacheTtl: TTL, cacheEverything: true },
      headers: { 'user-agent': 'LumosCore/1.0 (+https://lumoscore.com)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    clearTimeout(t);
    if (!r.ok) return [];
    return parse(await r.text(), feed.name);
  } catch (_) { return []; }
}

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  let n = parseInt(q.get('limit') || '', 10);
  if (!(n > 0)) n = DEFAULT_N;
  if (n > MAX_N) n = MAX_N;

  const results = await Promise.all(FEEDS.map(pull));
  let items = [].concat.apply([], results);

  // One story often runs on several outlets. Dedupe on the headline rather than the URL, which differs
  // per publisher, so the row does not show the same news three times under three mastheads.
  const seen = Object.create(null);
  items = items.filter((it) => {
    const k = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70);
    if (!k || seen[k]) return false;
    seen[k] = 1;
    return true;
  });

  // Stellar first, then newest. Two tiers rather than a score: an article ABOUT Stellar outranks a fresher
  // one that is not, and within each tier the most recent wins. A blended score would let a very fresh
  // Bitcoin headline outrank Stellar news from this morning, which is not what a Stellar app should show.
  const rank = (it) => {
    const hay = it.title;
    if (STELLAR.test(hay)) return 2;
    if (STELLAR_WORD.test(hay)) return 1;   // "Stellar" alone: probably relevant, possibly an adjective
    return 0;
  };
  items.sort((a, b) => (rank(b) - rank(a)) || (b.ts - a.ts));

  const used = {};
  for (const it of items.slice(0, n)) used[it.source] = 1;

  return json({
    items: items.slice(0, n),
    stellar: items.slice(0, n).filter((i) => rank(i) > 0).length,
    sources: Object.keys(used),
    ts: Date.now(),
  }, 200, TTL);
}
