// Image uploads for the blog editor — cover images and pictures inside a post.
//
// STORED IN KV, NOT R2. R2 is the natural home for binaries, but it has to be switched on in the
// dashboard and Cloudflare wants billing details even for the free tier. CONTENT_KV is already bound to
// all three projects, holds values up to 25 MB, and costs nothing at this volume. If image storage ever
// outgrows it, the URLs stay the same and only this file changes.
//
// KV's free tier allows about 1,000 WRITES a day, which is thousands of blog images and nowhere near a
// constraint -- but reads are the thing that matters on the visitor path, and those are edge-cached and
// effectively free.
//
// THE ID IS A HASH OF THE BYTES. Uploading the same picture twice stores it once, and because the URL
// changes whenever the content does, images can be cached immutably and forever.
import { requireAdmin } from '../../_lib/adminauth.js';

const PREFIX = 'media:';
const MAX = 4 * 1024 * 1024;   // 4 MB: far above a well-exported 1200x630 cover, far below the KV cap

// SVG is deliberately absent. It is a document format that can carry script, and serving one from our
// own origin would run that script there. Raster only.
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function hash(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  const b = new Uint8Array(d);
  let s = '';
  for (let i = 0; i < 16; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

// Public read: these are pictures on a public blog.
export async function onRequestGet({ request, env }) {
  const kv = env && env.CONTENT_KV;
  if (!kv) return new Response('not found', { status: 404 });
  const id = (new URL(request.url).searchParams.get('id') || '').replace(/[^a-z0-9.]/g, '');
  if (!id) return new Response('bad id', { status: 400 });

  const key = PREFIX + id;
  const got = await kv.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!got || !got.value) return new Response('not found', { status: 404 });
  const meta = got.metadata || {};
  return new Response(got.value, {
    headers: {
      'content-type': meta.type || 'application/octet-stream',
      // Safe to cache forever: the id is a hash of the bytes, so a different image is a different URL.
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequestPost({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;
  const kv = env && env.CONTENT_KV;
  if (!kv) return json({ error: 'no CONTENT_KV binding' }, 500);

  let file;
  try {
    const form = await request.formData();
    file = form.get('file');
  } catch (_) { return json({ error: 'expected a file upload' }, 400); }
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'no file' }, 400);

  const type = String(file.type || '').toLowerCase();
  const ext = TYPES[type];
  if (!ext) {
    return json({ error: 'unsupported type', message: (type || 'unknown') + ' — use JPEG, PNG, WebP, GIF or AVIF' }, 400);
  }
  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX) {
    return json({ error: 'too large', message: Math.round(buf.byteLength / 1024) + 'KB — the limit is 4MB' }, 400);
  }
  if (!buf.byteLength) return json({ error: 'empty file' }, 400);

  const id = (await hash(buf)) + '.' + ext;
  await kv.put(PREFIX + id, buf, { metadata: { type, size: buf.byteLength, at: Date.now() } });

  // Relative, deliberately: the same path works on staging and production, and an absolute URL baked
  // into a post body would pin every image to whichever host happened to upload it.
  return json({ ok: true, id, url: '/lxapi/media?id=' + id, size: buf.byteLength, type }, 200);
}
