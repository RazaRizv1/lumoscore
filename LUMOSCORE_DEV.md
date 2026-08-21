# LumosCore — Development Guide & Guardrails

**Read this before touching anything.** It exists because changes kept breaking the finalized front end. Last updated: 2026-07-24.

---

## 0. GOLDEN RULES (do not violate)

1. **The front end is FINALIZED and LOCKED.** Do NOT redesign, restyle, or "improve" existing UI. The canonical copy is `C:\LumosCore\_FINAL_20260724\` (see `LOCK.md` there).
2. **NEVER create new popups, modals, buttons, or UI.** The finalized site already has every flow (Send/Receive/Swap, Review-order popup, connect modal, network chooser, etc.). If a button "doesn't work," it almost always has a **finalized delegated handler** — find and use it. Do not build a replacement.
3. **Only ADD real data into existing elements.** The job is to fill finalized elements with live values — nothing else.
4. **VERIFY VISUALLY before claiming a fix.** Take a screenshot and LOOK. Do not claim "fixed" from DOM numbers alone. (This caused most of the frustration.)
5. **Test with a REAL connected wallet's data**, and be clear when numbers come from a test account. Never quote test-account numbers as if they were the user's.
6. **After any build, the user must HARD-REFRESH** (Ctrl+Shift+R) or use Incognito. "Still broken" is often a cached page.
7. **NO FLASH OF OLD DATA (verify this on EVERY change).** The finalized page paints its own sample/default values first; our injected script only runs later (it's near `</body>` and most logic waits for `DOMContentLoaded`). So any element we overwrite (chart, portfolio total, tables, active tab, activity, prices) will show the **finalized/old value for a split second, then "jump" to the real one** — the user WILL notice and report it. This is not optional to check. See §5a for how to prevent AND how to verify.

---

## 1. What this project is

Static multi-page HTML showcase (no framework, no bundler). One "source of truth" per page lives inside big JSON-container HTML files; `dist/` is the built, browsable site.

- **Source files:** `lumoscore-aptos-desktop.html` / `-mobile.html` (the single multichain base) + 6 other chains. Each is a JSON blob of page keys.
- **Build output:** `dist/` (served over `http://localhost:8080`).
- **Single version:** Aptos is the base; a runtime engine re-skins it to the connected network (Stellar, XRPL, …). The built site lives at the **dist ROOT** (no per-chain subfolder).

---

## 2. Build & serve

```
# after editing any _tools/*.js transform:
node _tools/<transform>.js
node _tools/_nofollow.js                      # ALWAYS after any transform that emits <a> tags
node _tools/_heromono.js                      # ALWAYS LAST of the style transforms
node _tools/extract_site.js aptos --root      # builds to dist/ ROOT (the --root flag matters)
node _tools/predeploy_check.js                # blocks on both of the above being out of order

# serve locally (wallets need http://, not file://):
node serve.js            # -> http://localhost:8080   (or double-click "Start LumosCore.bat")
```

Wallet browser extensions (Freighter/Rabet/etc.) **do not inject on `file://` pages** — always use `http://localhost`.

---

## 3. The real-data layer (the ONLY thing we add)

Two transforms inject `<script>`s that fill finalized elements with live data. **Stellar-only** (runs only when `localStorage.lumos.network`/`lumos.chain === "stellar"` and a valid `G…` address is present). Other networks keep sample data.

### `_tools/_realdata.js` — Dashboard (`lumoscore-home`)
- Sources: **CoinGecko** (XLM price, 24h vol, market cap), **DefiLlama** (Stellar TVL), **Horizon** `/trades` (live activity feed).
- Network-stats cards: rebuilds `.status-row` (network card + TVL / Market cap / Volume / Price). "Assets"→TVL, "Pools"→Market cap (exact counts need 60+ API calls — not viable).
- Injects a `<style>` forcing `.status-row` grid to stretch (see §5).

