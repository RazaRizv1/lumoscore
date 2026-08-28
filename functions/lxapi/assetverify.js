// Runs the SEP-1 handshake for one asset and reports what the issuer's own domain says about it.
//
// ADMIN ONLY, and not because the answer is secret. This endpoint makes an outbound fetch to a domain
// chosen by its caller, so left open it would be a fetch proxy wearing our origin. functions/ is shared
// with the PUBLIC projects, where nothing sits in front of it -- see the note in blog.js.
//
// It stores nothing. The admin panel calls it to decide what to show and what to save; assetmeta.js
// runs the same check itself when it writes, so a client cannot assert a tick it did not earn.
import { requireAdmin } from '../../_lib/adminauth.js';
import { verifyAsset } from '../../_lib/stellartoml.js';
import { GRANDFATHERED } from '../../_lib/verifiedseed.js';

const ASSET_RE = /^([A-Za-z0-9]{1,12})-(G[A-Z2-7]{55})$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const bad = await requireAdmin(request);
  if (bad) return bad;

  const u = new URL(request.url);
  const asset = u.searchParams.get('asset') || '';
  const m = ASSET_RE.exec(asset);
  if (!m) return json({ error: 'asset must be CODE-GISSUER' }, 400);

  const res = await verifyAsset(m[1], m[2]);

  // Measured, not assumed: USDC and EURC set home_domain = circle.com, and circle.com serves no
  // stellar.toml (404 -- the old one is at centre.io, which is not the home_domain). A strict
  // handshake therefore fails for the two most important assets on the list. Each entry in the seed
  // was checked by hand when it was added, so it keeps its tick and says so -- "grandfathered" is
  // shown differently from "handshake" precisely so the difference stays visible.
  if (!res.verified && GRANDFATHERED[m[1] + '|' + m[2]]) {
    res.verified = true;
    res.source = 'grandfathered';
    res.domain = res.domain || GRANDFATHERED[m[1] + '|' + m[2]];
    res.reason = 'checked by hand when added; the live handshake now fails: ' + res.reason;
  } else if (res.verified) {
    res.source = 'handshake';
  } else {
    res.source = 'none';
  }
  return json(res, 200);
}
