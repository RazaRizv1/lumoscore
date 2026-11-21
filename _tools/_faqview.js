// FAQ presentation layer — the markup, the stylesheet and the behaviour, in ONE place.
//
// WHY THIS FILE EXISTS. The FAQ ships on 34 page keys per chain, and the two chains hold DIFFERENT
// copy: Stellar's answers are authored in _faq.js, the XRPL fork's were written for the XRP Ledger
// and live baked in its own containers. Before this file the look was emitted twice -- once by
// Stellar's _faq.js and once by the fork's _xrplfaqcard.js, which carried a hand-copied snapshot of
// Stellar's stylesheet and had already fallen a revision behind. Two emitters for one design is the
// same trap the fee banner hit. So: ONE renderer, TWO feeds. Stellar feeds it a question table, XRPL
// feeds it the questions already in its own pages, and neither can drift from the other's look.
//
// This file is byte-identical in C:/LumosCore/_tools and C:/LumosCore-XRPL/_tools. Change one, copy
// it to the other, and re-run both transforms -- `fc` or `diff` the two paths to prove it.
//
// ---------------------------------------------------------------------------------------------
// THE DESIGN (RAZA, 2026-11-13: "i want to make it very appealing and attractive")
//
// What was wrong was not the styling, it was the FORM. The old block was an auto-fit grid of cards,
// `minmax(320px,1fr)`, which resolves to three columns at desktop width. The question counts are 3,
// 4, 5, 6, 7 and 8 -- so 26 of the 34 pages ended on a ragged half-empty row, and every answer was
// open at once, which on the landing page is a wall of 49.
//
// It is now a two-column section: a sticky intro rail on the left, a single-column accordion on the
// right, one row open at a time and the first row open on arrival. Nothing is hidden from a crawler
// -- every answer stays in the DOM and the FAQPage JSON-LD is unchanged -- but a reader sees a list
// of questions instead of a wall of prose.
//
// ---------------------------------------------------------------------------------------------
// THREE CONSTRAINTS THAT SHAPED THE CODE. Each one is a trap this build has already paid for.
//
// 1. SPECIFICITY, NOT SOURCE ORDER. `lx-faq-css` is NOT the last stylesheet on the page. Measured on
//    the built landing page: lx-faq-css at byte 779306, lx-landingrefine at 800541 -- after it. Three
//    landing transforms (_landingsections, _landingpolish, _landingrefine) restyle `.lx-faq h2`,
//    `.lx-faq-q`, `.lx-faq-a` and `.lx-faqtabs`, and none of them can be re-run on its own any more
//    (_landingsections injects a header _whylumos.js later replaces). So every rule here that touches
//    a name those sheets also touch is scoped to at least (0,2,0) and wins wherever it lands.
//
// 2. THE PANE CLASS IS RENAMED, `lx-faqpane` -> `lx-faqgrp`. Those same landing sheets paint
//    `.lx-faq .lx-faqpane > div` as a bordered, padded, hover-lifting card with an accent rule above
//    it. In the old markup that selector hit the cards, which is what it was written for. In the new
//    markup it would hit every accordion ROW. Renaming the pane makes the selector match nothing,
//    which retires those rules without editing a transform that can no longer be run.
//
// 3. THE COLLAPSE RULES GO IN THE HEAD. `lx-faq-css` is appended before `</body>`, roughly 500KB
//    after the markup it governs -- the distance class, three times fixed on this build already. For
//    a grid of open cards that cost a reflow; for an accordion it means every answer renders OPEN and
//    then snaps shut in front of the reader. So the handful of rules that decide what is collapsed
//    live in their own `lx-faq-head` block in `<head>`, and only the look stays at the end of the
//    body. The head block uses class names (`lx-faq-ans`, `lx-faqgrp`) that no other sheet targets,
//    so being the earliest sheet on the page costs it nothing.
//
// A fourth, inherited from the old file and still true: THE CHEVRON IS AN SVG, NOT A CHARACTER. The
// site's logo healer repaints any element holding 1-5 characters into a ticker logo, which is why
// the old "?" badge was a CSS `content` and never a <span>. The same applies to the count kicker, so
// it reads "12 questions" rather than a bare number, and both carry the healer's opt-out attributes.