### `_tools/_walletdata.js` — Wallet (`lumoscore-wallet`)
- Reads the **connected `G…` address** and fills, from **Horizon** `/accounts/{addr}`:
  - Address, **Total portfolio** (every holding priced in XLM via `/order_book` bids → real XLM + USD), My Assets (`#assetsTable`), Recent Activity (`/operations`, grouped by day), Open Orders (`/offers` → `.orders-block`), and the `.insight-card` summary cards (Open Orders count, Liquidity Pools count).
- Loading **skeletons** show first (never blank), then real data.

### What is REAL vs REPRESENTATIVE (be honest — do not fake)
| Real | Representative (no free data source) |
|---|---|
| Address, XLM balance, all token balances | Portfolio 7-day trend line (no history feed) |
| Portfolio total (XLM + USD, priced via orderbooks) | Per-asset 24h % change |
| Prices for XLM & priced assets | "Top Mover · 24h" card |
| Recent activity (real ops) | Per-asset 7-day sparkline (varied but decorative) |
| Open orders (real offers), pools count | — |

---

## 4. LANDMINES that broke things before (avoid these)

1. **The logo-painter.** A site script over-paints token logos onto short/empty elements (`.status-pill` containing a token symbol, `.ico`, `.max`, etc.), stripping their `.lbl`/`.val`. **Fix pattern:** either rebuild the element's innerHTML wholesale (dashboard cards), or paint your own via CSS `background:var(--ic)!important` + `::after{content:attr(data-l)}` which the painter cannot clear (used for the XLM Stellar-logo icon).
2. **The multichain re-skin.** A `MutationObserver` swaps "Aptos"→"Stellar", "APT"→"XLM" in text/logos. Mark elements you fully control with `data-lx-noswap`. Run stat updates immediately so the painter never sees the pre-skin "APT".
3. **`.status-row` is `display:grid`, not flex.** `flex:1` does nothing. To make cards fill, override the grid: `grid-template-columns:auto 1fr 1fr 1fr 1fr !important`.
4. **`stopPropagation` blocks finalized handlers.** The finalized Send/Swap/Receive buttons use **document-level delegated listeners**. Adding your own listener with `stopPropagation` kills them. Don't wire those buttons at all.
5. **Skeletons destroying anchors.** `prep()` replaced `.activity-row`'s parent innerHTML → the later renderer couldn't find `.activity-row` → activity stayed empty. **Cache the container** (`window.__lxAct`) before replacing, or target a stable class (`.activity-block`). Same risk for anything found via a child you then delete.
6. **Headless screenshots race async fetches.** `--virtual-time-budget` captures before `fetch()` resolves → looks like mock. Verify with the **browser pane + a real `setTimeout` wait + DOM read**, or a real-time screenshot.
7. **Testing address.** Set a real active `G…` account in `localStorage.lumos.address` to test; the whale account `GAFB7IYPCYZCODQBB5BR5JO45JC4PPVLARUAXQSFHWTLH2KMHPWJ36GD` is handy but its numbers are NOT the user's.
8. **Backslashes are eaten on the way to the browser.** Every `_tools/*.js` transform holds its browser code inside a JS template literal, so `\s` / `\d` / `\.` arrive with the backslash *stripped*: `/[\s,]+/` ships as `/[s,]+/` and silently matches nothing. No error, no crash — the feature just quietly does nothing. **Write every escape doubled (`\\s`), or avoid the regex** (`svg.viewBox.baseVal` instead of parsing the attribute; `parseFloat` instead of `/^\d+$/`). `node --check` CANNOT catch this: it validates the transform, where the escape is still intact. `_ammdata.js` now aborts the build if its emitted region contains a single-backslash escape — copy that guard into any transform you extend. Shipped four separate times before the guard existed.
9. **Writing a container back requires re-escaping `</` as `<\/`.** The page JSON sits inside a `<script id="designContents">` tag, so a plain `JSON.stringify(json)` writes a literal `</script>` into the middle of it and the container is truncated on the next read. The root `lumoscore-*.html` containers are **gitignored — there is no undo**. Always write `JSON.stringify(json).split('</').join('<'+String.fromCharCode(92)+'/')`, which is what `lib.writeContents` and every transform now do. (Recovery, if it happens: nothing is lost, the escaping is. Find the true end of the JSON by brace-scanning with string/escape awareness, re-parse, re-serialise with the escaping.)
10. **A tap is not a click on a handset.** The phone does not deliver the click the design's handlers wait for, which is why controls that work in the browser pane do nothing on a real device — and why a pane check alone never catches it. Two remedies: if the design's own click logic is sound, `preventDefault()` the `touchend` and call `el.click()` so the design stays authoritative (needed for the Pool Activity metric menu — driving the chart ourselves left the design's stale state rewriting the button's label back). If the design's state is *already* stale, do the switching yourself from window capture. Either way, guard against scrolls: a `touchend` only counts as a tap if the finger stayed within ~12px for under 600ms, or a swipe ending over the bottom nav navigates.
11. **A dead transform can still be running in the page.** Every `_tools/*.js` transform ever run left its `<script id="…">` baked into the gitignored containers, and it keeps running forever — the transform is not the code, the container is. `_pagination.js` injected an `lx-txpage` script that faked 137 transactions by cloning the design's mock rows; long after `_ammdata.js` started filling the same tbody with real Horizon data, that script was still wiping the tbody on every Prev/Next click, re-creating `.controls` from scratch (destroying our listeners) and writing its fake count over the real one. Symptom: **the fix verifies clean locally and fails on production**, because which of the two rival scripts wins is a timing race. Before building on top of a section, grep the container for other `<script id=` blocks that touch it; if one is obsolete, **turn its transform into an idempotent stripper** rather than trying to out-run it — hiding the `<script>` element does nothing, it has already executed.
12. **Desktop coordinates don't exist on the phone.** The design injects its chart svg at runtime: `1000x280` with axis labels at `x="996"` / `y="278"` on desktop, `400x220` with labels at `x="396"` / `y="218"` on mobile. Anything selecting or positioning by literal coordinate works on one layout and silently no-ops on the other. Derive from `svg.viewBox.baseVal` and select by *relative* position (`x >= W*0.9`). Never `setAttribute("viewBox", …)` to normalise it — that rescales the design's own labels, which is a worse bug than the one you're fixing.

