# LumosCore — Wallet Page: Logic & Features Reference

> **Purpose.** Complete map of every data flow, feature, and helper wired into the Wallet page, so the same logic can be reused (1) in the **Trade** section and (2) when building this page on **other networks** (Aptos, Hedera, Starknet, VeChain, Worldchain, XRPL).
>
> **What is Stellar-only** (skip on other networks): the whole **smart-swap / Soroswap / Aquarius / Soroban** layer and the Horizon/Stellar-SDK signing. Everything else (portfolio, assets, pools, activity, send, receive, classic swap pricing, logo system, theming) is a general pattern — only the *data adapter* changes per chain.
>
> Last updated 2026-07-25. Read alongside `LUMOSCORE_DEV.md` (guardrails/landmines) before editing.

---

## 1. Architecture & build pipeline

- **Static, no framework.** The whole product is finalized HTML/CSS/JS. Source of truth = per-chain **JSON-container** files `lumoscore-<chain>-<desktop|mobile>.html` (each holds many page keys as one big JSON string on a single line).
- **The front end is LOCKED.** We never redesign finalized markup. All real-data/behavior is **injected** by Node "transform" scripts that append a `<style id="...">` + `<script id="...">` block before `</body>` of the relevant page keys. Transforms are **idempotent** (they strip their own previous block by `id` before re-injecting).
- **Transforms (build order matters):**
  1. `_tools/_realdata.js` — dashboard/global real-data layer (prices, TVL, network stats). *(See `lumoscore-realdata.md`.)*
  2. `_tools/_walletdata.js` — **the Wallet page** (portfolio, assets, LP pools, activity, orders, send, receive, logo system, balance fixing).
  3. `_tools/_swapcalc.js` — the **swap popup** (2-step flow, classic pricing, smart-swap).
  4. `_tools/_theme_transition.js` — site-wide light/dark crossfade (View Transitions API).
  5. `_tools/extract_site.js aptos --root` — flattens the aptos JSON container into the servable `dist/` site (this is what `http://localhost:8080` serves).
- **Full build:**
  ```
  node _tools/_realdata.js && node _tools/_walletdata.js && node _tools/_swapcalc.js && node _tools/_theme_transition.js && node _tools/extract_site.js aptos --root
  ```
- **Coding rules inside transforms:** injected *browser* code is ES5 (`var`); Node transform code is `const`/`let`. Single-quote landmine for inline `url()`s: write `url(\x27...\x27)` in the Node string (`\x27` → `'` in the browser). JSON re-serialization must re-escape `</` → `<\/`.
- **Serving/preview:** `serve.js` on **:8080** from `dist/`. The in-app preview can reuse a stale server — verify the right build with `document.getElementById('lx-swapcalc')` or by pointing the tab straight at `http://localhost:8080/lumoscore-wallet.html`.

---

## 2. Gating & identity

The wallet only renders real data when a Stellar account is connected:

- `netOK()` → `localStorage["lumos.network"|"lumos.chain"] === "stellar"`.
- `ME` = `localStorage["lumos.address"]`, must match `^G[A-Z2-7]{55}$`.
- If either fails → `reveal()` (show the static shell) and bail. **On other networks this guard becomes `=== "aptos"` etc. + that chain's address regex.**
- `lxWallet()` = `localStorage["lumos.wallet"]` (freighter/… provider id) — used for signing.

**Test account (Stellar mainnet):** `GAFB7IYPCYZCODQBB5BR5JO45JC4PPVLARUAXQSFHWTLH2KMHPWJ36GD` (175 assets, many LP pools, small spendable XLM). Set `localStorage.lumos.{network,address}` on the :8080 origin, then reload.

---

## 3. Data sources

