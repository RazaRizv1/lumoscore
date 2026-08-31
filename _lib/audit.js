// One line per admin action, written to D1.
//
// The panel is no longer single-user: two people curate assets, publish posts, approve listings and
// send refunds, and there was no way to tell afterwards who did which, or when. Refunds are the
// sharpest case -- money leaves, and the only trace was the transaction itself, with nothing tying it
// to the decision that caused it.
//
// TWO RULES THIS FILE EXISTS TO ENFORCE:
//
// 1. THE ACTOR IS NEVER TAKEN FROM THE REQUEST. It comes from adminActor(), which reads the payload
//    requireAdmin() stashed after verifying the signature. A log whose author field can be set by the
//    caller records whatever that caller wants it to.
//
// 2. LOGGING NEVER BREAKS THE ACTION. Every write here is wrapped and swallowed. If D1 is unavailable
//    the approval, the refund, the blog post still go through -- an audit trail that can take the
//    panel down with it is worse than no audit trail, because it turns a bookkeeping outage into an
//    operational one.
//
// Not called for reads. A log of who LOOKED at the dashboard is noise that buries the entries that
// matter, and the questions worth answering afterwards are all about changes.
import { adminActor } from './adminauth.js';

const DETAIL_MAX = 500;

// action: a dotted verb, 'listing.approve' / 'asset.curate' / 'blog.delete'.
// target: the thing acted on -- an asset id, a slug, a request id. May be ''.
// detail: a small object. Kept short on purpose: enough to answer "what changed", not a copy of the
//         content, which already lives in KV with its own history.
export async function audit(env, request, action, target, detail) {
  try {
    const db = env && env.ADMIN_DB;
    if (!db) return;
    const actor = adminActor(request) || 'unknown';
    let d = null;
    if (detail != null) {
      try {
        d = JSON.stringify(detail);
        if (d.length > DETAIL_MAX) d = d.slice(0, DETAIL_MAX - 1) + '…';
      } catch (e) { d = null; }
    }
    await db.prepare(
      'INSERT INTO admin_audit (at, actor, action, target, detail) VALUES (?1,?2,?3,?4,?5)'
    ).bind(Date.now(), actor, String(action || '').slice(0, 60),
      target ? String(target).slice(0, 120) : null, d).run();
  } catch (e) {
    // Deliberately silent. See rule 2 above.
  }
}