---

## 5. How to VERIFY a change (mandatory)

1. Rebuild (`node _tools/<t>.js && node _tools/extract_site.js aptos --root`).
2. Serve dist with a `localStorage`-injected real `G…` address (see the throwaway `_serve2.js` pattern in git history), OR set it in the browser pane and reload.
3. **Take a screenshot and LOOK at it.** Confirm the specific thing visually.
4. For layout: measure `getBoundingClientRect()` — e.g., cards fill when `row.right - lastCard.right ≈ 0`.
5. Only then say it's done — and tell the user to **hard-refresh**.

## 5a. NO-FLASH-OF-OLD-DATA rule (mandatory on every change)

**Why it happens:** the finalized inline scripts render sample/default values during HTML parse (before first paint). Our `lx-*` script runs last and, if it waits for `DOMContentLoaded`, only replaces those values AFTER the first paint — so the user sees the old value flash, then it snaps to the real one.

**How to PREVENT (pick per case):**
- **CSS gate (most robust):** hide/skeleton the element until our code owns it — `#el:not(.lx-ready){visibility:hidden}` and add `.lx-ready` in the SAME synchronous statement that writes our content (e.g. `el.classList.add("lx-ready"),el.innerHTML=<skeleton>`). CSS in our injected `<style>` is parsed before first paint, so the finalized value never shows. This is what the hero chart uses (`#heroChart:not(.lx-chart-ready){visibility:hidden}`).
- **Render synchronously at parse time**, not on `DOMContentLoaded`: call the initial render right before the `if(document.readyState…)boot()` line (all its `function`/`const` deps are already declared by then), and have `boot()` skip re-rendering if it already ran (guard on the marker class). The element it targets is earlier in the body, so it exists.
- Or reuse the existing `body:not(.lx-wd-ready) …{visibility:hidden}` pattern (already hides sub-value, `.meta`, tab counts) for anything that should stay hidden until `reveal()`.

