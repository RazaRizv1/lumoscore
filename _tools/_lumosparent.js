// Network choosers: /trade, /pools, /bridge, /rewards and /lumos each ask which chain first.
//
// A LumosCore page answers "what is this **on Stellar**" -- the Trade table is Stellar markets, the
// pools are Stellar pools, the rewards are Stellar rounds. Serving one of those at the bare path made
// the Stellar figures look like the whole story, which on /lumos produced a doubled supply and a
// "both chains" holder list on a page that only ever counted one.
//
// So the bare path asks, and /<thing>/stellar answers. Adding XRPL later is a row in NETWORKS, not a
// new page -- and until then it renders as an announced-but-not-live card that cannot be clicked, so
// the chooser is honest about what exists without promoting a chain that is not public.
//
// THIS FILE STARTED AS /lumos ONLY and now drives all five (it keeps its name so its own idempotent
// strip still finds the markup it baked into the containers under the old name -- renaming it would
// orphan an lx-lp block on the LUMOS page forever, since a transform can only remove what it can
// still match).
//
// BOTH PATHS SERVE THE SAME FILE. The route table maps them to one container key and the head script
// decides which view to show from location.pathname. That avoids inventing a second baked page per
// chooser in a design system where every page is a container key.
//
// THE DECISION RUNS IN <head>, NOT AT THE END OF <body>. On /lumos that was survivable; on /trade the
// full market table would paint first and then vanish, which is the flash pattern this codebase keeps
// re-learning. _externalize.js leaves head scripts inline precisely so gates like this stay
// pre-paint, and the class goes on <html> because <body> does not exist yet at that point.
//
// Someone already connected to Stellar is not asked the question -- they are sent straight through. A
// chooser with one live option is a speed bump for the person who has already chosen.
//
// Idempotent: style, script and section blocks are replaced wholesale.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
// The same registry the bridge and network switcher draw from, so a chain looks identical everywhere.
const CHAINS = JSON.parse(fs.readFileSync(__dirname + '/_chains.json', 'utf8'));
const chainLogo = (id) => (CHAINS[id] && CHAINS[id].logo) || '';