const SUPPORT_DEFAULT = '/support';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').split(String.fromCharCode(39)).join('&#39;');
}

// ---------------------------------------------------------------------------------------------
// HEAD BLOCK -- collapse-critical only. See constraint 3 above.
const HEAD = '<style id="lx-faq-head">'
  // THE ICONS' SIZE IS FIRST-PAINT CRITICAL TOO (RAZA 2026-11-18, "flash bug when page is refreshed"): until
  // lx-faq-css lands ~500KB later, the 'Still have a question?' arrow and the row chevrons are unsized SVGs
  // and fill the column -- a page-tall purple arrow (purple = the unstyled visited-link colour). Same values
  // as the look sheet, so the settled page does not change.
  + '.lx-faq .lx-faq-ask{color:var(--accent);text-decoration:none}'
  + '.lx-faq .lx-faq-ask svg{width:15px;height:15px}'
  + '.lx-faq .lx-faq-ic svg{width:13px;height:13px;display:block}'
  + '.lx-faq-ans{display:grid;grid-template-rows:0fr;'
  + 'transition:grid-template-rows .28s cubic-bezier(.4,0,.2,1)}'
  + '.lx-faq-item.is-open>.lx-faq-ans{grid-template-rows:1fr}'
  // The inner wrapper is what actually clips. A 0fr row with visible overflow shows everything.
  + '.lx-faq-ans>div{overflow:hidden}'
  // Panes: two classes on purpose, the same reason the old file gave -- it must beat whatever the
  // list class resolves to regardless of which sheet lands first.
  + '.lx-faq .lx-faqgrp{display:none}'
  + '.lx-faq .lx-faqgrp.is-on{display:block}'
  + '@media(prefers-reduced-motion:reduce){.lx-faq-ans{transition:none}}'
  + '</st' + 'yle>';

