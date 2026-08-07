# LumosCore — Session Handoff

## Where things stand
LumosCore is a multi-chain DeFi design set: 5 chains (aptos, hedera, starknet, vechain, worldchain) ×
{desktop, mobile} = **10 showcase files** in `C:\LumosCore\`. Each showcase embeds its pages as a JSON
map (`<script id="designContents">`) and renders one at a time in a preview iframe.

### DONE (verified)
1. **Navigation fixed** — programmatic `location.href='lumoscore-*'` navigations (broken inside srcdoc)
   rerouted through an injected `__lxNav()` helper; account widget → profile, disconnect → signin;
   inert guard for links to missing pages.
2. **Deployable site** — pages extracted to real standalone files at `C:\LumosCore\dist\<chain>\`
   (5 folders, 70 pages + index.html each = 355 files). Each has a standalone runtime (real
   `lxNavigate`, inert guard) so links work as normal page-to-page navigation. `index.html`
   device-detects → landing vs landing-mobile. Desktop/mobile kept as separate page sets.
3. **Typography + color redesign (premium pass 1)** — applied to ALL 10 showcase + 355 dist files:
   - Font: **Hanken Grotesk** (UI+display) + **JetBrains Mono** (data). Was mixed Plus Jakarta / Inter.
   - Palette: hot orange `#ff7a30` → ember **`#ea6a2c`** (used sparingly); lighter orange → `#ff894c`;
     secondary blue `#4d8bff` → iris **`#8b7bff`**; warmed neutral steps; green `#34d27a`→`#35c07f`.
   - Layout-checked (zero overflow/clipping) on landing/dex/amm/wallet.

### DONE — premium imagery (CSS/SVG)
Premium hero imagery applied to **Landing, Trade (dex main), Pools (amm main)** across ALL 5 chains
(desktop+mobile), showcase + dist, via `inject_imagery.js` (`<style id="lx-imagery">` before `</head>`):
- Landing: refined ember+iris mesh, toned-down orbs, masked technical grid, hero+site film grain.
- Trade (`.dex-hero`): ember market-chart line motif (SVG) + glow; `.lumos-promo` faint grid.
- Pools (`.dex-hero`): iris/green liquidity-flow curves (SVG) + glow.
- All page types get a subtle site-wide film grain (`body::after`). Verified: no overflow added.
Re-run: `node inject_imagery.js --showcase --write <showcase files>` then `node extract_site.js`.