const STYLE = '<style id="lx-lumosparent-css">'
  + '.lx-lp{position:relative;max-width:780px;margin:0 auto;padding:56px 0 76px}'
  // The same warm wash the rest of the site opens with. It is the one thing that stops a page of two
  // cards reading as an empty screen, and it adds no element to the page.
  + '.lx-lp::before{content:"";position:absolute;left:-120px;right:-120px;top:-40px;height:300px;'
  + 'pointer-events:none;z-index:0;'
  + 'background:radial-gradient(760px 240px at 50% 0%,rgba(234,106,44,.14),transparent 72%)}'
  + '[data-theme="light"] .lx-lp::before{'
  + 'background:radial-gradient(760px 240px at 50% 0%,rgba(234,106,44,.09),transparent 72%)}'
  + '.lx-lp>*{position:relative;z-index:1}'
  // The header is CENTRED and the cards are not: centring a heading reads as a title, while centring
  // a row of label/value pairs makes them harder to scan down.
  + '.lx-lp-head{text-align:center;margin:0 0 36px}'
  + '.lx-lp-h{font:800 clamp(34px,4vw,46px)/1.08 "Hanken Grotesk",system-ui,sans-serif;'
  + 'color:var(--text,#0e0e10);letter-spacing:-.032em;text-wrap:balance;margin:0 0 12px}'
  + '.lx-lp-sub{font:500 17px/1.62 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);'
  + 'max-width:50ch;margin:0 auto;text-wrap:pretty}'
  + '@media(max-width:640px){.lx-lp{padding:34px 0 52px}.lx-lp-h{font-size:30px}.lx-lp-sub{font-size:16px}}'
  + '.lx-lp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}'
  + '@media(max-width:640px){.lx-lp-grid{grid-template-columns:1fr}}'
  + '.lx-lp-card{display:flex;align-items:center;gap:15px;padding:22px 20px;border-radius:16px;'
  + 'border:1px solid var(--border,#ececef);background:var(--surface,#fff);text-decoration:none;color:inherit;'
  // a barely-there top highlight, so the card reads as a raised surface on the dark build without
  // needing a second colour token that light mode would have to undo
  + 'background-image:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,0) 58%);'
  + 'transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}'
  + '.lx-lp-card:not(.soon){border-color:rgba(234,106,44,.30);'
  + 'background-image:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,0) 58%),'
  + 'linear-gradient(105deg,rgba(234,106,44,.085),rgba(234,106,44,0) 58%)}'
  + '.lx-lp-card:hover{border-color:var(--accent,#ea6a2c);transform:translateY(-3px);'
  + 'box-shadow:0 14px 32px rgba(0,0,0,.30)}'
  + '.lx-lp-card:focus-visible{outline:2px solid var(--accent,#ea6a2c);outline-offset:3px}'
  + '.lx-lp-ico{width:46px;height:46px;flex:0 0 46px;border-radius:50%;background-size:cover;'
  + 'background-position:center;background-repeat:no-repeat;position:relative;'
  // a hairline ring so a dark mark still reads as a disc on a dark card
  + 'box-shadow:0 0 0 1px rgba(127,127,140,.22)}'
  + '.lx-lp-card:not(.soon) .lx-lp-ico{box-shadow:0 0 0 1px rgba(234,106,44,.34)}'
  // Refuse the healer's letter tile outright if it still lands on this element.
  + '.lx-lp-ico{font-size:0!important;color:transparent!important}'
  + '.lx-lp-ico>svg{width:0!important;height:0!important;position:absolute!important}'
  // A column, because these are two lines: as inline spans they ran together and the meta's margin-top
  // was inert.
  + '.lx-lp-main{min-width:0;flex:1 1 auto;display:flex;flex-direction:column;gap:4px}'
  + '.lx-lp-net{font:800 18px/1.2 "Hanken Grotesk",system-ui,sans-serif;color:var(--text,#0e0e10);'
  + 'letter-spacing:-.01em}'
  + '.lx-lp-meta{font:600 13px/1.35 "JetBrains Mono",ui-monospace,monospace;'
  + 'color:var(--text-muted,#8a8fa3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  // The chevron sits in a disc that fills with the accent on hover, so the live card has one obvious
  // thing to aim at rather than a bare glyph.
  + '.lx-lp-go{flex:0 0 auto;width:32px;height:32px;border-radius:50%;display:flex;'
  + 'align-items:center;justify-content:center;background:var(--surface-2,#f4f5f7);'
  + 'color:var(--text-muted,#8a8fa3);transition:background .18s ease,color .18s ease,transform .18s ease}'
  + '.lx-lp-go svg{width:14px;height:14px}'
  + '.lx-lp-card:hover .lx-lp-go{background:var(--accent,#ea6a2c);color:#fff;transform:translateX(2px)}'
  // A chain that is announced but not live must not look clickable: no hover, no pointer, dimmed.
  + '.lx-lp-card.soon{opacity:.8;pointer-events:none;background-image:none;'
  + 'border-style:dashed}'
  + '.lx-lp-soon{margin-left:auto;flex:0 0 auto;padding:4px 9px;border-radius:99px;'
  + 'background:transparent;border:1px solid var(--border,#ececef);color:var(--text-muted,#8a8fa3);'
  + 'font:700 10.5px/1.4 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'white-space:nowrap}'
  + '@media(prefers-reduced-motion:reduce){.lx-lp-card,.lx-lp-go{transition:none}'
  + '.lx-lp-card:hover{transform:none}}'
  // and the tag itself is short enough for the healer to mistake for a ticker, so it opts out too
  + '.lx-lp-soon>svg{width:0!important;height:0!important;position:absolute!important}'
  // The chooser is hidden by default and revealed only on the bare path, so the chain page (same
  // file) never shows it. CSS does the reveal, not script, so it cannot flash in on a slow frame.
  + '.lx-lp{display:none}'
  + 'html.lx-lp-on .lx-lp{display:block}'
  // While the chooser is up, the page's own sections stay out of the flow entirely. The breadcrumb is
  // kept -- it is navigation, not content. Anything OUTSIDE the content wrapper (the FAQ block, the
  // footer) is deliberately untouched and still renders under the chooser.
  + 'html.lx-lp-on .page > *:not(.lx-lp):not(.crumb),'
  + 'html.lx-lp-on main > *:not(.lx-lp):not(.crumb),'
  + 'html.lx-lp-on .container > *:not(.lx-lp):not(.crumb){display:none!important}'
  // ...AND THE FIXED BARS, WHICH ARE NOT INSIDE ANY OF THOSE WRAPPERS (RAZA 2026-10-26, on the
  // launchpad hub signed out: "Im not connected to any network at the moment and Im on the hub page
  // for launchpad. So why's it showing me the cost in XLM").
  //
  // The rules above hide the CHILDREN of the content wrappers, and the launchpad's cost bar is
  // position:fixed at body level -- a sibling of .page, not a descendant -- so nothing above could
  // ever reach it. The hub therefore asked "which chain?" while a bar along the bottom quoted
  // "149.36 XLM ≈ $25" and offered Connect wallet: a price on a chain the reader has not chosen,
  // for a form that is not on screen, which is also the most expensive thing on the page to get
  // wrong.
  //
  // Scoped to the hub only -- the chain pages share this file and still need their bar.
  + 'html.lx-lp-on .summary-fixed,html.lx-lp-on #summaryFixed{display:none!important}'
  // ...AND THE PHONE STEP INDICATOR, which survives for a different reason again: it is nested INSIDE
  // `.crumb`, and `.crumb` is deliberately excluded above because a breadcrumb is navigation rather
  // than content. The launchpad's "1 Details / 2 Review / 3 Confirm" sits in that wrapper on the
  // phone layout only, so it rode along and the hub showed the form's progress through three steps
  // above the words "Choose a network" -- a position in a flow the reader has not entered.
  //
  // Named rather than un-excluding `.crumb`, because the back link in there IS wanted on the hub.
  // Phone only: the desktop layout has no stepper element at all, confirmed in both built pages.
  + 'html.lx-lp-on .steps-mobile{display:none!important}'
  // THE HUBS, SIMPLE AND PROFESSIONAL (RAZA 2026-11-17, on all six: "the design is pathetic. not
  // professional and appealing ... I need it empty and simple. but atleast make it attractive. Not
  // asking to add tonnes of extra effects"). Approved from a mockup on the live pages. APPENDED, not a
  // rewrite of the rules above, so the hub/chain switch, the soon state and the fixed-bar hiding are
  // untouched: the content is centred in the viewport (no orange rule over the heading -- RAZA asked
  // for it gone, 2026-11-17); one soft glow behind the cards; a search box over them (see SEARCH_HTML); the cards sit in even, CENTRED rows (the 780px cap above left NEAR alone on a second line);
  // quiet neutral cards, orange only on hover; full-width rows on a phone. Specific + !important
  // because the rules above and the page's own sheets both style these elements (GUARDRAILS E14).
  + 'html body section.lx-lp{position:relative !important;min-height:calc(100vh - 160px) !important;display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;padding:56px 20px 64px !important;box-sizing:border-box !important;max-width:920px !important;margin-left:auto !important;margin-right:auto !important}html body section.lx-lp::before{content:none !important;display:none !important}html body section.lx-lp .lx-lp-head{text-align:center !important;max-width:640px !important;margin:0 auto 32px !important}html body section.lx-lp .lx-lp-head::before{content:none !important;display:none !important}html body section.lx-lp .lx-lp-h{font-size:clamp(34px,4.6vw,52px) !important;font-weight:800 !important;letter-spacing:-0.04em !important;line-height:1.05 !important;margin:0 0 14px !important;color:#f6f5f3 !important;background:none !important;-webkit-text-fill-color:currentColor !important}html body section.lx-lp .lx-lp-sub{font-size:16.5px !important;line-height:1.6 !important;color:#a5a4ac !important;max-width:500px !important;margin:0 auto !important}html body section.lx-lp .lx-lp-search,html body section.lx-lp .lx-lp-grid{width:100% !important;max-width:460px !important;box-sizing:border-box !important;background:#131317 !important;border:1px solid #26262c !important}html body section.lx-lp .lx-lp-search{position:relative !important;margin:0 auto !important;padding:14px 14px 6px !important;border-bottom:0 !important;border-radius:18px 18px 0 0 !important}html body section.lx-lp .lx-lp-search svg{position:absolute !important;left:26px !important;top:calc(50% + 4px) !important;width:15px !important;height:15px !important;transform:translateY(-50%) !important;color:#7c7c8a !important;pointer-events:none !important}html body section.lx-lp .lx-lp-search input{display:block !important;width:100% !important;height:40px !important;box-sizing:border-box !important;padding:0 12px 0 36px !important;border-radius:10px !important;border:1px solid #26262c !important;background:#1a1a1f !important;color:#f6f5f3 !important;font:500 15px/1 "Hanken Grotesk",system-ui,sans-serif !important;outline:none !important;box-shadow:none !important;-webkit-appearance:none !important;appearance:none !important}html body section.lx-lp .lx-lp-count{position:absolute !important;right:27px !important;top:calc(50% + 4px) !important;transform:translateY(-50%) !important;font:500 13px/1 "Hanken Grotesk",system-ui,sans-serif !important;color:#7c7c8a !important;pointer-events:none !important;white-space:nowrap !important}html body section.lx-lp .lx-lp-search input{padding-right:98px !important}html body section.lx-lp .lx-lp-search input::placeholder{color:#7c7c8a !important}html body section.lx-lp .lx-lp-search input:focus{border-color:#ea6a2c !important}html body section.lx-lp .lx-lp-search input::-webkit-search-cancel-button{filter:invert(.55) !important;cursor:pointer !important}html body section.lx-lp .lx-lp-grid{display:flex !important;flex-direction:column !important;gap:0 !important;margin:0 auto !important;padding:6px 14px 10px !important;border-top:0 !important;border-radius:0 0 18px 18px !important;box-shadow:0 22px 60px -8px rgba(0,0,0,.5),0 8px 24px -12px rgba(0,0,0,.5) !important}html body section.lx-lp .lx-lp-grid>.lx-lp-card,html body section.lx-lp a.lx-lp-card{position:relative !important;display:flex !important;flex-direction:row !important;align-items:center !important;gap:13px !important;flex:0 0 auto !important;width:100% !important;min-width:0 !important;height:auto !important;min-height:0 !important;padding:10px !important;box-sizing:border-box !important;border:1px solid transparent !important;border-radius:12px !important;background:transparent !important;background-image:none !important;box-shadow:none !important;transform:none !important;text-decoration:none !important;transition:background-color .15s ease,border-color .15s ease !important}html body section.lx-lp a.lx-lp-card::before{content:none !important;display:none !important}html body section.lx-lp a.lx-lp-card:hover,html body section.lx-lp a.lx-lp-card:focus-visible{background:rgba(255,255,255,.05) !important;border-color:rgba(255,255,255,.09) !important;transform:none !important;box-shadow:none !important;outline:none !important}html body section.lx-lp .lx-lp-ico,html body section.lx-lp .lx-lp-card:not(.soon) .lx-lp-ico{width:40px !important;height:40px !important;flex:0 0 40px !important;border-radius:50% !important;background-size:112% !important;background-position:center !important;background-repeat:no-repeat !important;background-color:#1d1d25 !important;box-shadow:none !important;border:0 !important;outline:0 !important}html body section.lx-lp .lx-lp-main{display:flex !important;flex-direction:column !important;min-width:0 !important}html body section.lx-lp .lx-lp-net{font-size:16.5px !important;font-weight:700 !important;letter-spacing:-0.01em !important;color:#f6f5f3 !important}html body section.lx-lp .lx-lp-meta{display:none !important}html body section.lx-lp .lx-lp-go{position:static !important;top:auto !important;right:auto !important;left:auto !important;margin:0 0 0 auto !important;align-self:center !important;flex:0 0 16px !important;width:16px !important;height:16px !important;padding:0 !important;border:0 !important;border-radius:0 !important;background:none !important;display:flex !important;align-items:center !important;justify-content:center !important;color:#8b8b97 !important;transform:none !important;transition:color .15s ease,transform .15s ease !important}html body section.lx-lp .lx-lp-go::before{content:none !important}html body section.lx-lp .lx-lp-go svg{display:block !important;width:16px !important;height:16px !important;transform:none !important}html body section.lx-lp a.lx-lp-card:hover .lx-lp-go,html body section.lx-lp a.lx-lp-card:focus-visible .lx-lp-go{color:#ea6a2c !important;transform:translateX(2px) !important;background:none !important}html body section.lx-lp .lx-lp-card.soon{opacity:.6 !important;border-style:solid !important}html body section.lx-lp .lx-lp-none{margin:14px 0 0 !important;font:500 14px/1.5 "Hanken Grotesk",system-ui,sans-serif !important;color:#8e8d95 !important;text-align:center !important}html body section.lx-lp .lx-lp-none[hidden],html body section.lx-lp .lx-lp-card[hidden]{display:none !important}html body section.lx-lp::after{content:"Non-custodial. You sign every transaction in your own wallet." !important;display:block !important;margin-top:22px !important;font:500 13px/1.5 "Hanken Grotesk",system-ui,sans-serif !important;color:#6f6e76 !important;text-align:center !important}html[data-theme=light] body section.lx-lp .lx-lp-h{color:#16161a !important}html[data-theme=light] body section.lx-lp .lx-lp-sub{color:#5c5c66 !important}html[data-theme=light] body section.lx-lp .lx-lp-search,html[data-theme=light] body section.lx-lp .lx-lp-grid{background:#ffffff !important;border-color:#e7e5e1 !important}html[data-theme=light] body section.lx-lp .lx-lp-grid{box-shadow:0 22px 50px -18px rgba(20,20,30,.18),0 6px 18px -10px rgba(20,20,30,.12) !important}html[data-theme=light] body section.lx-lp .lx-lp-search input{background:#f6f5f3 !important;border-color:#e7e5e1 !important;color:#16161a !important}html[data-theme=light] body section.lx-lp .lx-lp-search input::placeholder{color:#8b8a93 !important}html[data-theme=light] body section.lx-lp .lx-lp-search input:focus{border-color:#ea6a2c !important}html[data-theme=light] body section.lx-lp .lx-lp-search input::-webkit-search-cancel-button{filter:none !important}html[data-theme=light] body section.lx-lp .lx-lp-search svg,html[data-theme=light] body section.lx-lp .lx-lp-count{color:#8b8a93 !important}html[data-theme=light] body section.lx-lp .lx-lp-net{color:#16161a !important}html[data-theme=light] body section.lx-lp .lx-lp-ico{background-color:#f0efec !important}html[data-theme=light] body section.lx-lp a.lx-lp-card:hover,html[data-theme=light] body section.lx-lp a.lx-lp-card:focus-visible{background:rgba(16,16,22,.04) !important;border-color:rgba(16,16,22,.08) !important}html[data-theme=light] body section.lx-lp .lx-lp-go{color:#9a99a2 !important}html[data-theme=light] body section.lx-lp a.lx-lp-card:hover .lx-lp-go,html[data-theme=light] body section.lx-lp a.lx-lp-card:focus-visible .lx-lp-go{color:#ea6a2c !important}html[data-theme=light] body section.lx-lp .lx-lp-none{color:#6f6f79 !important}html[data-theme=light] body section.lx-lp::after{color:#8b8a93 !important}@media (max-width:640px){html body section.lx-lp{min-height:0 !important;padding:36px 16px 44px !important;justify-content:flex-start !important}html body section.lx-lp .lx-lp-head{margin-bottom:24px !important}html body section.lx-lp .lx-lp-sub{font-size:15.5px !important}html body section.lx-lp .lx-lp-search input{font-size:16px !important;height:44px !important}html body section.lx-lp::after{padding:0 8px !important}}@media (prefers-reduced-motion:reduce){html body section.lx-lp a.lx-lp-card,html body section.lx-lp .lx-lp-go{transition:none !important}}'
  + '</style>';