// ---------------------------------------------------------------------------------------------
// BODY BLOCK -- the look.
const CSS = '<style id="lx-faq-css">'
  + '.lx-faq{max-width:1180px;margin:8px auto 0;padding:52px 24px 60px;'
  + 'border-top:1px solid var(--border)}'
  + '.lx-faq-wrap{display:grid;grid-template-columns:minmax(0,290px) minmax(0,1fr);'
  + 'gap:clamp(30px,5vw,76px);align-items:start}'

  // ---- left rail. Sticky so the heading stays with the list on a long group.
  + '.lx-faq .lx-faq-side{position:sticky;top:24px;min-width:0;text-align:left}'
  + '.lx-faq .lx-faq-kicker{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;'
  + 'font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 12px}'
  + '.lx-faq .lx-faq-side h2{font-size:clamp(25px,2.6vw,34px);font-weight:800;letter-spacing:-.025em;'
  + 'line-height:1.14;color:var(--text);text-align:left;text-wrap:balance;margin:0 0 12px}'
  + '.lx-faq .lx-faq-lede{font-size:15px;line-height:1.6;color:var(--text-muted);margin:0 0 20px;'
  + 'max-width:34ch}'
  + '.lx-faq .lx-faq-ask{display:inline-flex;align-items:center;gap:8px;font-size:14.5px;'
  + 'font-weight:700;color:var(--accent);text-decoration:none}'
  + '.lx-faq .lx-faq-ask svg{width:15px;height:15px;transition:transform .16s ease}'
  + '.lx-faq .lx-faq-ask:hover svg{transform:translateX(3px)}'

  // ---- right column
  + '.lx-faq .lx-faq-main{min-width:0}'
  + '.lx-faq .lx-faq-list{border-top:1px solid var(--border)}'
  // The reset half of this rule matters: on the landing page these rows inherit nothing from the
  // retired card sheets, but a stale build could still carry one, and a row must never be a card.
  + '.lx-faq .lx-faq-item{border-bottom:1px solid var(--border);border-radius:0;background:none;'
  + 'padding:0;box-shadow:none;transform:none}'
  + '.lx-faq .lx-faq-h{margin:0;font:inherit}'
  + '.lx-faq .lx-faq-q{width:100%;display:flex;align-items:flex-start;justify-content:space-between;'
  + 'gap:18px;appearance:none;-webkit-appearance:none;background:transparent;border:0;cursor:pointer;'
  + 'text-align:left;font-family:inherit;font-size:16.5px;font-weight:700;line-height:1.46;'
  + 'letter-spacing:-.01em;color:var(--text);margin:0;padding:19px 0;transition:color .15s ease}'
  + '.lx-faq .lx-faq-q:hover{color:var(--accent)}'
  + '.lx-faq .lx-faq-q:focus-visible{outline:2px solid var(--accent);outline-offset:-3px;'
  + 'border-radius:8px}'
  + '.lx-faq .lx-faq-ic{flex:0 0 auto;width:26px;height:26px;margin-top:1px;border-radius:50%;'
  + 'display:flex;align-items:center;justify-content:center;background:var(--surface-2);'
  + 'color:var(--text-soft);transition:transform .26s cubic-bezier(.4,0,.2,1),'
  + 'background .16s ease,color .16s ease}'
  + '.lx-faq .lx-faq-ic svg{width:13px;height:13px;display:block}'
  + '.lx-faq .lx-faq-q:hover .lx-faq-ic{background:rgba(234,106,44,.14);color:var(--accent)}'
  + '.lx-faq .lx-faq-item.is-open .lx-faq-ic{transform:rotate(180deg);background:var(--accent);'
  + 'color:#fff}'
  + '.lx-faq .lx-faq-item.is-open .lx-faq-q{color:var(--text)}'
  + '.lx-faq .lx-faq-a{margin:0;padding:0 44px 23px 0;font-size:15px;line-height:1.72;'
  + 'color:var(--text-muted);max-width:72ch}'

  // ---- the landing page's category pills, now left-aligned above the list rather than centred
  // across the page. (0,3,0) beats both `.lx-faqtabs` (0,1,0) and `section.lx-faq .lx-faqtabs`
  // (0,2,1) from the landing sheets -- see constraint 1.
  + '.lx-faq .lx-faq-main .lx-faqtabs{justify-content:flex-start;margin:0 0 22px}'
  + '.lx-faq .lx-faqtabs{gap:10px}'
  + '.lx-faq .lx-faqtab{padding:13px 19px}'
  + '@media(max-width:900px){.lx-faq .lx-faqtab{padding:11px 16px}}'
  + '@media(max-width:640px){.lx-faq .lx-faqtab{padding:9px 14px}}'

  // ---- narrow: the rail stops being a rail and becomes a header.
  + '@media(max-width:980px){.lx-faq-wrap{grid-template-columns:1fr;gap:26px}'
  + '.lx-faq .lx-faq-side{position:static}.lx-faq .lx-faq-lede{max-width:60ch}}'
  + '@media(max-width:640px){.lx-faq{padding:34px 16px 40px}'
  + '.lx-faq .lx-faq-side h2{font-size:23px}'
  + '.lx-faq .lx-faq-q{font-size:15.5px;padding:17px 0;gap:14px}'
  + '.lx-faq .lx-faq-a{padding:0 6px 20px 0;font-size:14.5px}'
  + '.lx-faq .lx-faq-ic{width:24px;height:24px}}'
  + '</st' + 'yle>';

// THE WHOLE LOOK RIDES IN THE HEAD TOO (RAZA 2026-11-18: "fix this flash bug on pools main page ... when the page
// is refreshed"). With only the collapse rules up there, every page showed the FAQ as raw browser defaults --
// 18px serif-less headings, bordered grey buttons, a full-width paragraph -- until lx-faq-css landed ~500KB
// later. Constraint 1 above is why this is safe: every look rule wins on SPECIFICITY, not order, so an early
// copy styles the first paint and the late copy (still emitted, still pinned) settles it exactly as before.
const LOOK = CSS.slice(CSS.indexOf('>') + 1, CSS.lastIndexOf('</st'));
const HEAD_ALL = HEAD.slice(0, HEAD.lastIndexOf('</st')) + LOOK + '</st' + 'yle>';