| Concern | Source | Notes |
|---|---|---|
| Balances, assets, pools, operations, offers, paths | **Horizon** `https://horizon.stellar.org` (`H`) | The one API for all account state on Stellar. |
| Asset/token logos | **stellar.expert** `…/explorer/public/asset?search=CODE` → `tomlInfo.image\|orgLogo` | Flaky IPFS; we now cache the top tokens locally (see §8). |
| USD prices / TVL / network stats | CoinGecko + DefiLlama (via `_realdata.js`) | Dashboard layer; wallet reads the resulting price map. |
| Classic swap rate | Horizon `paths/strict-send` + orderbook | See §7. |
| Smart-swap (Stellar-only) | Soroswap aggregator `api.soroswap.finance` | See §7 + `lumoscore-smartswap.md`. |

**Per-network swap:** each chain needs its own adapter for balances (indexer/RPC), logos (that chain's token list), and pricing (its DEX/router). The *shape* below stays identical.

---

## 4. Boot sequence

`boot()` runs once: `lxNormToast(); wireNavGuard(); wireBalMax(); wireSend(); wireSendValidation(); wireSendAssetPicker(); enhanceSendPre(); wireReceiveAddr(); wireAssetActions(); wireRowMenu(); wireWalletLink(); wireTf(); renderChart("1M"); prep(); load();`

- `prep()` — paints skeletons (`.lx-skel` shimmer) into value/asset/activity/orders slots so there's no empty flash.
- `load()` — one Horizon `/accounts/ME` fetch → fans out to `renderAssets`, `renderLP`, activity, `renderOrders`, portfolio value, and sets the global state described in §5.

---

## 5. Global state (window.*)

These are the contract other modules (swap, send) read:

- `window.__lxHoldings` — array of held assets: `{code, iss, bal, native}`, native first then by balance desc. **Filters out `liquidity_pool_shares`.** Drives every asset picker.
- `window.__lxNative` — total native XLM balance.
- `window.__lxMaxXLM` — **spendable** XLM (total − reserves − selling liabilities). Used by MAX and balance checks; the *displayed* balance uses `__lxNative`.
- `window.__lxLogos` — `{CODE: url}` logo cache (see §8).
- `window.__lxStellarUri` / `STELLAR_URI` — inline Stellar logomark SVG (data URI, 32×32) for native XLM.
- `window.__lxKnownSwap` / `__lxKnownSwap[CODE]=issuer` — issuer map so the swap can rebuild assets by code.
- `window.__lxFeeRate` — 0.008 guest / 0.005 for 250k+ LUMOS holders (fee tier).
- `window.__lxSoro` — set when the current quote is routed through smart-swap (else null).

---

## 6. Wallet panels & flows

### 6.1 Portfolio value
Sum of `bal × priceUSD` across holdings; rendered into `.value-side .value`. Skeleton until priced.

### 6.2 My Assets table (`#assetsTable`)
- One row per holding: painter-proof icon (`.lx-aico`, §8), code, balance, USD value, a deterministic **sparkline** (`sparkFor(code)` — seeded pseudo-random SVG polyline, green/red by trend).
- **Price (24h) cell** = USD price (`p1`) + a **real 24h % change** pill (`.lx-chg`, green `+x%` / red `-x%`) + XLM sub-price. The change comes from `chg24(b)` → Horizon **`trade_aggregations`** (asset/XLM buckets over the last ~26h, first-vs-last avg; native XLM uses XLM/USDC). Loaded **non-blocking** after the table paints (`lxLoadChanges(rows)`, top 18 rows only to bound Horizon calls); the pill is `display:none` until filled, so no empty boxes. *(This replaced the old "no per-asset 24h feed" gap — trade_aggregations is the free feed.)*
- **Row actions** (`QA_ACTIONS`): **Trade on DEX** · **Send** · **⋯** (`.qa-row-btn`). The ⋯ opens the `asset` context menu (`wireRowMenu`, §6.7).
- Asset icons are **38px** (`.asset-id .ico`).

### 6.3 Liquidity Pools table (`#lpPanel`)
- Source: `bals.filter(asset_type==="liquidity_pool_shares")` → for each, fetch `H/liquidity_pools/<id>` → `reserves[]`, `total_shares`.
- Per row: **paired token icons** (`lpIco(code,iss,native)` × 2, overlapping, **32px** each in a 52×32 `.lp-icons`), pool name `CODE / CODE`, your share % (`bal/total_shares×100`), your LP token amount, and reserve amounts. **APR column hidden**; **Pool-price column removed**.
- `assetCode/assetIssuer/assetNative(reserve)` helpers normalize `"native"` vs `"CODE:ISSUER"`.
- `lxHarvestLpLogos()` (called at end of `renderLP`) back-fills any still-missing pool logos from stellar.expert by `(code,issuer)` — but the local seed (§8) now covers the common tokens up front.
- **Self-healing icons (`lxFixLpIcons` / `lxScheduleLpFix`).** Each `.lx-lpico` stores `data-lxcode` + `data-lxnat`, so a reconciler can re-derive the correct logo (native→`STELLAR_URI`, else `__lxLogos[code]`) and force it onto any icon still showing a placeholder. It runs after every `renderLP`, on a bounded interval (~12×400ms ≈ 5s), and on a `MutationObserver` watching the `tbody` for re-renders. **This is the guarantee that a pool logo can never *stay* an orange letter** once its logo is available (seed or late harvest) — fixes the intermittent "logo missing sometimes" race.
- **Row actions** (`LP_ACTIONS`): **Add** · **Remove** · **⋯** → `lp` context menu.

### 6.4 Recent Activity
- Source: Horizon `operations` for the account. `mapOp(o)` → typed row `{kind, type, meta, amt, day, tx, addr}`; `kind ∈ received|sent|swap|lp`.
- Grouped by **day divider**; counterparties link to stellar.expert; icon direction: up/down/swap. Amounts formatted by `amt()` (never scientific notation — e.g. `0.0000004`, not `4e-7`). Type labels use weight 550 (not fully bold).

### 6.5 Open Orders (`renderOrders`)
- Source: account `offers`. Each row = sell/buy pair, price, amount, with **Cancel** (`lxCancel`/`lxCancelAll` → `manageSellOffer amount:0`, signed).

### 6.6 Send flow (finalized modal, wired by us)
- `wireSend()` + `wireSendAssetPicker()` + `wireSendValidation()`.
- Asset picker (`openAssetMenu`) lists `__lxHoldings` with painter-proof icons + balances.
- `validateSend()` checks amount ≤ balance, valid destination `G…`. Submit builds a `payment` (or `createAccount`) op, `lxSign`, submit to Horizon. Close via `.modal-close` (see scroll-lock landmine).

### 6.7 Row ⋯ context menu (`wireRowMenu`)
- Finalized `menus.asset` and `menus.lp` arrays → `showMenu(btn, kind)` builds a `.row-menu` positioned under the trigger.
- Only **Copy issuer/pool address** does something (writes to clipboard + toast); the rest are visual for now.
- **We strip `View transaction history`** from the `lp` menu at runtime (MutationObserver in `_walletdata.js` removes that button as the menu mounts) — feature deferred (§10).

### 6.8 Receive flow
- `wireReceiveAddr()` → `fixReceive()` + `enhanceReceive()`: injects the real address + a QR. Recolored to brand orange (QR corner brackets + Copy-Address gradient, `#ea6a2c`/`#f2954e`).

### 6.9 Balance-label normalization (`fixBalances`)
- Scans `span/div/p/label` for `Balance: <num> XLM` and rewrites `<num>` with `__lxNative` (2–7 dp). Runs on balance load.
- **Excludes `#modalSwap`** — the swap modal's balance is owned by `selectSwap` (abbreviated). Without this exclusion the two writers fought and the swap balance **flashed** on open.

---

## 7. Swap popup (`_swapcalc.js`)

### 7.1 Two-step flow
- **Step 1**: pick From/To assets + amount + live estimate + `Review Swap →`.
- **Step 2**: compact side-by-side **You pay / You receive** summary card (`.lx-swap-summary`, two `.lx-ss-row` columns split by a centered orange flow-arrow; both columns get a 26px center gutter so the arrow never overlaps a value), then the review panel (rate, slippage, swap fee, network fee, price impact, minimum received) + LUMOS fee banner + `← Back` + `Confirm Swap`.
- Toggled by class `#modalSwap.lx-on-step2`. Cloned the finalized Confirm→`_review` (step1) and Cancel→`_back` (step2); `setConfirm(ok)` gates both. `fillSummary()` runs before entering step2.
- **Resets to XLM→USDC on every open** (modal-open MutationObserver): clears inputs, `selectSwap` defaults, `spotRate=null; refreshRate()`.
- **Micro-interactions kept minimal (deliberate):** the center flip button (`.swap-arrow`) does a **single 360° spin on hover** (`@keyframes lxSwapSpin`) — nothing else. Earlier versions (a 180° rotate-and-hold + shadow, and a continuous left-right "nudge" on the step-2 arrow) read as "too much" and were removed. Keep swap-icon motion to one clean rotation.

### 7.2 Asset pickers
- `makeSwapPick(field, sym, withSearch)` replaces the finalized picker with `.lx-swap-pick`. From = `"local"` (your holdings only); To = `true` (searchable **any** Stellar asset via stellar.expert, plus **Add custom asset** by code+issuer).
- `selectSwap(field, holding, skipRate)` sets icon/code, updates the **Balance:** label (`swAbbr`), stores `field.__lxasset`, prevents both sides being the same asset, and (unless `skipRate`) calls `refreshRate()`.

### 7.3 Balance & validation
- `fromBalOf(fa)` = native → `__lxMaxXLM` (spendable) else the holding's `bal`/`heldBal`.
- `checkBal(amt,fa)` → shows "Insufficient …" + `setConfirm(false)` when over balance.
- **Max** button fills `fromBalOf` (floored to 7 dp).

### 7.4 Classic pricing (general — reusable on any chain)
- `refreshRate()` sets `spotRate` from `realRate(from,to)` then refines via Horizon `paths/strict-send` (source_amount 1). `run()` (debounced) computes the destination for the actual amount, applies the LumosCore fee (`__lxFeeRate`), and renders rate / min-received / **signed price impact** (`rawImp=(effRate−sr)/sr*100` → `-x%` red loss / `+x%` green gain).

### 7.5 Smart-swap — **STELLAR-ONLY, exclude on other networks**
- Aggregator: Soroswap `api.soroswap.finance` (Bearer key in `lxSoroKey()`, `?network=mainnet`). Assets as **SAC `C…` contract ids** via `Asset(code,iss).contractId(Networks.PUBLIC)` (`_sacCache`); amounts in stroops.
- Flow: `run()` does `Promise.all([classic strict-send, soroQuote(protocols:["sdex","soroswap","phoenix"], net)])`. Use smart only if `soro.usesSoroban && soro.out > classicOut*1.005 && soro.impact < 10` (impact guard rejects mispriced thin Aquarius pools). When used → `window.__lxSoro` set + a Lumenswap-style `.lx-smart-badge` (icon, "Best rate via Soroswap", green savings pill, Learn-more popover).
- **Known limitation:** Soroswap `/quote/build` rejects `aqua` poolHashes ("Invalid poolHashes string"), so `aqua` is dropped from executable protocols; pure-Aquarius routes quote-but-can't-execute. Executable wins: AQUA→USDC ~+5%, SSLX→USDC ~+21%.
- **⚠ the `sk_` Soroswap key is a secret exposed in client JS** on this static site — rotate if abused.
- Confirm routing: `window.__lxSoro ? soroExecute : lxSwap`. `soroExecute` = build XDR → `lxSign` → `soroSend`. `lxSwap` = classic `pathPaymentStrictSend`, signed.

### 7.6 LUMOS fee tier (brand mechanic — reuse everywhere)
- Guest 0.8%, holders of **250,000 LUMOS** pay 0.5% (`__lxFeeRate`). Promo banner (`.lx-fee-banner`) on step 2 + a **Buy LUMOS** button. Copy: "Trade like a whale 🐋 Hold 250,000 LUMOS and cut your swap fee from 0.8% to just 0.5%."

---

## 8. Logo resolution system (reusable; the per-chain token list swaps out)

Priority order used by `lpIco` / `ilogo` / `actBg` / swap `ssIco`:

1. **Native coin** → inline SVG data URI (`STELLAR_URI`; on other chains, that chain's coin mark).
2. **`window.__lxLogos[CODE]`** — the cache. **Seeded at boot** with brand + logo-less/flaky tokens so they render instantly with no async race:
   - `LUMOS → assets/favicon.png` (brand flame — same mark as the nav logo).
   - `AQUA, SSLX, SHX, yXLM, yUSDC → assets/tokens/<code>.png`, `BLND → assets/tokens/blnd.svg` (downloaded locally; BLND has **no** stellar.expert TOML image, and IPFS logos load too slowly to win the paint race).
3. **Async harvest** (`lxHarvest`, `lxHarvestLpLogos`, `swHarvestPage`) — fills anything else from stellar.expert / on-page `<img>`s. **Guarded** so it never overwrites an `assets/…` local seed (locals always win).
4. **Fallback** → `colFor(code)` colored disc + first-letter (`::after content:attr(data-l)`).

**Painter landmine.** A finalized "logo-painter" over-paints a default USDC `<img>` onto short/empty icon elements. Every custom icon must defeat it: `background:var(--ic/--al)!important` + `::after{content:attr(data-l)}` letter + `img{display:none!important}`.

**Local token assets** live in `assets/tokens/` (copied to `dist/assets/tokens/` — `extract_site` includes `assets/`, so they persist across rebuilds). To add a token: drop `assets/tokens/<code>.png` and add it to the seed map in `_walletdata.js`.

---

## 9. Cross-cutting utilities & landmines

- `amt(n)` — adaptive decimals, **no sci-notation**.
- `swAbbr` / `fmt` — abbreviated vs full number formatting.
- `colFor(code)` — deterministic color from a code hash (icon fallbacks).
- `sparkFor(code)` — deterministic sparkline SVG.
- `esc()` — HTML-escape.
- **Scroll-lock landmine:** opening any finalized modal sets `body.style.overflow="hidden"` inline; only clicking `.modal-close` restores it. After a **programmatic** success, close via `modal.querySelector(".modal-close,[data-close],.close").click()`, never `classList.remove("open")` alone.
- **Theme:** `data-theme` on `<html>` swaps all CSS vars; `_theme_transition.js` wraps the toggle in `document.startViewTransition` for a smooth crossfade.
- **Preview flakiness:** the heavy wallet page sometimes fails to paint in the pane — nudge (`window.scrollBy(0,1);scrollBy(0,-1)`) before screenshotting, and prefer DOM measurement over screenshots.

---

## 10. Intentionally deferred (revisit after Trade section is complete)

These are **left as visual/no-op on purpose** — do **not** treat as bugs:

- **Trade on DEX** (My Assets row action + asset ⋯ menu) — wire once Trade exists.
- **View asset** (asset ⋯ menu) — asset detail page pending.
- **Add / Remove liquidity** (LP row actions) — pending.
- **View pool details** (LP ⋯ menu) — pending.
- *(Removed for now: **View transaction history** in the LP ⋯ menu.)*

When Trade is built, these get pointed at the real Trade/asset/pool routes.

---

## 11. Reuse checklist for the Trade section & other networks

**Trade section (same chain):** reuse §5 global state, §7.1–7.4 swap flow, §7.6 fee tier, §8 logo system, §9 utilities verbatim. Smart-swap (§7.5) applies on Stellar.

**Same page on another network:** keep every pattern; **replace only the data adapter** —
1. Gating (§2): network id + address regex.
2. Data sources (§3): balances/assets/pools/activity from that chain's indexer/RPC; logos from its token list; pricing from its DEX.
3. Native coin logo + `colFor` palette.
4. **Drop the entire smart-swap/Soroban layer (§7.5)** and the Stellar-SDK signing; use that chain's classic swap + wallet signing.
5. Re-point the local token-logo seed to that chain's common tokens.

---

*Build:* `node _tools/_walletdata.js && node _tools/_swapcalc.js && node _tools/_theme_transition.js && node _tools/extract_site.js aptos --root`
*Backups:* working mirror `_FINAL_20260724/`; point-in-time `_BACKUP_20260725_wallet/`.