// One row per chain per hub. `live:false` renders as an announced-but-not-yet card rather than a dead
// link.
//
// XRPL IS LIVE (2026-10-01). It was unlinked here because it was built but not public; it is now
// served from this same host under /<section>/xrpl, so each hub links to its own XRPL page exactly as
// it links to its Stellar one. The href is filled in below from the hub's own path rather than
// hardcoded, so a hub added later cannot end up pointing at the wrong section.
// meta: 'Live' is the FALLBACK, not the intended answer. Every Stellar card carries a line saying what
// the chain gives you there ("Swaps and limit orders", "AMM pools"), and the XRP Ledger card said the
// same single word on all six hubs — so half of every chooser read as unfinished (RAZA 2026-10-10).
//
// A hub supplies xrplMeta where the claim has been CHECKED against the XRPL build, and falls back to
// 'Live' where it has not. Three are filled in; three deliberately are not:
//   * /launchpad — browser/launchpad.js is running REDUCED TEST PRICING, about 3.18 XRP (~$4.29), not
//     the $25 the Stellar card quotes. _xrplaunchpad.js records that this page once published "$25"
//     beside a panel charging $4.29. Pricing is RAZA's decision, not a copy fix.
//   * /rewards   — no per-round XRPL figure exists to state.
//   * /lumos     — Stellar's line quotes supply, and RAZA asked for supply to stay out of our copy
//                  (it moves: anyone can burn LUMOS).
// Inventing any of those three would put a number we do not charge, or cannot support, on the card.
// A CHAIN IS OFFERED BY A BUILD THAT SHIPS ITS PAGES, AND BY NO OTHER.
//
// This was hardcoded live, so every hub advertised XRP Ledger whether or not the deploy contained a
// single XRPL page. The plain Stellar build does not: /trade/xrpl, /pools/xrpl, /bridge/xrpl,
// /rewards/xrpl, /lumos/xrpl and /launchpad/xrpl are all 404 on lumoscore.com right now. Six dead
// links on every page, and nothing in the build would have said so -- the route table is fine, the
// pages exist in SOMEONE's dist, and only the two together are wrong.
//
// Caught by pointing the health bot at a release candidate before shipping it: production has no
// such links to crawl yet, because this release is what adds them.
//
// The XRPL pages come from _mergexrpl.js, which writes them into dist/x/ and adds their routes. A
// build that runs it should set LX_XRPL_PUBLIC=1 so the chooser offers them; a build that does not
// shows the card with an "Upcoming" badge and NO href, which cardHTML already supports and which is
// the honest thing to show for a chain this deploy cannot reach.
//
// Defaults to off because that is the state that cannot ship a broken link. The failure mode of
// forgetting the flag is a card that says "Upcoming" for a day; the failure mode of the old default
// is six 404s on every page of the site.
const XRPL_PUBLIC = process.env.LX_XRPL_PUBLIC === '1';
const XRPL_LIVE = {
  id: 'xrpl', name: 'XRP Ledger', href: '',
  live: XRPL_PUBLIC,
  meta: XRPL_PUBLIC ? 'Live' : 'Coming soon',
};