### DONE — Landing v3 (CINEMATIC scroll-scrub, current) — user demanded "cost thousands" quality
Source of truth: `C:/LumosCore/dist/_landing-preview.html`. Deploy: `node inject_landing.js --write
<5 desktop showcase files>` (inlines the 3 JPEGs as data URIs, points the video at the Higgsfield CDN
url) → `node extract_site.js` → then the bash finalize step copies `land-monolith.mp4` into each
`dist/<chain>/assets/` and rewrites the CDN url → relative `assets/land-monolith.mp4` (self-contained
deploy). Landing HTML ~419KB.
Higgsfield assets in `C:\LumosCore\assets\`: land-monolith.png/.jpg + **land-monolith.mp4** (5s 1080p
cinematic orbit, kling3_0_turbo, ~7MB), land-coins.jpg, land-rocket.jpg.
Structure: pinned hero (autoplay-loop monolith video, sticky) where scroll SCRUBS the choreography —
copy fades out, four feature tags fade in orbiting the object, final "Six products…Zero custody"
headline resolves, object scales; angled kinetic marquee; line-reveal manifesto; **horizontal-scroll
product pin** (vertical scroll drives track translateX through 6 panels); bento stats w/ count-up;
dual CTA cards w/ coin/rocket renders; parallax LUMOSCORE watermark footer; custom cursor + magnetic
buttons; grain; scroll progress bar.
**CRITICAL technique — all scroll motion is pure CSS `animation-timeline` (scroll(root) + view()),
NOT JS.** Reason: the browser-preview pane PAUSES rAF, scroll events, video playback, and repaint under
automation (verified: rAF 0 ticks, scroll 0 events) — JS scroll animation can't be built or verified
there. CSS scroll-driven animations render at each scroll POSITION and DO show in screenshots, so they
were verified by scroll-to-position + screenshot. Gotchas baked in: hero is the FIRST element so
`view-timeline cover` starts at ~26% at scrollY 0 → use `scroll(root)` with vh ranges instead; no
`scroll-behavior:smooth` (breaks programmatic scroll); `overflow-anchor:none` (video/reveal layout
shifts were resetting scroll); content default-VISIBLE (never hidden behind time-based intro anims,
which freeze in the pane); counters have a `setTimeout` fallback to guarantee final value if rAF stalls.
JS is ENHANCEMENT only (cursor, magnetic, count-up) and degrades cleanly.
Mobile landing still old. Prior landing (static hero images) is superseded below.

### SUPERSEDED — Landing page v2 (scroll-reveal redesign)
The desktop `lumoscore-landing.html` was REBUILT from scratch (Novify-inspired, LumosCore brand,
DARK-ONLY by design): starfield + breathing ember planet-horizon hero (pure CSS), five floating
metallic chain coins (CSS), logo marquee, statement section, Higgsfield 3D "L" plate-stack monolith
showcase, animated counter stats ("Proof of Work" bento), quote, 6-product grid, dual CTA cards with
Higgsfield renders (coin fan / chrome rocket, masked into card bg), giant LUMOSCORE watermark footer.
Scroll system: deterministic scroll-sweep reveals + eased counters (NO IntersectionObserver — IO
callbacks never fire in the preview pane; sweep works everywhere), rAF parallax on hero layers only
(scrollY-based parallax is WRONG for mid-page elements), scroll progress bar, reduced-motion respected.
Source of truth: `C:/LumosCore/dist/_landing-preview.html` (edit → `node inject_landing.js --write
<5 desktop showcase files>` inlines /assets/land-*.jpg as data URIs → `extract_site.js`). 280KB
self-contained. Assets: land-monolith/coins/rocket (.png+.jpg) in C:\LumosCore\assets.
NOTE: mobile landing (`lumoscore-landing-mobile.html`) was NOT redesigned — still the old design.
Pane traps hit: `loading="lazy"` images never load in the pane (use eager); screenshot pixel scale is
INCONSISTENT between captures (sometimes CSS 1:1, sometimes ×1.25) — always re-measure before clicking.

### DONE — CRITICAL standalone nav fix (`fix_lumosnav.js`) — read this before touching click behavior
The original design files ship a hidden heuristic navigator (`window.__lumosNav`, in 335 pages) that
intercepts clicks at document-capture, classifies them (nav labels / buttons / **rows**), calls
`e.preventDefault()+e.stopImmediatePropagation()`, then navigates via `window.parent.lxNavigate` ONLY —
with an explicit `P===window → return` bail. Consequence: in the standalone dist site every row/button
click was **swallowed and dropped** (worked in the showcase iframe, silently dead standalone). This was
the real cause of "can't open Trade→Asset / Pools→Pool". Fixed by rewriting its `nav()` (exact-string
replace in all pages): parent.lxNavigate → else window.lxNavigate (standalone runtime) → else
location.href. Verified with REAL mouse clicks: markets row → dex-asset ✓, pools row → amm-pool ✓,
showcase unchanged ✓.
Debugging traps that hid this: (1) the pane's javascript_tool CAN reach page globals, but synthetic
row.click()/dispatchEvent were killed by the same stopImmediatePropagation — looked like listeners
weren't attached; (2) computer-tool click coordinates are SCREENSHOT-pixel space (≈×0.82 vs CSS px at
dpr 1.25) — unscaled clicks hit the wrong elements (e.g. the domain link, which stops propagation);
(3) `<script id="lx-nonav">` only suppresses clicks inside search boxes — red herring.
Pipeline order now: restyle.js → polish.js → fix_lumosnav.js (already in showcase source) → extract_site.js.

### DONE — Final polish pass (`polish.js`, canonical last layer)
Injects `<style id="lx-polish">` into every page (350 pages) + fixes light-theme tokens by hex remap:
- **Light-theme consistency fix:** old neon `#ff6a1a`→`#ea6a2c` ember, `#f97316`→`#ff894c`, light
  `--text-soft #8a8a96`→`#75757f` (contrast), light `--blue #3b82f6`→iris `#6f5ded`, + rgba() forms.
  (The original restyle only covered dark-theme hexes — light tokens were missed.)