// ---------------------------------------------------------------------------------------------
// The tab strip for the landing page. Unchanged from the old file except that the two pane
// `display` rules moved to HEAD (and switched grid -> block with the pane rename).
const TABCSS = '<style id="lx-faqtabs-css">'
  + '.lx-faqtabs{display:flex;flex-wrap:wrap;gap:9px;margin:0 0 28px;justify-content:center}'
  + '.lx-faqtab{appearance:none;cursor:pointer;font:inherit;font-size:14px;font-weight:700;'
  + 'color:var(--text-soft);background:var(--surface);border:1px solid var(--border);'
  + 'border-radius:999px;padding:9px 16px;display:inline-flex;align-items:center;gap:8px;'
  + 'transition:color .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}'
  + '.lx-faqtab:hover{color:var(--text);border-color:rgba(234,106,44,.5)}'
  + '.lx-faqtab span{font-size:12px;font-weight:600;color:var(--text-soft);'
  + 'background:var(--bg-elev,rgba(127,127,127,.14));border-radius:999px;padding:2px 8px;'
  + 'transition:color .16s ease,background .16s ease}'
  + '.lx-faqtab.is-on{color:#fff;border-color:transparent;'
  + 'background:linear-gradient(180deg,#f0813f,var(--accent));'
  + 'box-shadow:0 8px 22px -10px rgba(234,106,44,.9)}'
  + '.lx-faqtab.is-on span{color:#fff;background:rgba(255,255,255,.24)}'
  + '.lx-faqtab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}'
  + '@media (max-width:640px){.lx-faqtabs{gap:8px;margin-bottom:22px}'
  + '.lx-faqtab{font-size:13px;padding:9px 14px}}'
  + '</st' + 'yle>';

const TABJS = '<script id="lx-faqtabs-js">(function(){'
  + 'function go(root,id){'
  + 'var ts=root.querySelectorAll(".lx-faqtab"),ps=root.querySelectorAll(".lx-faqgrp"),i;'
  + 'for(i=0;i<ts.length;i++){var on=ts[i].getAttribute("data-lxfaq")===id;'
  + 'ts[i].classList.toggle("is-on",on);ts[i].setAttribute("aria-selected",on?"true":"false");}'
  + 'for(i=0;i<ps.length;i++){ps[i].classList.toggle("is-on",ps[i].getAttribute("data-lxfaqpane")===id);}'
  + '}'
  + 'if(window.__lxFaqTabs)return;window.__lxFaqTabs=1;'
  + 'document.addEventListener("click",function(e){'
  + 'var b=e.target&&e.target.closest?e.target.closest(".lx-faqtab"):null;if(!b)return;'
  + 'var root=b.closest(".lx-faq");if(!root)return;'
  + 'e.preventDefault();go(root,b.getAttribute("data-lxfaq"));'
  + '},false);'
  + '})();</scr' + 'ipt>';

// One row open at a time, scoped to the list the clicked row belongs to -- so on the landing page a
// row opening in the Trade group does not close one in a group the reader cannot even see.
// Delegated and bound once, like the tab handler, so a page that re-renders its own section keeps
// working and a second copy of this script is a no-op.
const ACCJS = '<script id="lx-faq-js">(function(){'
  + 'if(window.__lxFaqAcc)return;window.__lxFaqAcc=1;'
  + 'document.addEventListener("click",function(e){'
  + 'var b=e.target&&e.target.closest?e.target.closest(".lx-faq-q"):null;if(!b)return;'
  + 'var it=b.closest(".lx-faq-item");if(!it)return;'
  + 'var list=it.closest(".lx-faq-list");if(!list)return;'
  + 'e.preventDefault();'
  + 'var was=it.classList.contains("is-open");'
  + 'var rows=list.querySelectorAll(".lx-faq-item"),i,q;'
  + 'for(i=0;i<rows.length;i++){rows[i].classList.remove("is-open");'
  + 'q=rows[i].querySelector(".lx-faq-q");if(q)q.setAttribute("aria-expanded","false");}'
  + 'if(!was){it.classList.add("is-open");b.setAttribute("aria-expanded","true");}'
  + '},false);'
  + '})();</scr' + 'ipt>';

const CHEV = '<span class="lx-faq-ic" data-lxfixed="1" data-logoed="1" aria-hidden="true">'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" '
  + 'stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"></path></svg></span>';

const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M5 12h14M13 6l6 6-6 6"></path></svg>';