// key  — the container page key this chooser is baked into (base name, theme suffix stripped)
// path — the bare url that shows it
const HUBS = [
  {
    key: 'lumoscore-dex', path: '/trade',
    h1: 'Trade', title: 'Trade — Choose a network | LumosCore',
    sub: 'Swap assets and place limit orders on-chain. Choose a network to see its markets.',
    stellarMeta: 'Swaps and limit orders',
    // Same line as Stellar's because the XRPL build genuinely has both: /trade/xrpl ships the swap UI
    // and the limit-order controls, and an XRPL limit order was verified end to end on 2026-09-15
    // (OfferCreate, buy with no flags / sell with tfSell).
    xrplMeta: 'Swaps and limit orders',
  },
  {
    key: 'lumoscore-amm', path: '/pools',
    h1: 'Liquidity Pools', title: 'Liquidity Pools — Choose a network | LumosCore',
    sub: 'Create and manage AMM pools. Choose a network to see its pools.',
    stellarMeta: 'AMM pools',
    // The XRP Ledger has had native AMMs since XLS-30, and /pools/xrpl lists them with a working
    // Create Pool control — checked on the served page, not assumed from the ledger's capabilities.
    xrplMeta: 'AMM pools',
  },
  {
    key: 'lumoscore-bridge', path: '/bridge',
    h1: 'Bridge', title: 'Bridge — Choose a network | LumosCore',
    sub: 'Move assets between networks. Choose the network you are bridging from.',
    stellarMeta: 'CCTP, LayerZero, NEAR Intents',
    // THREE ROUTES, and I got this wrong twice before reading the page properly. It is not "Axelar
    // ITS" (my first guess), and it is not "Axelar, NEAR Intents" (my second): /bridge/xrpl titles
    // itself "39 networks via NEAR Intents, Axelar and THORChain" and answers its own FAQ with
    // "Three, and they are good at different things." THORChain is mentioned 80 times on it.
    //
    // The second answer was wrong because I searched the page for a FIXED LIST of route names I
    // expected to find -- cctp|layerzero|axelar|near intents -- which cannot report a route I did not
    // think of. Counting what the page actually names is the only check that can.
    //
    // The two chains' route sets are genuinely different and neither contains the other: Axelar and
    // THORChain are XRPL-only, CCTP and LayerZero are Stellar-only, NEAR Intents is on both. Ordered
    // as the page orders them.
    xrplMeta: 'NEAR Intents, Axelar, THORChain',
  },
  {
    key: 'lumoscore-rewards', path: '/rewards',
    h1: 'LUMOS Rewards', title: 'LUMOS Rewards — Choose a network | LumosCore',
    sub: 'Liquidity and holder rewards, paid out each round. Choose a network to see its rounds.',
    stellarMeta: '3M LUMOS per round',
  },
  {
    key: 'lumoscore-launch-token', path: '/launchpad',
    h1: 'Launchpad', title: 'Launchpad — Choose a network | LumosCore',
    sub: 'Issue a token and open its first pool. Choose the network you want to launch on.',
    stellarMeta: '$25 flat, paid in XLM',
  },
  {
    key: 'lumoscore-lumos-token', path: '/lumos',
    h1: 'LUMOS', title: 'LUMOS — Choose a network | LumosCore',
    sub: 'LumosCore’s native token. Choose a network to see its price, pools and holders there.',
    stellarMeta: 'LUMOS · 1B supply',
  },
];

