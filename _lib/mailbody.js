// THE BODY OF AN OUTGOING SUPPORT MAIL, when the admin has formatted it.
//
// The compose box used to post plain text only, and mailtemplate's bodyHtml escaped it and turned
// newlines into <br>. That is still the path when no formatted body arrives, so nothing that worked
// before depends on anything here.
//
// WHY SANITISE WHAT AN ADMIN TYPED. Not because the admin is hostile -- because a contenteditable is
// not a document author. Browsers put their own markup in it: style attributes, font tags, classes,
// and whatever markup came along when something was PASTED in from a web page or another mail. Sent
// as-is that arrives looking broken in Outlook, or carries a tracking pixel from whatever it was
// copied out of. So the rule is an allowlist: a handful of tags, one attribute, nothing else.
//
// AND THE PLAIN-TEXT PART IS DERIVED HERE, from the same sanitised markup, rather than taken from the
// browser separately. Two independently produced halves drift -- an edit made after the text half was
// captured would go out formatted one way and plain another, and nobody proof-reads the half their
// own client does not show.

// Inline marks keep their tag; blocks are what produce line breaks in the text version.
const INLINE = { b: 1, strong: 1, i: 1, em: 1, u: 1, a: 1 };
const BLOCK = { p: 1, div: 1, ul: 1, ol: 1, li: 1, blockquote: 1 };
const VOID_ = { br: 1 };
const ALLOWED = Object.assign({}, INLINE, BLOCK, VOID_);

// Only http(s) and mailto. A javascript: or data: href in a mail is either a dead link or a trick,
// and neither belongs in something going out under the company name.
function safeHref(raw) {
  const v = String(raw || '').trim().replace(/[\u0000- ]/g, '');
  return /^(https?:\/\/|mailto:)/i.test(v) ? v : '';
}

function escText(s) {
  return String(s).replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,9}|#\d{1,6}|#[xX][0-9a-fA-F]{1,6});)/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A tag-level rewriter, not a parser: every <...> is consumed by the regex, so whatever is left over
// is text and cannot contain a tag. Unknown tags are DROPPED but their contents kept -- a <span> or a
// <font> around a sentence must not take the sentence with it.
export function sanitiseMailHtml(html) {
  const src = String(html == null ? '' : html)
    // Contents and all: a <script> or <style> that survived as text would be printed into the mail.
    .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const open = [];
  let out = '';
  let last = 0;
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out += escText(src.slice(last, m.index));
    last = re.lastIndex;
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (!ALLOWED[tag]) continue;

    if (VOID_[tag]) { if (!closing) out += '<br>'; continue; }

    if (closing) {
      // Close only a tag we actually opened, and unwind anything left open inside it, so a stray
      // </b> from a paste cannot close something it never opened.
      const at = open.lastIndexOf(tag);
      if (at < 0) continue;
      for (let i = open.length - 1; i >= at; i--) out += '</' + open[i] + '>';
      open.length = at;
      continue;
    }

    if (open.length > 24) continue;              // paste bombs: depth is never legitimately this deep
    if (tag === 'a') {
      const hm = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[2] || '');
      const href = safeHref(hm ? (hm[2] != null ? hm[2] : (hm[3] != null ? hm[3] : hm[4])) : '');
      if (!href) continue;                        // a link to nowhere is just text
      out += '<a href="' + href.replace(/"/g, '&quot;') + '">';
      open.push('a');
      continue;
    }
    out += '<' + tag + '>';
    open.push(tag);
  }
  out += escText(src.slice(last));
  for (let i = open.length - 1; i >= 0; i--) out += '</' + open[i] + '>';

  // An editor that has been emptied leaves <p><br></p> behind; that is not a message.
  return /(?:[^\s<>&]|&[a-zA-Z#0-9]+;)/.test(out.replace(/<[^>]*>/g, '')) ? out.trim() : '';
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#160': ' ' };
function unesc(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name) => {
    const k = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ENT, k)) return ENT[k];
    if (k[0] === '#') {
      const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return whole;
  });
}

// The plain-text alternative. Bullets become "- " because a list read as one run-on line is the most
// common way a text/plain part reads badly, and a link's address is spelled out because a plain-text
// reader cannot click the words.
export function mailHtmlToText(html) {
  let s = String(html == null ? '' : html);
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (whole, href, inner) => {
    const label = inner.replace(/<[^>]*>/g, '').trim();
    const addr = unesc(href).trim();
    if (!label) return addr;
    return label === addr ? label : (label + ' (' + addr + ')');
  });
  s = s.replace(/<br\s*\/?>/gi, '\n')
    // The opening <li> is what starts the line; </li> must NOT also break, or every bullet arrives
    // with a blank line under it.
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li\s*>/gi, '')
    .replace(/<\/(p|div|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<(p|div|ul|ol|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return unesc(s)
    .replace(/ /g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Mail clients drop <head> and <style>, so the look has to ride on each tag. Applied when the mail is
// built, not when it is stored, so what is kept in the database stays plain markup.
const STYLE = {
  p: 'margin:0 0 12px;',
  div: 'margin:0 0 12px;',
  ul: 'margin:0 0 12px;padding-left:22px;',
  ol: 'margin:0 0 12px;padding-left:22px;',
  li: 'margin:0 0 4px;',
  blockquote: 'margin:0 0 12px;padding:2px 0 2px 14px;border-left:3px solid #e6e6ea;color:#50505a;',
  a: 'color:#ea6a2c;text-decoration:underline;',
};
export function styleForMail(html) {
  return String(html == null ? '' : html).replace(/<([a-z]+)((?:\s[^>]*)?)>/gi, (whole, tag, rest) => {
    const s = STYLE[String(tag).toLowerCase()];
    return s ? '<' + tag + rest + ' style="' + s + '">' : whole;
  });
}
