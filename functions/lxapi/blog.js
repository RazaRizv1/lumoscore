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

const IDX = 'blog:index';
const POST = 'blog:post:';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

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
    if (!post.published && !all) return json({ error: 'not found' }, 404, 0);
    return json({ post }, 200, all ? 0 : 120);
  }

  const idx = await readIndex(kv);
  const posts = all ? idx : idx.filter((p) => p && p.published);
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

  // The slug is the URL, so it is fixed at creation and never silently rewritten by an edit -- renaming
  // it later would break every link already shared to the post.
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
    body: String(b.body || ''),
    cover: String(b.cover || '').slice(0, 2000),      // a URL, or a gradient spec the page renders
    coverAlt: String(b.coverAlt || '').slice(0, 200),
    metaDescription: String(b.metaDescription || '').slice(0, 320),
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 12).map((t) => String(t).slice(0, 32)) : [],
    readMins: Math.max(1, Math.min(60, parseInt(b.readMins, 10) || 0)) || null,
    published: !!b.published,
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
    publishedAt: (b.published ? ((existing && existing.publishedAt) || now) : null),
  };

  await kv.put(POST + slug, JSON.stringify(post));

  // The index carries no body, so it stays small however long the posts get.
  const idx = await readIndex(kv);
  const summary = {
    slug: post.slug, title: post.title, category: post.category, excerpt: post.excerpt,
    cover: post.cover, tags: post.tags, readMins: post.readMins,
    published: post.published, createdAt: post.createdAt, updatedAt: post.updatedAt,
    publishedAt: post.publishedAt,
  };
  const next = idx.filter((p) => p && p.slug !== slug);
  next.unshift(summary);
  next.sort((x, y) => (y.publishedAt || y.createdAt || 0) - (x.publishedAt || x.createdAt || 0));
  await kv.put(IDX, JSON.stringify(next));

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
  return json({ ok: true }, 200, 0);
}