const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

// THE LAUNCHPAD HAS NO /xrpl URL, AND THAT IS DELIBERATE. It is one of the authgated five, which
// RAZA settled on 2026-10-01 — "neither its indexable. so why create dashboard/xrpl" — so /launchpad
// is ONE url and the middleware serves whichever build the lx_chain cookie names. /dashboard/xrpl and
// /wallet/xrpl 404 for the same reason.
//
// Every other hub genuinely has both halves, so the generic rule below is right for them; the
// launchpad was the one place it produced a link to a url the rule above forbids. Found in a mobile
// audit 2026-10-09: the chooser's XRP Ledger card 404'd, on staging AND production.
//
// So this card carries the CHOICE instead of a path: the bare url, plus the chain for the script
// below to write before it follows the link. RAZA picked this over creating the route (2026-10-09).
// EMPTIED 2026-10-10, AND THE MECHANISM IS LEFT IN PLACE ON PURPOSE. The cookie worked exactly as
// designed; the launchpad stopped being the kind of page it suits.
//
// Sharing one url between the chains is fine while a page is PRIVATE — there is no chooser to reach
// and no second url worth having. The launchpad is now public and fronted by this chooser, and a url
// cannot be both "choose a network" and one of the choices. With lx_chain=xrpl the middleware served
// the XRPL build's file, which carries no chooser markup, so the hub ceased to exist for anyone who
// had ever picked XRPL. RAZA hit exactly that: "why its not taking me to hubpage of launchpad where i
// could select the network like I do on Trade, Cross-chain, Pools, and lumos."
//
// Measured on the deployed build before the fix:
//   /launchpad, no cookie        -> chooser script 1, cards 2
//   /launchpad, lx_chain=xrpl    -> chooser script 0, cards 0, 194 XRP references
//   /trade,     lx_chain=xrpl    -> chooser script 1, cards 2   (unaffected: XRPL is at /trade/xrpl)
//
// That last row is the whole answer. Every other hub gives each chain its own url, so the bare path is
// always Stellar's file and its chooser always runs. The launchpad now does the same: the XRPL build
// claims /launchpad/xrpl, so netsFor() below produces a normal per-chain href and no cookie is needed.
//
// Kept as an empty map rather than deleted because the branch it feeds is the only support for a hub
// whose chains share a url, and nothing about that idea was wrong — if a future hub genuinely needs
// it, adding the path back here is the whole change.
const COOKIE_HUBS = {};

