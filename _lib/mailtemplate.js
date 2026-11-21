// The HTML wrapper for mail we send: a branded header, the message, a quiet footer.
//
// Until now both /lxapi/reply and /lxapi/sendmail posted `text` only, so there was no HTML part at
// all and nothing for a logo to live in. Shared by both so the two cannot drift -- a divergence here
// shows up as one kind of mail looking unbranded and nobody noticing which.
//
// THE PLAIN-TEXT PART IS STILL SENT. It is what plain-text clients show, it is what screen readers
// read, and a message with no text alternative scores worse with spam filters -- which matters more
// for support mail than the header does.
//
// WRITTEN THE WAY EMAIL ACTUALLY RENDERS, not the way a page does:
//   - tables for layout, because Outlook lays out with Word's engine and ignores flex and grid
//   - every style inline, because several clients strip <head> and <style> entirely
//   - a light background with dark text, which is the one combination that holds everywhere; a dark
//     card inverts unpredictably under the clients that force their own dark mode
//   - the logo is a REMOTE image, because data: URIs are blocked by Gmail and most others, so the
//     message has to read correctly with images turned off -- which is the default in many clients
//     until the recipient allows them. Hence the wordmark beside it is TEXT, not part of the image:
//     with images blocked the brand name still shows.
// When the admin has formatted the message, the caller passes the ALREADY-SANITISED markup as
// opts.html and this uses it instead of escaping plain text. Styling is applied here rather than
// stored, because the inline styles exist only to survive mail clients.
import { styleForMail } from './mailbody.js';

const LOGO = 'https://lumoscore.com/assets/tokens/lumos.png';
const SITE = 'https://lumoscore.com';

// PNG, not SVG: neither Outlook nor Gmail renders SVG in mail. Drawn at 2x for a 20px slot and in
// the footer's own grey rather than each brand's colour, so two saturated logos do not shout louder
// than the message above them.
//
// THESE LIVE ON THE PUBLIC SITE and appear once it is next deployed to production; the admin project
// is behind Access, so an image hosted there is unreachable for a recipient. Until then each link
// still reads, because the alt text is the network's name and clients show alt for an image that
// does not load -- which is the same reason it is there for recipients who block images anyway.
// Kept, unused, for the swap back once the public site carries them (see the footer).
const ICON_LI = 'https://lumoscore.com/assets/email/linkedin.png';
const ICON_X = 'https://lumoscore.com/assets/email/x.png';
const URL_LI = 'https://www.linkedin.com/company/lumoscore/';
const URL_X = 'https://x.com/LumosCore';

// The site's own description, trimmed -- not new copy written for the footer. A second description
// invented here would be a second thing to keep true.
const BLURB = 'Multichain Web3 infrastructure — one interface for trading, liquidity, token '
  + 'issuance and cross-chain transfers, with custody left to you.';
// As the site prints it, on the legal pages.
const COMPANY = 'LumosCore OÜ · Estonia · 17336483';
const INK = '#16161a', MUTED = '#6b6b75', ACCENT = '#ea6a2c';
// Body copy is deliberately NOT the near-black of a heading. At 15.5px over white, #26262c reads
// softer over a long paragraph while still clearing contrast, and it leaves the title a step darker
// to be a title with.
const BODY_INK = '#26262c', FAINT = '#8a8a96';
// THE HEADER IS LIGHT, not the near-black the site uses. A dark slab is the right call on a web page,
// where it is one band among many; in an inbox it is the whole top of the thing and it reads heavy
// and generic. Light also survives the clients that force their own dark mode better -- those invert
// a white card predictably and a black band unpredictably, which is how a header ends up muddy.
//
// One warm family, so nothing looks borrowed: band and footer are the same tone and bookend the
// message, the card sits white between them, and the orange rule is then the strongest line in the
// mail rather than competing with a slab. Warm greys, because the brand's light ink is warm --
// a cool #fafafb footer under a warm band reads as two different templates.
const PAGE = '#f1f0ed', BAND = '#f7f6f4', LINE = '#e6e3dd', HAIR = '#eeebe6';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// The admin types this, so it is not hostile -- but it is still text going into markup, and a stray
// angle bracket would silently eat the rest of the paragraph. Escaped first, then newlines become
// breaks, so what was typed is what arrives.
function bodyHtml(text) {
  return esc(String(text || '').trim())
    .split(/\r?\n/)
    .map((line) => (line.trim() ? line : '&nbsp;'))
    .join('<br>');
}