- **Interaction layer** (all `:where()` low-specificity so page styles win conflicts; wrapped in
  prefers-reduced-motion): CTA hover lift/press + primary shadow; card hover lift (real class list:
  product-card, quick-card, market-card, insight-card, activity-card, lp-card, tcard, dex-mover-card,
  dex-mints-card, pools-card, assets-card, amm-snapshot-card, lx-netcard); light-mode card elevation
  shadows; focus-visible ember ring; branded ::selection; text-wrap:balance on h1-h3; themed thin
  scrollbars; cursor+inset-accent on clickable rows (tr[data-pair]/tr[data-pool]/market+pools tables);
  smooth body theme transition.
Verified both themes; overflow unchanged (the wide markets table overflows at narrow viewports —
PRE-EXISTING, identical with polish disabled; don't chase it).
Pipeline order if regenerating from scratch: restyle.js → polish.js → extract_site.js.

### FINAL DIRECTION — CLEAN, NO EMBEDDED ARTWORK (user decision)
After seeing v2, the user rejected ALL Higgsfield embeds ("too noisy, don't match, pathetic on light
mode") and chose **"Keep it clean"**: typography + spacing + ember/iris palette carry the design; no
image embeds anywhere. All `<style id="lx-imagery">` blocks were stripped from every page
(`strip_imagery.js`, canonical), showcase + dist regenerated and verified in BOTH themes.
DO NOT re-add imagery unless the user explicitly asks. Root cause of the light-mode failure: pages can
run in light theme, and dark cinematic renders cannot be scrimmed into working there.
The 18 renders remain in `C:\LumosCore\assets\` for possible marketing/social use only.

### SUPERSEDED — Premium art v2 (18 renders; replaces the v1 minimal-abstract set)
User rejected the v1 abstract gradients ("too bad"). v2 is bold cinematic 3D (octane-style objects):
`inject_imagery_v3.js` is now the CANONICAL injector (v1/v2 obsolete). Coverage per chain:
- Heroes: landing (ember sun w/ orbital rings), trade (glass-shard staircase), pools (colliding
  liquid-glass spheres) on `.hero`/`.dex-hero`.
- Sliders: per-slide art keyed on `.lumos-promo-slide[data-theme=…]::before` — trade: dex/discover/
  fees/secure; pools: earn/boost/open/speed (8 images, both desktop+mobile carousels).
- Inner pages get an AMBIENT top band (body{isolation:isolate} + body::before z-index:-1, mask-fade):
  dex-asset & asset-overview (glass coin), amm-pool (merging tokens), bridge (light bridge arc),
  rewards (coin cascade), lumos-token (orange gem), wallet (vault sphere), launch-token/review/confirm
  (ignition plume). 25 desktop + 13 mobile pages per chain.
- Landing hero CTAs: ghost buttons get translucent dark bg for contrast over bright art; the restore
  selector for primary must be element-agnostic (`.hero-ctas .btn.primary` — "Launch App" is a BUTTON).
Assets in C:\LumosCore\assets (18 png + jpg 1920w/1280w q80, 50–137KB). ~36 credits; 554 remain.
Nav re-verified: dex row→asset→Back-to-DEX round trip works.

### DONE (v1, superseded) — first Higgsfield hero art
Higgsfield MCP connected mid-project (server prefix `mcp__b67a28ee-…`). Three 21:9 2K renders were
generated with `nano_banana_pro` and wired in via `inject_imagery_v2.js` (base64-embedded 1920w JPEGs,
54–80 KB each, in `<style id="lx-imagery">`):
- `assets/hero-landing.png/.jpg` — ember/gold volumetric light, iris corner, dark center for headline.
- `assets/hero-trade.png/.jpg` — glowing ember ascending chart line, grid, iris counter-glow.
- `assets/hero-pools.png/.jpg` — liquid-silk waves (iris/green/ember).
Applied to Landing/Trade(dex, dex-dark, dex-mobile)/Pools(amm, amm-dark, amm-mobile) across ALL
showcase + dist files. Scrims tuned per artwork; visually verified (light variants theme-sync to dark
at runtime and render fine — an initially blank hero screenshot is just base64 decode paint lag).
Re-run: `node inject_imagery_v2.js --showcase --write <files>` then `node extract_site.js`.
Higgsfield job IDs (2K): 94598f89(landing) 43a7a625(trade) b54a5d0c(pools). ~12 credits used (590 left).
Note: 2K jobs took ~10 min in queue; 1K backups were also submitted (8412e58c, 5ba1c3d4, a9f6ee95) — unused.

## Design tokens (match any generated art to these)
- Fonts: Hanken Grotesk, JetBrains Mono (data). Headings 700–800, tight tracking (-0.03em).
- Bg `#0a0a0b`; surfaces `#131317 / #1a1a1f / #222228`; lines `#26262c / #34343c`.
- Ink `#f6f5f3 / #a5a4ac / #6e6d78`. Accent ember `#ea6a2c`/`#ff894c`, gold glint `#f6b25e`.
  Secondary iris `#8b7bff`. up `#35c07f`, down `#f26257`.
- Vibe: premium, restrained, technical — NOT glowy-orb "AI crypto". Dark, warm-neutral, editorial.

## Tools (durable, in `C:\LumosCore\_tools\`) — run with node
- `lib.js` — read/getContents/writeContents helpers for showcase files (parse `designContents`).
- `restyle.js` — font+color remap. `node restyle.js --showcase --write <files>` (showcase) or
  `--standalone --write <files>` (dist). CRITICAL: re-serialize with `</` → `<\/` (already handled).
- `extract_site.js` — regenerate `dist/` from showcase: `node extract_site.js [chain]`.
- `inject_imagery.js` — inject `<style id="lx-imagery">` per page-type: `--type=landing|trade|pools`.
- `server.js` — static server on :8799 (`node server.js`) to preview `http://localhost:8799/dist/<chain>/...`.
- `check_dist.js` — integrity check over dist.

## Gotchas
- Showcase pages are stored JSON-escaped (`<\/script>`). After JSON.stringify, MUST re-escape `</`→`<\/`
  or the `<script>` tag closes early. Standalone injected scripts use PLAIN `</script>`.
- Bash single-quoted heredocs collapse `\\`→`\`; write JS via the Write/Edit tools, not heredocs.
- MCP `javascript_tool` runs in an isolated world — synthetic `.click()` won't fire page listeners; use
  the `computer` tool (real mouse). Screenshots time out on heavy (10–32MB) pages; use lightweight
  prototype pages or JS overflow checks to verify.

## Backups
- `C:\LumosCore\_backup_orig\` — original (pre-nav-fix) showcase files.
- `C:\LumosCore\_backup_navfixed\` — post-nav-fix, pre-restyle showcase files (revert design here).

## To resume after restart
Say: "Continue LumosCore — generate Higgsfield hero imagery for Landing/Trade/Pools and roll out.
See C:\LumosCore\_tools\HANDOFF.md."