function netsFor(hub) {
  const bare = COOKIE_HUBS[hub.path];
  return [
    { id: 'stellar', name: 'Stellar', href: hub.path + '/stellar', live: true,
      icon: chainLogo('stellar'), meta: hub.stellarMeta, setChain: bare ? 'stellar' : '' },
    // href from the hub's OWN path, exactly as Stellar's is above — /trade/xrpl beside
    // /trade/stellar — so a hub added later cannot end up pointing at the wrong section.
    Object.assign({ icon: chainLogo('xrpl') }, XRPL_LIVE, {
      href: bare ? hub.path : hub.path + '/xrpl',
      setChain: bare ? 'xrpl' : '',
      // after XRPL_LIVE in the merge, so a hub that names one wins and a hub that does not keeps 'Live'.
      // When the chain is not in this build the hub's own line is skipped: "Swaps and limit orders"
      // under an Upcoming badge describes a page the visitor cannot open.
      meta: XRPL_PUBLIC ? (hub.xrplMeta || XRPL_LIVE.meta) : XRPL_LIVE.meta,
    }),
  ];
}

function cardHTML(n) {
  // data-lxc / data-logoed / a zero-size svg child: three independent ways to tell the container's logo
  // healer to leave this element alone. Without them it paints a letter-"L" over the chain's mark.
  const SKIP = ' data-lxc="" data-logoed="1"';
  const GUARD = '<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"></svg>';
  // SINGLE quotes around the URL, not JSON.stringify.
  //
  // JSON.stringify wraps the data URI in DOUBLE quotes, and this goes inside a double-quoted style
  // attribute, so the parser ended the attribute at the URI's opening quote. What reached the browser
  // was style="background-image:url(" -- an invalid declaration and a pile of junk attributes -- which
  // is why both chain marks on /lumos rendered as empty circles. It looked correct in the source and
  // was broken in the DOM, so it survived every read of the file.
  //
  // Asserted rather than assumed safe: a URI containing a single quote would reintroduce the same bug
  // one quote-character over.
  if (n.icon && n.icon.indexOf("'") >= 0) {
    throw new Error('chain icon for ' + n.id + " contains a single quote; it would break the style attribute");
  }
  const bg = n.icon ? (" style=\"background-image:url('" + n.icon + "')\"") : '';
  const inner = '<span class="lx-lp-ico"' + SKIP + bg + '>' + GUARD + '</span>'
    + '<span class="lx-lp-main"><span class="lx-lp-net">' + n.name + '</span>'
    + '<span class="lx-lp-meta">' + n.meta + '</span></span>'
    + (n.live ? ('<span class="lx-lp-go">' + GO + '</span>')
              : ('<span class="lx-lp-soon"' + SKIP + '>' + GUARD + 'Upcoming</span>'));
  // data-lxsetchain is present ONLY on a hub whose two networks share one url (the launchpad). The
  // script below writes lx_chain from it before following the link, because there the cookie IS the
  // choice -- the path cannot carry it.
  const SET = n.setChain ? (' data-lxsetchain="' + n.setChain + '"') : '';
  return n.live
    ? '<a class="lx-lp-card" href="' + n.href + '" data-lxnet="' + n.id + '"' + SET + '>' + inner + '</a>'
    : '<div class="lx-lp-card soon" data-lxnet="' + n.id + '">' + inner + '</div>';
}

// THE NETWORK SEARCH (RAZA 2026-11-17: "add a search at the top of the networks (under heading and
// description). as we keep adding more networks, it will be needed"). In the MARKUP, not injected,
// so it is there at first paint and the cards never move down when it arrives. It matches a card's
// NAME, its data-lxnet id and the names people type (xrp, ripple, xlm, hbar, usdc) -- not the
// description: on /bridge the Stellar and XRPL cards say "NEAR Intents", so "near" matched all
// three. Enter opens the network when exactly one is left. The listener is delegated on document,
// so it works from the head script, before <body> exists.
const SEARCH_HTML = '<div class="lx-lp-search" role="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg><input type="search" placeholder="Search networks" aria-label="Search networks" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><span class="lx-lp-count" aria-live="polite"></span></div>';
const NONE_HTML = '<p class="lx-lp-none" hidden>No network matches that search.</p>';
const SEARCH_JS = '(function(){try{var AL={stellar:"xlm stellar lumens",xrpl:"xrp ripple xrpl xrp ledger",near:"near protocol",arc:"circle usdc arc",hedera:"hbar hashgraph"};function nm(s){return String(s||"").toLowerCase().split(" ").filter(Boolean).join(" ");}function run(i){var sec=i.closest("section.lx-lp");if(!sec)return;var q=nm(i.value),n=0;[].forEach.call(sec.querySelectorAll(".lx-lp-card"),function(c){var id=c.getAttribute("data-lxnet")||"",t=c.querySelector(".lx-lp-net");var h=nm((t?t.textContent:"")+" "+id+" "+(AL[id]||""));var ok=!q||q.split(" ").every(function(w){return h.indexOf(w)>=0;});c.hidden=!ok;if(ok)n++;});var z=sec.querySelector(".lx-lp-none");if(z)z.hidden=n>0;var k=sec.querySelector(".lx-lp-count");if(k)k.textContent=n+(n===1?" network":" networks");}function all(){[].forEach.call(document.querySelectorAll(".lx-lp-search input"),run);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",all);else all();document.addEventListener("input",function(e){var t=e.target;if(t&&t.matches&&t.matches(".lx-lp-search input"))run(t);},true);document.addEventListener("keydown",function(e){var t=e.target;if(e.key!=="Enter"||!t||!t.matches||!t.matches(".lx-lp-search input"))return;var sec=t.closest("section.lx-lp"),l=sec?[].filter.call(sec.querySelectorAll("a.lx-lp-card"),function(c){return !c.hidden;}):[];if(l.length===1){e.preventDefault();location.href=l[0].getAttribute("href");}},true);}catch(_){}})();';