export function mailHtml(text, opts) {
  const o = opts || {};
  const preheader = String(o.preheader || '').trim();
  // Both optional on purpose: every existing caller keeps working, and a caller that passes neither
  // gets the message in the same wrapper with no heading and no signature.
  const title = String(o.title || '').trim();
  const sender = o.sender && typeof o.sender === 'object' ? o.sender : null;
  return '<!doctype html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    // Tells a client that honours it that this mail is legible either way, which stops the more
    // aggressive dark-mode filters from inverting the header into mud.
    + '<meta name="color-scheme" content="light dark">'
    + '</head>'
    + '<body style="margin:0;padding:0;background:' + PAGE + ';">'
    // The preheader is the grey line a client prints beside the subject in the message list. Left
    // out, clients fill it with whatever text comes first -- here, the word "LumosCore" from the
    // header, which tells the reader nothing.
    + (preheader
      ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(preheader) + '</div>'
      : '')
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + PAGE + ';">'
    + '<tr><td align="center" style="padding:28px 12px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ' + LINE + ';">'

    // ---- header -------------------------------------------------------------------------------
    // The band used to be a tall black slab with a small mark adrift in it, which is most of why the
    // mail read as unfinished and generic. Now: light, shorter, and the space on the right carries
    // the one word that tells the reader what this is before they read a line of it. The logo is a
    // flame on transparency, so it sits on a light band without a box around it.
    + '<tr><td style="background:' + BAND + ';padding:17px 30px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="vertical-align:middle;padding-right:11px;width:30px;">'
    + '<img src="' + LOGO + '" width="30" height="30" alt="LumosCore"'
    + ' style="display:block;width:30px;height:30px;border:0;outline:none;text-decoration:none;">'
    + '</td>'
    + '<td style="vertical-align:middle;">'
    + '<span style="font:700 18px/1 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;'
    + 'color:' + INK + ';letter-spacing:-.2px;">LumosCore</span>'
    + '</td>'
    + '<td align="right" style="vertical-align:middle;">'
    + '<span style="font:600 10.5px/1 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;'
    + 'color:' + FAINT + ';letter-spacing:.14em;text-transform:uppercase;">Support</span>'
    + '</td></tr></table></td></tr>'
    + '<tr><td style="height:3px;background:' + ACCENT + ';font-size:0;line-height:0;">&nbsp;</td></tr>'

    // ---- message ------------------------------------------------------------------------------
    + '<tr><td style="padding:30px 30px 4px;font:400 15.5px/1.7 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + BODY_INK + ';">'
    // The subject again, as a heading. A mail that opens on a bare sentence gives the reader nothing
    // to land on; the client's own subject line is in a different place and a different size, and is
    // gone the moment they scroll. Replies deliberately pass no title -- the customer already has
    // the thread, and "Re: ..." set in 20px reads like a machine wrote it.
    + (title
      ? '<div style="font:600 20px/1.3 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;'
        + 'color:' + INK + ';letter-spacing:-.3px;margin:0 0 15px;">' + esc(title) + '</div>'
      : '')
    // A formatted body is markup the caller has already put through sanitiseMailHtml; a plain one is
    // escaped here as it always was. Never the caller's raw markup.
    + (o.html ? styleForMail(o.html) : bodyHtml(text))
    + '</td></tr>'

    // ---- signature ----------------------------------------------------------------------------
    // Support mail gets answered when it reads as a person writing, and ignored when it reads as a
    // system. The name is already in the From header, but a header is chrome -- few people look at
    // it. The reply line matters as much: Reply-To points at a real monitored address, and saying so
    // is what turns a read into a reply.
    + (sender
      ? '<tr><td style="padding:22px 30px 26px;">'
        + '<div style="height:1px;background:' + HAIR + ';font-size:0;line-height:0;margin:0 0 15px;">&nbsp;</div>'
        + '<div style="font:600 14px/1.45 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + INK + ';">'
        + esc(sender.name || 'LumosCore Support') + '</div>'
        + '<div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + MUTED + ';margin:2px 0 0;">'
        + 'LumosCore'
        + (sender.replyTo ? ' &middot; <a href="mailto:' + esc(sender.replyTo) + '" style="color:' + MUTED + ';text-decoration:underline;">' + esc(sender.replyTo) + '</a>' : '')
        + '</div>'
        + '<div style="font:400 13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + MUTED + ';margin:9px 0 0;">'
        + 'Just reply to this email &mdash; it comes straight back to us.</div>'
        + '</td></tr>'
      : '<tr><td style="padding:0 30px 26px;">&nbsp;</td></tr>')

    // ---- footer -------------------------------------------------------------------------------
    // A tinted band rather than a hairline: it ends the message instead of merely drawing a line
    // under it, and it keeps the legal text from reading as one more paragraph of the mail.
    + '<tr><td style="background:' + BAND + ';border-top:1px solid ' + LINE + ';padding:15px 30px 18px;'
    + 'font:400 12.5px/1.6 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + MUTED + ';">'
    + '<div style="margin:0 0 9px;">' + esc(BLURB) + '</div>'
    // TEXT, NOT ICONS -- for now. The icon files exist (assets/email/) but they live on the public
    // site, which has not been deployed since they were added, so every sent email showed two broken
    // images. A broken image is worse than no icon: it reads as a mail that failed to render.
    // Swapping back is the ICONS constant below plus a production deploy.
    + '<div style="font-size:12px;color:' + FAINT + ';">'
    + '<a href="' + URL_LI + '" style="color:' + FAINT + ';text-decoration:underline;">LinkedIn</a>'
    + ' &middot; '
    + '<a href="' + URL_X + '" style="color:' + FAINT + ';text-decoration:underline;">X</a>'
    + ' &middot; '
    + '<a href="' + SITE + '" style="color:' + FAINT + ';text-decoration:underline;">lumoscore.com</a>'
    + ' &middot; ' + esc(COMPANY)
    + '</div>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

export { LOGO as MAIL_LOGO };
