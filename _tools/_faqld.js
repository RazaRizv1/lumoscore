// AEO / GEO — FAQPage structured data for /faq, BUILT FROM THAT PAGE'S OWN VISIBLE Q&A.
//
// THE GAP THIS CLOSES. /faq carries 49 real questions with real answers and had no structured data at
// all -- measured in the container: zero ld+json blocks. Meanwhile /wallet, a wallet-gated page that
// was just set to noindex, carried a full FAQPage. The site's one FAQ rich-result opportunity was
// sitting on the single page that must never appear in a search result, and absent from the page
// written to answer questions.
//
// _faq.js could not fix this. It injects its own authored Q&A per product page from a FAQ table keyed
// on the page name, and /faq (docs-faq) has no entry -- correctly, because its questions are written
// in the docs page itself, not in that table. Adding one would have printed a SECOND, different FAQ
// section onto a page that already has 49 questions.
//
// SO THE SCHEMA IS DERIVED, NOT AUTHORED, and that is the whole design. Google requires FAQPage markup
// to match content visible on the page; markup that answers questions the page does not ask is a
// structured-data violation and can earn a manual action. Reading the page's own <details> elements
// makes disagreement impossible: if an answer is edited, the schema changes with it on the next run,
// and a question that is deleted cannot linger in the markup.
//
// Collapsed answers are fine. These sit inside <details>, so they are shut until clicked, and Google
// documents FAQPage content behind an expander as supported.
//
// Idempotent: strips its own script by id before writing, like every other pass here.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const ID = 'lx-faqld';
const PAGE = /^lumoscore-docs-faq(-dark|-light|-mobile)?\.html$/;

// Entity decoding, limited to what esc() in the sibling tools produces plus the few the design uses.
// &amp; LAST on the way out would double-decode (&amp;lt; -> <), so it is handled first by ordering
// the pairs with it at the front and never re-scanning the result.
function decode(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '&') { out += s[i]; continue; }
    const semi = s.indexOf(';', i);
    if (semi < 0 || semi - i > 8) { out += s[i]; continue; }
    const ent = s.slice(i, semi + 1);
    const map = {
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
      '&apos;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–',
      '&rsquo;': '’', '&lsquo;': '‘', '&hellip;': '…',
      '&ldquo;': '“', '&rdquo;': '”',
    };
    if (map[ent] === undefined) { out += s[i]; continue; }
    out += map[ent];
    i = semi;
  }
  return out;
}

// Visible text of a fragment: drop tags, collapse whitespace, decode entities. Anything scripted or
// styled is removed first so a <style> or <script> inside an answer cannot leak into the schema.
function text(frag) {
  return decode(
    frag.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

// Every <details class="dc-qa"> on the page, as [question, answer].
//
// The <summary> is the question and .dc-qa-a is the answer. An entry missing either is SKIPPED rather
// than guessed at: a Question with an empty acceptedAnswer is invalid structured data, and emitting
// one would invalidate the whole block for the sake of a row nobody can see.
function pairs(html) {
  const out = [];
  const re = /<details[^>]*class="[^"]*\bdc-qa\b[^"]*"[^>]*>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(html))) {
    const inner = m[1];
    const sum = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(inner);
    const ans = /<div[^>]*class="[^"]*\bdc-qa-a\b[^"]*"[^>]*>([\s\S]*)/.exec(inner);
    if (!sum || !ans) continue;
    const q = text(sum[1]);
    const a = text(ans[1]);
    if (!q || !a) continue;
    out.push([q, a]);
  }
  return out;
}

let files = 0, pages = 0, total = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  files++;

  for (const key of Object.keys(json)) {
    if (typeof json[key] !== 'string') continue;
    if (!PAGE.test(key)) continue;
    let h = json[key];

    // idempotent
    h = h.replace(new RegExp('<script type="application/ld\\+json" id="' + ID + '">[\\s\\S]*?</script>', 'g'), '');

    const qa = pairs(h);
    if (!qa.length) {
      console.error('  ! ' + key + ': no <details class="dc-qa"> found — nothing emitted');
      json[key] = h;
      continue;
    }

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: qa.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    };

    // < for every "<" in the payload, the same guard _faq.js uses: an answer containing "</" would
    // otherwise close the surrounding script element when the page is parsed.
    const script = '<script type="application/ld+json" id="' + ID + '">'
      + JSON.stringify(ld).split('<').join(B + 'u003c') + '</scr' + 'ipt>';

    const bi = h.lastIndexOf('</' + 'body>');
    if (bi < 0) { console.error('  ' + key + ': no closing body — skipped'); json[key] = h; continue; }
    json[key] = h.slice(0, bi) + script + h.slice(bi);
    pages++;
    total += qa.length;
  }

  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}

console.log('faq ld: FAQPage on ' + pages + ' page key(s) across ' + files + ' container(s); '
  + total + ' question(s) total');
if (!pages) console.error('  ! nothing emitted — did the FAQ page key or .dc-qa markup change?');