function viewHTML(hub) {
  return '<section class="lx-lp">'
    + '<div class="lx-lp-head">'
    // h2, NOT h1 — AND IT UNDID _h1fix.js UNTIL IT WAS (RAZA 2026-10-08, approving the fix).
    //
    // _h1fix.js exists to leave exactly one h1 per page, and it demotes `<h1 class="lx-lp-h">` to h2
    // for the stated reason that the chooser heading "was never the page title". This line emitted it
    // as an h1 again, so whichever of the two ran last decided the result — and the shipped build had
    // BOTH: `<h1 class="lx-lp-h">Trade</h1>` beside `<h1>Explore the <em>Aptos</em> DEX</h1>`, on all
    // six hubs (Trade, Pools, Bridge, Rewards, Launchpad, LUMOS) across desktop, dark and mobile.
    // Eighteen built files, two h1s each, which means neither states the subject.
    //
    // NOTHING MOVES ON SCREEN. Every rule for this heading is keyed to the class — `.lx-lp-h{font:800
    // clamp(34px,4vw,46px)…}` and the 640px override — and there is no `h1` type selector anywhere in
    // this layer, so the tag carries no styling. The hero keeps the page's only h1 on both routes this
    // file serves (/trade the chooser, /trade/stellar the page), which is the half of the problem a
    // static demotion can actually solve.
    + '<h2 class="lx-lp-h">' + hub.h1 + '</h2>'
    + '<p class="lx-lp-sub">' + hub.sub + '</p>'
    + '</div>'
    + SEARCH_HTML
    + '<div class="lx-lp-grid">' + netsFor(hub).map(cardHTML).join('') + '</div>'
    + NONE_HTML
    + '</section>';
}

// Runs in <head>, before the body exists and before anything paints.
function scriptHTML(hub) {
  return '<script id="lx-lumosparent">(function(){try{' + SEARCH_JS
    // Trailing slash tolerated; anything deeper (/trade/stellar) is a network page, not the chooser.
    + 'var p=(location.pathname||"").replace(/\\/+$/,"");'
    + 'var HUB=' + JSON.stringify(hub.path) + ', KEY=' + JSON.stringify(hub.key) + ';'
    // The raw container filename only comes up opening the built file directly, where there is no
    // routing at all; matching it keeps the chooser reachable there too. Anything else -- above all
    // HUB + "/stellar" -- is the network page and must render normally.
    + 'var last=p.split("/").pop()||"";'
    + 'if(p!==HUB&&last.indexOf(KEY)!==0)return;'
    // Already connected: answer the question rather than ask it. replace() so Back does not bounce
    // between the chooser and the page it forwarded to.
    //
    // BOTH CHAINS NOW, NOT JUST STELLAR (RAZA 2026-10-16: "If im connected to XRPL, whys it even
    // taking me to the hub page. It should just take me to XRPL trade main page instead of showing
    // this. There's no need as its designed for not-connected users only").
    //
    // The old condition was `c===""||c==="stellar"`, so an XRPL reader fell through to the chooser
    // and was asked a question they had already answered by connecting a wallet. The comment above
    // this block always said "someone already connected is sent straight through" — it was only ever
    // half-implemented, and it stayed that way because the chain that was missing did not exist yet
    // when it was written.
    //
    // THE CONNECTED WALLET DECIDES, NOT lumos.chain. Those are two different facts and this file was
    // reading the wrong one: `lumos.chain` is a VIEW preference the switcher writes, while
    // `lumos.network` is the chain the connected address actually lives on. They disagree exactly
    // when this bug shows — browsing Stellar pages with an XRPL wallet connected.
    //
    // The address shape is the backstop, because it cannot go stale the way a stored field can: an
    // XRP Ledger address is r-prefixed base58, a Stellar one is G-prefixed base32. If a future
    // connect path forgets to write lumos.network, this still resolves correctly.
    + 'var a="",n="",c="";'
    + 'try{ a=localStorage.getItem("lumos.address")||"";'
    + 'n=(localStorage.getItem("lumos.network")||"").toLowerCase();'
    + 'c=(localStorage.getItem("lumos.chain")||"").toLowerCase(); }catch(_){}'
    + 'if(n!=="xrpl"&&n!=="stellar"){ n=/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)?"xrpl":(/^G[A-Z2-7]{55}$/.test(a)?"stellar":""); }'
    + 'if(!n)n=(c==="xrpl"||c==="stellar")?c:"";'
    // XRPL only when this build actually carries those pages. Forwarding to /xrpl on a Stellar-only
    // build would replace a working chooser with a 404 — the chooser is the correct answer there.
    + 'if(a&&n==="xrpl"&&' + JSON.stringify(XRPL_PUBLIC) + '){ location.replace(HUB+"/xrpl"); return; }'
    + 'if(a&&(n===""||n==="stellar")){ location.replace(HUB+"/stellar"); return; }'
    + 'document.documentElement.classList.add("lx-lp-on");'
    // THE COOKIE IS THE CHOICE, on a hub whose two networks share one url. Only the launchpad is
    // like that -- see COOKIE_HUBS above -- and only its cards carry data-lxsetchain, so this is a
    // no-op everywhere else. Written on the way out, before the link is followed, so the middleware
    // already has it when it serves the next page.
    //
    // Both directions, not just XRPL: a reader who connected XRPL earlier still has lx_chain=xrpl,
    // and without this the Stellar card would hand them the XRPL launchpad from a url that says
    // "stellar". Measured on the deployed build before the fix -- /launchpad/stellar with
    // lx_chain=xrpl served seven XRPL references and no Stellar one.
    // ON WINDOW, IN CAPTURE. A document-level capture listener is NOT early enough here: the design
    // ships its own click router bound to window, and capture runs window -> document, so it took the
    // click first and this never saw it. Measured -- the cookie stayed unset on a dispatched click
    // while the handler was demonstrably installed. Same remedy the Trade dropdown needed today.
    + 'window.addEventListener("click",function(ev){try{'
    + 'var t=ev.target&&ev.target.closest?ev.target.closest("[data-lxsetchain]"):null;'
    + 'if(t){var w=t.getAttribute("data-lxsetchain");'
    + 'if(w==="xrpl"||w==="stellar")document.cookie="lx_chain="+w+";path=/;max-age=31536000;samesite=lax";}'
    // AND THE CARD'S OWN LINK HAS TO BE CLAIMED, or the chooser answers every click with Stellar.
    //
    // RAZA 2026-10-30: "If not signed in, and we visit lumoscore.com/trade and then click on XRP
    // Ledger, it opens trade/stellar instead of trade/xrpl." Measured on the deployed site, signed
    // out: the card's href was /trade/xrpl at window-capture time and the landing page was
    // /trade/stellar, with the event never reaching the bubble phase -- so a handler in between
    // cancelled the link and navigated somewhere of its own choosing.
    //
    // That handler is window.__lumosNav, the design's blanket row/card router. It resolves a
    // destination through a Stellar-shaped resolver whose chain defaults to "stellar" for any route
    // it does not recognise, which is every route in this build. Exactly the layer that sent pool
    // rows to /pools/stellar in September -- see the lumosnav memory. The string /trade/stellar is
    // in no file: it is assembled at runtime, so nothing about this is findable by grep.
    //
    // It is NOT only /trade. Every hub ships this same card, and /pools was verified failing the
    // same way. It is also every reader the chooser exists for: a connected wallet is forwarded to
    // its own chain by the block above, so only signed-out visitors ever see these cards at all.
    //
    // Window-capture is the only phase early enough -- document-level capture already lost this
    // argument twice. stopImmediatePropagation so the router cannot also act on a click we handled.
    + 'if(ev.defaultPrevented)return;'
    + 'var c=ev.target&&ev.target.closest?ev.target.closest("a.lx-lp-card[href]"):null; if(!c)return;'
    // Same-origin paths only. The card is ours and always points at a path, so anything else means
    // the markup changed under this handler and the browser should keep its own behaviour.
    + 'var u=c.getAttribute("href"); if(!u||u.charAt(0)!=="/")return;'
    // Taken away from the router in BOTH cases -- a modifier click was being swallowed too, so
    // open-in-new-tab did nothing on these cards. Stopping propagation without cancelling leaves the
    // browser's own handling intact, which is what opens the new tab; only a plain click is steered
    // from here. Reaching this line at all proves we ran before the router, because it bails above
    // on an already-cancelled event and the plain-click case demonstrably navigates.
    + 'ev.stopImmediatePropagation();'
    + 'if(ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;'
    + 'ev.preventDefault();'
    + 'location.href=u;'
    + '}catch(_){}} ,true);'
    // THE CLIENT NO LONGER WRITES document.title, and that is the point (2026-10-27).
    //
    // It used to, because the shared file bakes the NETWORK page's title and the hub had no way to
    // correct it. The middleware now sets the hub's title in the served bytes from HUB_SEO in
    // extract_site.js -- which is the copy a crawler reads -- and these two lines then overwrote it a
    // moment later with a DIFFERENT string from the table below. Two sources for one title, visibly
    // disagreeing in the tab, which is the exact trap the HUB_SEO comment records from 2026-10-10.
    //
    // The table's `title` stays as the chooser's own fallback and is no longer applied here.
    + '}catch(_){}})();</script>';
}