// ---------------------------------------------------------------------------------------------
// Rows. `uid` keeps aria-controls unique across the eight groups on the landing page.
function rows(items, uid) {
  return items.map(function (qa, i) {
    const id = 'lxfaq-a-' + uid + '-' + i;
    const open = i === 0;
    return '<div class="lx-faq-item' + (open ? ' is-open' : '') + '">'
      + '<h3 class="lx-faq-h"><button type="button" class="lx-faq-q" data-lxnonav="1"'
      + ' aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + id + '">'
      + '<span>' + esc(qa[0]) + '</span>' + CHEV + '</button></h3>'
      + '<div class="lx-faq-ans" id="' + id + '" role="region"><div>'
      + '<p class="lx-faq-a">' + esc(qa[1]) + '</p></div></div>'
      + '</div>';
  }).join('');
}

function ld(items) {
  return '<script type="application/ld+json" id="lx-faq-ld">'
    + JSON.stringify({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: items.map(function (qa) {
        return { '@type': 'Question', name: qa[0],
                 acceptedAnswer: { '@type': 'Answer', text: qa[1] } };
      }),
    }).replace(/</g, '\\u003c') + '</scr' + 'ipt>';
}

function side(count, supportHref) {
  return '<div class="lx-faq-side">'
    + '<p class="lx-faq-kicker" data-lxfixed="1" data-logoed="1">'
    + count + ' question' + (count === 1 ? '' : 's') + '</p>'
    + '<h2>Frequently asked questions</h2>'
    + '<p class="lx-faq-lede">The things people ask most, answered plainly.</p>'
    + '<a class="lx-faq-ask" href="' + esc(supportHref) + '">Still have a question?' + ARROW + '</a>'
    + '</div>';
}

// ---------------------------------------------------------------------------------------------
// section({ items })                  -> a plain page
// section({ groups: [{label,id,items}] }) -> the landing page, tabbed
//
// `data-lxnonav` is not decoration. The landing page runs a delegated click handler that matches an
// element's TEXT against the nav labels and navigates, with stopImmediatePropagation, before any
// later listener sees the event. Four tab labels are destinations -- Trade, Launchpad, Pools, Wallet
// -- so clicking them used to leave the page. That handler bails on the first [data-lxnonav]
// ancestor. It goes on the whole right-hand column now, which covers the tabs and every question
// button under them.
function section(spec) {
  const href = spec.supportHref || SUPPORT_DEFAULT;
  let main, all;

  if (spec.groups) {
    const gs = spec.groups.filter(function (g) { return g.items.length; });
    const tabs = gs.map(function (g, i) {
      return '<button type="button" class="lx-faqtab' + (i === 0 ? ' is-on' : '') + '" role="tab"'
        + ' aria-selected="' + (i === 0 ? 'true' : 'false') + '" aria-controls="lxfaq-' + g.id + '"'
        + ' data-lxfaq="' + g.id + '">' + esc(g.label) + ' <span>' + g.items.length + '</span></button>';
    }).join('');
    const panes = gs.map(function (g, i) {
      return '<div class="lx-faq-list lx-faqgrp' + (i === 0 ? ' is-on' : '') + '"'
        + ' id="lxfaq-' + g.id + '" role="tabpanel" data-lxfaqpane="' + g.id + '">'
        + rows(g.items, g.id) + '</div>';
    }).join('');
    main = '<div class="lx-faq-main" data-lxnonav="1">'
      + '<div class="lx-faqtabs" role="tablist" data-lxnonav="1">' + tabs + '</div>'
      + '<div class="lx-faqpanes">' + panes + '</div></div>';
    const seen = {}; all = [];
    gs.forEach(function (g) {
      g.items.forEach(function (qa) { if (!seen[qa[0]]) { seen[qa[0]] = 1; all.push(qa); } });
    });
  } else {
    all = spec.items;
    main = '<div class="lx-faq-main" data-lxnonav="1">'
      + '<div class="lx-faq-list">' + rows(all, 'p') + '</div></div>';
  }

  return '<section class="lx-faq" id="faq"><div class="lx-faq-wrap">'
    + side(all.length, href) + main + '</div></section>'
    + ld(all)
    + (spec.groups ? TABCSS + TABJS : '') + ACCJS;
}

