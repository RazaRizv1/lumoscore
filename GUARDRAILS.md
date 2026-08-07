# LumosCore — GUARDRAILS (read BEFORE any change)

> This file is authoritative and **locked** (OS read-only). Do not edit, move, or delete it.
> To change it, the user must explicitly ask **and** clear the read-only flag first.
> Read this file at the start of any LumosCore work session, before touching anything.

---

## A. Never break what already works
1. The front end and every previously-fixed behavior are **FINALIZED / LOCKED**. You may only **ADD**; never regress.
2. Before editing an area, note what currently works there. After the change, that list must still be true.
3. Never re-introduce a bug we already fixed. If a fix touches shared code, check everything that code feeds.

## B. Flash-bug check is MANDATORY before calling anything "done"
4. After every change, reload and watch the **full load sequence**, not just the final state.
5. A **flash bug** = any visible swap during load: stale value → correct value, placeholder/letter → logo, skeleton → content, size jump, position jump, wrong number → right number.
6. How to catch it: sample the DOM at ~0 / 300 / 600 / 1000 ms after load and confirm each value appears **once, correct**. If it changes, it's a flash bug — fix it (render correct the first time, or hide until ready).
7. Flash bugs we already fixed (must stay fixed): swap balance precision flash, LP/asset logo placeholder→real, %-change appearing late, icon size jump, chart skeleton spinning forever.

## C. Don't break the injected scripts (this caused the worst damage)
8. `node --check` the transform **and** reload to confirm the browser script actually ran (`window.__lxHoldings` / main state is set) **before** declaring done. A silent parse error kills the entire injected `<script>` — symptoms: skeleton rows, no data, seeds gone.
9. Escaping inside Node `+'...'` strings that become browser JS: regex slash = `\\/` (NEVER `\/`), single-quote in `url()` = `\\x27`. One wrong escape = dead script.

## D. Work in small, verified steps
10. One change → build → verify → next. Never batch many risky edits and build once.
11. When a bug isn't reproducible locally, get the exact repro (account address / URL / viewport) instead of guessing and rebuilding repeatedly.

## E. Data + rendering discipline
12. Horizon endpoints (esp. `trade_aggregations`) rate-limit. Always throttle + retry + host-fallback (`horizon.stellar.org` → `horizon.stellar.lobstr.co`). Never fire floods of concurrent calls.
13. Never overwrite a local `assets/…` logo seed in `window.__lxLogos`; guard every harvest assignment (`!/^assets\//.test(existing)`).
14. Before adding a CSS override, check for an existing finalized rule (`:hover`, base). Beat it with id-specificity + `!important`. Never strip a centering `transform` on hover (causes a jump).

## F. Checkpoints
15. After each verified round, sync `_FINAL_20260724/` **and** the dated backup.
16. Never declare "locked / perfected" until **B** (flash check) and **C** (script-runs check) both pass.

## G. Build & verify commands
- Build: `node _tools/_realdata.js && node _tools/_walletdata.js && node _tools/_swapcalc.js && node _tools/_theme_transition.js && node _tools/extract_site.js aptos --root`
- Syntax check: `node --check _tools/<file>.js` before every build.
- Serve/verify: `http://localhost:8080/lumoscore-wallet.html` (set `localStorage.lumos.network=stellar` + a real `G...` address, reload).

---
_Related: `LUMOSCORE_DEV.md` (dev landmines), `WALLET_LOGIC.md` (wallet spec)._