const baseOf = (k) => k.replace(/\.html$/, '').replace(/-(dark|light|mobile)$/, '');

let pages = 0, missed = 0;
const hit = {};
for (const dev of ['desktop', 'mobile']) {
  const file = `lumoscore-aptos-${dev}.html`;
  let data; try { data = read(file); } catch (e) { continue; }
  const { json, s, e } = getContents(data);
  let changed = false;

  for (const k of Object.keys(json)) {
    // EXACT base match, never a substring: "lumoscore-dex" is a prefix of "lumoscore-dex-asset" and
    // "lumoscore-amm" of "lumoscore-amm-pool", so an unanchored test would bake a chooser onto every
    // asset and pool detail page.
    const hub = HUBS.filter((h) => h.key === baseOf(k))[0];
    let p = json[k];
    const before = p;

    // Strip unconditionally, on EVERY page: an earlier run of this file put the LUMOS chooser on its
    // page, and a page that is no longer a hub must lose its markup rather than keep it forever.
    p = p.replace(/<style id="lx-lumosparent-css">[\s\S]*?<\/style>/g, '')
         .replace(/<script id="lx-lumosparent">[\s\S]*?<\/script>/g, '')
         .replace(/<section class="lx-lp"[\s\S]*?<\/section>/g, '');

    if (hub) {
      // The view goes at the top of the page's own content wrapper, so the breadcrumb above it still
      // reads. Desktop wraps in <main>; the phone has no <main> at all and uses .container -- checked
      // rather than assumed, because the first pass silently inserted nothing on mobile.
      let ins = -1;
      const mainAt = p.indexOf('<main');
      if (mainAt >= 0) ins = p.indexOf('>', mainAt) + 1;
      if (ins <= 0) {
        const contAt = p.indexOf('<div class="container"');
        if (contAt >= 0) ins = p.indexOf('>', contAt) + 1;
      }
      if (ins > 0) {
        p = p.slice(0, ins) + viewHTML(hub) + p.slice(ins);
        // head, so the gate is pre-paint and the style is present before the first frame
        if (p.indexOf('</head>') >= 0) p = p.replace('</head>', STYLE + scriptHTML(hub) + '</head>');
        pages++;
        hit[hub.path] = (hit[hub.path] || 0) + 1;
      } else { console.log('  ! no insertion point on ' + k); missed++; }
    }

    if (p !== before) { json[k] = p; changed = true; }
  }

  if (changed) {
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
}
const cover = HUBS.map((h) => h.path + ':' + (hit[h.path] || 0)).join(' ');
console.log('network choosers: ' + pages + ' page key(s) — ' + cover);
// Every hub must land on at least one page key, or a bare path silently serves the chain page.
const empty = HUBS.filter((h) => !hit[h.path]);
if (empty.length) { console.error('  ! no page key matched: ' + empty.map((h) => h.path).join(', ')); process.exit(1); }
if (missed) process.exit(1);
