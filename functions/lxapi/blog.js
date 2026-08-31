// Blog storage. Public reads, admin-only writes.
//
// READS are open and cached: the public /blog index and article pages fetch from here, so this is on
// the visitor path and has to be cheap.
//
// WRITES go through requireAdmin(), which checks both that the request arrived on the admin hostname
// AND that it carries a Cloudflare Access JWT that verifies against our team's keys. This matters more
// than it looks: functions/ is shared across all three Pages projects, so without that gate this file
// would be a world-writable endpoint on lumoscore.com.
//
// SHAPE. Two kinds of key, because the index is read on every visit to /blog and a post body is not:
//   blog:index        -> array of summaries, newest first. One read renders the whole index.
//   blog:post:<slug>  -> the full record including the body.
// Keeping bodies out of the index is what stops the index growing into a megabyte payload that every
// visitor downloads to render six cards.
import { requireAdmin } from '../../_lib/adminauth.js';
import { audit } from '../../_lib/audit.js';

const IDX = 'blog:index';
const POST = 'blog:post:';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

// THE ALLOWLIST, SERVER-SIDE.
//
// It used to live only in the admin browser — the editor cleaned the contenteditable before saving and
// this endpoint stored whatever arrived. That was survivable while the body was only ever written back
// with innerHTML, which does not execute a <script>. It stopped being survivable when the middleware
// began injecting the body into the page server-side, where the markup is parsed for real and a script
// would run. So the cleaning happens at the boundary that actually is one.
//
// HTMLRewriter rather than a regex, because this has to be right: it is the same parser the edge uses
// on real pages, so it sees the markup the way a browser will rather than the way a pattern hopes to.
const BODY_OK = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em',
  'br', 'b', 'i', 'img', 'figure', 'figcaption']);
// Removed WITH their contents. Everything else off the allowlist is unwrapped instead, so a stray
// <div> loses the tag and keeps the sentence inside it.
const BODY_DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template',
  'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'link', 'meta', 'base']);
const ATTR_OK = { a: ['href', 'rel', 'target'], img: ['src', 'alt', 'width', 'height'] };

function safeHref(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (s.charAt(0) === '/' || s.charAt(0) === '#') return true;         // our own pages, anchors
  const lc = s.toLowerCase();
  return lc.indexOf('https://') === 0 || lc.indexOf('http://') === 0 || lc.indexOf('mailto:') === 0;
}

