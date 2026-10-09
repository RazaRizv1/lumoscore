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
const INK = '#16161a', MUTED = '#6b6b75', ACCENT = '#ea6a2c', LINE = '#e6e6ea', DARK = '#0a0a0b';

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
  return '<!doctype html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    // Tells a client that honours it that this mail is legible either way, which stops the more
    // aggressive dark-mode filters from inverting the header into mud.
    + '<meta name="color-scheme" content="light dark">'
    + '</head>'
    + '<body style="margin:0;padding:0;background:#f4f4f6;">'
    // The preheader is the grey line a client prints beside the subject in the message list. Left
    // out, clients fill it with whatever text comes first -- here, the word "LumosCore" from the
    // header, which tells the reader nothing.
    + (preheader
      ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(preheader) + '</div>'
      : '')
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f6;">'
    + '<tr><td align="center" style="padding:28px 12px;">'
    + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ' + LINE + ';">'

    // ---- header -------------------------------------------------------------------------------
    + '<tr><td style="background:' + DARK + ';padding:20px 28px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td style="vertical-align:middle;padding-right:12px;">'
    + '<img src="' + LOGO + '" width="34" height="34" alt="LumosCore"'
    + ' style="display:block;width:34px;height:34px;border:0;outline:none;text-decoration:none;">'
    + '</td>'
    + '<td style="vertical-align:middle;">'
    + '<span style="font:700 19px/1 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;'
    + 'color:#f6f5f3;letter-spacing:-.2px;">LumosCore</span>'
    + '</td></tr></table></td></tr>'
    + '<tr><td style="height:3px;background:' + ACCENT + ';font-size:0;line-height:0;">&nbsp;</td></tr>'

    // ---- message ------------------------------------------------------------------------------
    + '<tr><td style="padding:28px;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + INK + ';">'
    + bodyHtml(text)
    + '</td></tr>'

    // ---- footer -------------------------------------------------------------------------------
    + '<tr><td style="padding:0 28px;"><div style="height:1px;background:' + LINE + ';font-size:0;line-height:0;">&nbsp;</div></td></tr>'
    + '<tr><td style="padding:16px 28px 24px;font:400 12.5px/1.6 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:' + MUTED + ';">'
    + '<div style="margin:0 0 13px;">' + esc(BLURB) + '</div>'
    // TEXT, NOT ICONS -- for now. The icon files exist (assets/email/) but they live on the public
    // site, which has not been deployed since they were added, so every sent email showed two broken
    // images. A broken image is worse than no icon: it reads as a mail that failed to render.
    // Swapping back is the ICONS constant below plus a production deploy.
    + '<div style="margin:0 0 13px;">'
    + '<a href="' + URL_LI + '" style="color:' + MUTED + ';text-decoration:underline;">LinkedIn</a>'
    + ' &middot; '
    + '<a href="' + URL_X + '" style="color:' + MUTED + ';text-decoration:underline;">X</a>'
    + '</div>'
    + esc(COMPANY) + ' &middot; <a href="' + SITE + '" style="color:' + MUTED + ';text-decoration:underline;">lumoscore.com</a>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';
}

export { LOGO as MAIL_LOGO };