// ---------------------------------------------------------------------------------------------
// Everything a previous run of EITHER transform may have left, including `lx-faqcard` -- the fork's
// own earlier stylesheet, which _xrplfaqcard.js used to inject and which this renderer supersedes.
// A stripped script leaves its stylesheet behind unless the stylesheet is named here.
const STRIP = [
  /<section class="lx-faq"[\s\S]*?<\/section>/g,
  /<script type="application\/ld\+json" id="lx-faq-ld">[\s\S]*?<\/script>/g,
  /<style id="lx-faq-head">[\s\S]*?<\/style>/g,
  /<style id="lx-faq-css">[\s\S]*?<\/style>/g,
  /<style id="lx-faqcard">[\s\S]*?<\/style>/g,
  /<style id="lx-faqtabs-css">[\s\S]*?<\/style>/g,
  /<script id="lx-faqtabs-js">[\s\S]*?<\/script>/g,
  /<script id="lx-faq-js">[\s\S]*?<\/script>/g,
];

function strip(h) {
  STRIP.forEach(function (re) { h = h.replace(re, ''); });
  return h;
}

// ---------------------------------------------------------------------------------------------
// apply(h, spec) -> new html, or null if there is nowhere to anchor.
//
// THE SECTION IS PINNED IN PLACE. Where one already exists the replacement goes back at the same
// point rather than being re-anchored on the footer, so a re-run cannot move the block past a
// neighbour and re-cut the cascade -- the rule three transforms on this build learned the hard way.
// It is pinned with a marker rather than a saved offset, because strip() also removes a block that
// sits ABOVE the section (the head sheet), and every byte it removes there shifts a saved offset.
// ALL THREE BLOCKS ARE PINNED, not just the section, and "before </body>" is the reason why.
//
// `</body>` is a fixed position in the FILE and not a fixed position in the CASCADE. Twenty-two more
// transforms have appended their own sheets there since this one first ran, so stripping the block
// and re-appending it carries it past every one of them. Measured: on the bridge page lx-faq-css sat
// at index 72 of 95 layers and the re-append put it at 94; on the landing page it jumped lx-fcta-css,
// lx-prodcards-css and lx-whylumos. Nothing visible moved, because none of those sheets happens to
// touch `.lx-faq` -- which is precisely what makes it dangerous. A re-run that silently reorders 238
// pages trains you to wave the order gate through, and the next reorder will be the one that matters.
//
// So each block is swapped where it stands. The markers are distinct and all three are asserted gone
// before the page is returned: a marker that survives is a bug, not a build.
const M_SEC = '<!--lx-faq-sec-->';
const M_HEAD = '<!--lx-faq-head-->';
const M_CSS = '<!--lx-faq-look-->';

function pin(h, open, close, mark) {
  const a = h.indexOf(open);
  if (a < 0) return h;
  const b = h.indexOf(close, a);
  if (b < 0) return h;
  return h.slice(0, a) + mark + h.slice(b + close.length);
}

function apply(h, spec) {
  h = pin(h, '<section class="lx-faq"', '</section>', M_SEC);
  h = pin(h, '<style id="lx-faq-head">', '</style>', M_HEAD);
  h = pin(h, '<style id="lx-faq-css">', '</style>', M_CSS);

  h = strip(h);

  const markup = section(spec);
  if (h.indexOf(M_SEC) >= 0) {
    h = h.replace(M_SEC, markup);
  } else {
    // The landing page ends on its call to action, so the FAQ goes ABOVE it. Anchoring on the footer
    // there would drop it below the CTA and close the page on a list of questions.
    const cta = spec.groups ? h.indexOf('<section class="final-cta-section"') : -1;
    const fi = cta >= 0 ? cta : h.lastIndexOf('<footer');
    if (fi < 0) return null;
    h = h.slice(0, fi) + markup + h.slice(fi);
  }

  if (h.indexOf(M_HEAD) >= 0) {
    h = h.replace(M_HEAD, HEAD_ALL);
  } else {
    const hi = h.indexOf('</head>');
    if (hi < 0) return null;                     // no head is not something to guess at
    h = h.slice(0, hi) + HEAD_ALL + h.slice(hi);
  }

  if (h.indexOf(M_CSS) >= 0) {
    h = h.replace(M_CSS, CSS);
  } else {
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) return null;
    h = h.slice(0, bi) + CSS + h.slice(bi);
  }

  if (h.indexOf('<!--lx-faq-') >= 0) return null;
  return h;
}

module.exports = { esc, HEAD, CSS, TABCSS, TABJS, ACCJS, section, strip, apply, STRIP };