async function sanitiseBody(raw) {
  const html = String(raw == null ? '' : raw);
  if (!html) return '';
  try {
    const out = new HTMLRewriter().on('*', {
      element(el) {
        const tag = String(el.tagName || '').toLowerCase();
        if (BODY_DROP.has(tag)) { el.remove(); return; }
        if (!BODY_OK.has(tag)) { el.removeAndKeepContent(); return; }
        // Collect first: removing while iterating the attribute list is not safe to rely on.
        const names = [];
        for (const pair of el.attributes) names.push(pair[0]);
        const keep = ATTR_OK[tag] || [];
        for (const n of names) {
          if (keep.indexOf(String(n).toLowerCase()) < 0) el.removeAttribute(n);
        }
        // javascript: and data: are the reason an allowlist of TAGS alone is not enough.
        if (tag === 'a' && !safeHref(el.getAttribute('href'))) el.removeAttribute('href');
        if (tag === 'img' && !safeHref(el.getAttribute('src'))) el.remove();
      },
    }).transform(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    return await out.text();
  } catch (e) {
    // A body that cannot be cleaned is not stored raw. Losing the markup is recoverable; storing
    // something unparseable and then injecting it into every reader's page is not.
    return html.replace(/<[^>]*>/g, '');
  }
}

function json(body, status, ttl) {
  const h = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'cache-control': ttl ? ('public, max-age=' + ttl) : 'no-store',
  };
  return new Response(JSON.stringify(body), { status, headers: h });
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function isLive(p) {
  if (!p || !p.published) return false;
  return !p.publishAt || p.publishAt <= Date.now();
}

async function readIndex(kv) {
  try { return (await kv.get(IDX, 'json')) || []; } catch (_) { return []; }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  // No binding is reported honestly rather than as an empty blog: "nothing published yet" and
  // "storage is unreachable" are different states and the page renders them differently.
  if (!kv) return json({ posts: [], reason: 'no kv' }, 200, 30);

  const u = new URL(request.url);
  const slug = u.searchParams.get('slug') || '';
  const all = u.searchParams.get('all') === '1';   // admin listing wants drafts too

  if (slug) {
    if (!SLUG_RE.test(slug)) return json({ error: 'bad slug' }, 400, 0);
    let post = null;
    try { post = await kv.get(POST + slug, 'json'); } catch (_) {}
    if (!post) return json({ error: 'not found' }, 404, 0);
    if (!isLive(post) && !all) return json({ error: 'not found' }, 404, 0);
    return json({ post }, 200, all ? 0 : 120);
  }

  const idx = await readIndex(kv);
  const posts = all ? idx : idx.filter(isLive);
  return json({ posts }, 200, all ? 0 : 120);
}

export async function onRequestPut({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no kv binding' }, 500, 0);

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400, 0); }

  const title = String((b && b.title) || '').trim();
  if (!title) return json({ error: 'title is required' }, 400, 0);

  // The slug is the URL. It CAN be changed after publishing -- the editor warns that the old link
  // stops working -- and a change moves the post rather than copying it (see prevSlug below).
  const slug = SLUG_RE.test(String(b.slug || '')) ? String(b.slug) : slugify(title);
  if (!SLUG_RE.test(slug)) return json({ error: 'could not derive a slug from that title' }, 400, 0);

  const now = Date.now();
  let existing = null;
  try { existing = await kv.get(POST + slug, 'json'); } catch (_) {}

  const post = {
    slug,
    title,
    category: String(b.category || '').slice(0, 40),
    excerpt: String(b.excerpt || '').slice(0, 400),
    body: await sanitiseBody(b.body),
    cover: String(b.cover || '').slice(0, 2000),      // a URL, or a gradient spec the page renders
    coverAlt: String(b.coverAlt || '').slice(0, 200),
    metaDescription: String(b.metaDescription || '').slice(0, 320),
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 12).map((t) => String(t).slice(0, 32)) : [],
    readMins: Math.max(1, Math.min(60, parseInt(b.readMins, 10) || 0)) || null,
    published: !!b.published,
    // The moment it becomes public. Null means "as soon as it is published".
    publishAt: (function(){ var t = Number(b.publishAt); return (isFinite(t) && t > 0) ? t : null; })(),
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
    publishedAt: (b.published ? ((existing && existing.publishedAt) || Number(b.publishAt) || now) : null),
  };

  await kv.put(POST + slug, JSON.stringify(post));

  // A rename MOVES the post. Without this the old slug would keep serving a stale copy of the same
  // article and the index would list it twice.
  const prev = String((b && b.prevSlug) || "");
  const renamed = prev && SLUG_RE.test(prev) && prev !== slug;
  if (renamed) { try { await kv.delete(POST + prev); } catch (_) {} }

  // The index carries no body, so it stays small however long the posts get.
  const idx = await readIndex(kv);
  const summary = {
    slug: post.slug, title: post.title, category: post.category, excerpt: post.excerpt,
    cover: post.cover, tags: post.tags, readMins: post.readMins, publishAt: post.publishAt,
    published: post.published, createdAt: post.createdAt, updatedAt: post.updatedAt,
    publishedAt: post.publishedAt,
  };
  const next = idx.filter((p) => p && p.slug !== slug && (!renamed || p.slug !== prev));
  next.unshift(summary);
  next.sort((x, y) => (y.publishedAt || y.createdAt || 0) - (x.publishedAt || x.createdAt || 0));
  await kv.put(IDX, JSON.stringify(next));

  await audit(env, request, post && post.live ? 'blog.publish' : 'blog.save', post && post.slug, { title: post && post.title });
  return json({ ok: true, post }, 200, 0);
}

export async function onRequestDelete({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no kv binding' }, 500, 0);

  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!SLUG_RE.test(slug)) return json({ error: 'bad slug' }, 400, 0);

  await kv.delete(POST + slug);
  const idx = await readIndex(kv);
  await kv.put(IDX, JSON.stringify(idx.filter((p) => p && p.slug !== slug)));
  await audit(env, request, 'blog.delete', slug, null);
  return json({ ok: true }, 200, 0);
}