**How to VERIFY (do this every time):** rebuild → reload the wallet page and WATCH the first moment. The fixed element must go **blank/skeleton → real value**, and must NEVER show the finalized/old value. Confirm the CSS gate exists (`getComputedStyle` / scan `document.styleSheets`), that the marker class is added in the same tick as the content, and that the active state (e.g. which tab is highlighted) is correct from the very first frame. If you can't catch the split-second visually, prove the invariant: "finalized content is `visibility:hidden` until the class is added, and the class is only added together with our content."

---

## 6. File map

| File | Purpose |
|---|---|
| `lumoscore-aptos-desktop.html` / `-mobile.html` | Source (JSON container) — the single multichain base |
| `dist/` | Built site (served at localhost:8080; lives at ROOT) |
| `serve.js` / `Start LumosCore.bat` | Local http server (needed for wallets) |
| `_tools/extract_site.js` | Builds source → dist (`--root` = dist root) |
| `_tools/_mc_engine.js` + `_multichain.js` | Runtime network re-skin + in-`.lxw`-modal "Choose a network" |
| `_tools/_wallet_realconnect.js` | Real wallet connect adapters + connecting-step animation |
| `_tools/_wallet_gate.js` / `_wallet_header.js` / `_authgate.js` | CTA gating / header sync / auth gate |
| `_tools/_realdata.js` | **Dashboard real data** |
| `_tools/_walletdata.js` | **Wallet real data** |
| `_tools/_theme_transition.js` | **Site-wide smooth light/dark theme transition** (all pages; run before extract) |
| `_FINAL_20260724/` | LOCKED canonical copy + `LOCK.md` |

---

## 7. When something "still looks broken"

Before changing code: **(a)** confirm the served build actually has the fix (`curl localhost:8080/<page> | grep <marker>`); **(b)** hard-refresh / Incognito to rule out cache; **(c)** screenshot to see the real state. Most "still broken" reports were stale cache, not code.

---

## 8. Global working agreement (applies to ALL work)

### Workflow
- **Plan before implementing.** Outline the approach and **wait for confirmation** before writing code. Do not start until the plan is approved.
- **Work in small increments.** Make the smallest reasonable change, verify it, then continue. Never batch large changes.
- **Ask before assuming.** If requirements are ambiguous, ask — don't guess. (Guessing is exactly what broke things repeatedly.)

### Verification loop (mandatory — do not skip)
Every change follows this and is only presented once it passes:
1. Plan the code change.
2. Plan the verification — describe how you'll prove it works.
3. Implement.
4. **Verify.** For this project there is no unit-test framework, so verification = **build → serve → set a real `G…` address → screenshot and LOOK + read the DOM** (see §5). That IS the test; treat it as non-negotiable.
5. If anything fails, fix and re-verify. Repeat until it passes.
6. **Only present the result once verified.** Never deliver unverified work. Goal: zero back-and-forth — the user should only see working, checked results.

### Code style
- Prefer `const`; use `let` only when reassignment is needed; **never `var`** in new Node/transform code.
  - *Caveat:* the strings injected as **in-page browser scripts** historically use ES5 `var` for broad wallet/browser compatibility — match that existing style inside those injected snippets, but use `const`/`let` everywhere else.
- **Follow existing project conventions.** Read neighbouring files before writing new ones; match their idioms, naming, and structure.

### Git
- Clear, concise commit messages: imperative mood, < 72 chars.
- Never commit secrets, credentials, or `.env` files.
- Never push directly to `main`.

### Don'ts
- Never run destructive commands (`rm -rf`, `Remove-Item -Recurse -Force`, `rd /s /q`, etc.) on any directory **outside** `C:\LumosCore`.
- Never run database migrations without explicit confirmation.
- Never modify `.env` files or environment variables directly.
- Never install global packages without asking.
- Never add a dependency without first discussing why it's needed.
- Never push directly to `main`.
- Don't refactor code outside the current task's scope unless asked.
