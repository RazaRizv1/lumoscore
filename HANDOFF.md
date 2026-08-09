# LumosCore — Handoff

**Written 2026-08-07, end of the deployment session. Read this before touching anything.**

LumosCore is a **live** Stellar DeFi application at **https://lumoscore.com**, running on **mainnet
with real funds**. It is not a prototype. People can lose money if this breaks.

---

## 0. First five minutes

Do these before your first edit, in order:

1. Read `C:\LumosCore\GUARDRAILS.md` (locked, read-only) and `LUMOSCORE_DEV.md`.
2. Read `CLAUDE.md` in the repo root.
3. Run `git log --oneline -25` — every commit message explains the *root cause*, not just the change.
   The recent history is the best map of how this codebase actually fails.
4. Run `git status --short`. It should be clean. If it is not, ask before doing anything.

---

## 1. Current state — what is working

Do not "improve" any of this without being asked. It was hard-won.

| Thing | State |
|---|---|
| `https://lumoscore.com` | Live, desktop **and** mobile, SSL, apex + `www` |
| Clean URLs | `/trade/stellar/<CODE>-<ISSUER>`, `/pools/stellar/<A>/<B>`, etc. |
| SEO / AEO / GEO | Edge-rendered meta, canonical pinned to apex, sitemap generated live from Horizon |
| Admin panel | `lumoscore-admin.pages.dev`, behind Cloudflare Access (email one-time PIN) |
| Soroswap | Key rotated, stored as a Cloudflare **Secret**, proxied server-side |
| Wallet connect | Network screen → wallet list, works from any page, correct logos |
| Deploys | Push to `main` → auto-deploy, ~30s |
| Licence | MIT |

**Two Cloudflare Pages projects, two GitHub repos:**

- `lumoscore` ← **public** repo `RazaRizv1/lumoscore`, build output dir `dist`, **no build command**
- `lumoscore-admin` ← **PRIVATE** repo `RazaRizv1/lumoscore-admin`, build output dir **empty**
  (the repo root *is* the build)

The admin repo must stay private. Its protection is that its files are not on any public server.

---

## 2. How the build works

This is **not** a normal framework app. Understand this before editing.

The design ships as a few very large HTML **container** files, each holding every page of the site as
a JSON blob. The build is a pipeline of ~100 small, **idempotent** transforms in `_tools/` that rewrite
those containers in place, followed by an extraction step that splits them into one file per page.

```
lumoscore-aptos-desktop.html      design containers (337 MB, gitignored — NOT in the repo)
lumoscore-aptos-mobile.html
        |
        |  _tools/*.js            transforms: data layers, theming, SEO, routing, fixes
        v
_tools/extract_site.js            splits into pages, rewrites links, emits
        |                         _redirects / _headers / _routes.json / functions/_middleware.js
        v
dist/                             the deployed site (committed)
```

### Commands

```bash
cd /c/LumosCore                       # Bash resets cwd between calls — always cd first

node _tools/<transform>.js --write    # run one transform (most need --write)
node _tools/extract_site.js aptos --root    # build public site  -> dist/
node _tools/extract_site.js aptos --admin   # build admin site   -> dist-admin/
node _tools/predeploy_check.js              # the deploy gate
```

`_middleware.js` and `_routes.json` are **generated** from the `ROUTES` table in `extract_site.js`.
Never hand-edit them.

### Local testing

```bash
node serve.js 8080                    # mirrors production: same _redirects, same device selection
npx wrangler pages dev dist           # the REAL Cloudflare runtime — use this for anything routing
```

`serve.js` is close but not identical. Some failures only appear under `wrangler pages dev`:
`.html` → extensionless 308s, `_routes.json` coverage, Functions execution.

---

## 3. Verification discipline — read this twice

**Every serious failure in this project came from believing a change worked when it had not.**

### 3.1 Transforms silently no-op

Several transforms only **insert** their `<style>` or `<script>` when it is absent:

```js
if (h.indexOf('id="lx-foo-css"') < 0) { ...inject... }     // BAD: edits never reach existing pages
```

Edit the constant, re-run the transform, and it reports success while changing nothing. This bit
`restyle_dexstats.js` and `_wallet_realimg.js` on the same day.

**Rule:** after running a transform, grep the *built* file in `dist/` for a string unique to your
change. If it is not there, the transform no-opped — fix the guard to **replace** the existing block,
not skip it.

### 3.2 Compare content, not hashes

Device serving was once reported as "verified" because desktop and mobile responses differed. They
differed because **mobile was serving a 404 page** — the entire mobile site was down. A hash diff
proved only that two things were not identical, which was worthless.

**Rule:** assert on something meaningful — a `<title>`, a known number, an element that must exist.

### 3.3 Deploys roll out unevenly

For ~60s after a push the same URL can answer differently from different edge nodes (measured
5/8, then 8/10, 9/10, 10/10).

**Rule:** loop ~10 requests with a cache-busting query and require 10/10 before calling it done.
A single curl straight after pushing proves nothing in either direction.

### 3.4 A 200 does not tell you which build is live

Verify by fingerprinting: grep a string that only exists in your new build, compare live vs `dist/`
vs `git show HEAD~1:<file>`.

### 3.5 Windows

- `pkill -f serve.js` does **not** reliably kill. Verify with `Get-CimInstance Win32_Process` and
  compare `CreationDate` against file mtime. Kill with PowerShell `Stop-Process -Force`.
- Stale dev servers have produced false results three separate times.
- Filenames are case-insensitive here and **case-sensitive on Cloudflare**. `Freighter.png` worked
  locally and would have 404'd in production.

---

## 4. Landmine catalogue

Real bugs from this codebase. They repeat in new forms.

### 4.1 Pattern matching at the wrong scope

- **`.gitignore`**: `lumoscore-*-mobile.html` with no leading `/` matched at *every* depth and
  excluded `dist/lumoscore-*-mobile.html` — all 16 built mobile pages. The deployed site had no
  mobile pages and **every route 404'd for every phone**, while desktop was perfect. The leading `/`
  is load-bearing.
- **`_routes.json`**: `/lumoscore-*` only matches at the **root**, so `/trade/lumoscore-dex-asset.html`
  reached no include rule, Functions never ran, and the middleware's 301 never fired. Now `/*` with
  static paths excluded.

**Rule:** when a redirect or guard "isn't working", check whether the code ever *ran* before debugging
its logic.

### 4.2 CSS cascade position

Container/media queries add **no specificity**. A rule written *before* the base rule loses. An entire
responsive type ramp was dead CSS because it sat above the base `.stat-cell` rules. Overrides go
**last**, and that ordering is load-bearing — comment it.

### 4.3 Competing painters and ownership markers

The design ships its own JS that repaints tables, icons and rows. Our layers fight it.

- The exchanges re-assert guard tested for `.wallet-cell` — **a class the design's mock rows also
  use** — so fabricated rows read as "ours" and were left on screen. Rows now carry `data-lxda`.
- **Rule:** an ownership marker must be something the other side cannot also produce. A shared class
  name is a coincidence, not a marker.

### 4.4 Event capture order

Capture runs **window → document → target**. The design registers `document`-capture listeners early.
The real wallet connector was bound on `document` and lost every click to the design's demo flow,
which navigates — clicking a wallet just reloaded the page. It is now bound on `window`.

**Rule:** if a handler seems not to fire, test by blocking the event at window-capture. If that stops
the behaviour, it is ordering.

### 4.5 The design's MOCK data can reach real pages

`makeExchanges()` builds rows from a hardcoded `WALLETS` array of **Ethereum** addresses priced in
APT/USDC. One click on an unowned pager put fabricated trade history on a live Stellar asset page.

**Rule:** any design control we have not explicitly claimed can surface fake data. Treat unowned
pagers, tabs and filters as hostile.

### 4.6 Relative navigation

The app navigates with `location.href="lumoscore-x.html"`. Under clean URLs that resolves against the
current depth and 404s. Anything that redirects **by filename** breaks at depth, and breaks entirely
on the admin origin (which contains only admin pages).

**Rule:** absolute paths only.

### 4.7 Escaping levels

Writing patches through JS template literals or heredocs eats one backslash level. Apostrophes inside
single-quoted transform strings terminate them (this broke a file today). Prefer the Edit tool, or a
`.js` patch file run with `node`, over inline shell quoting.

---

## 5. Do not touch

- **`mail` DNS record** — the MX points at `mail.lumoscore.com`. Deleting it stops email **silently**,
  with no bounce. `api` (Railway) and `staging` (Vercel) are unrelated services; leave them.
- **`.gitignore` container patterns** — see 4.1. Removing a leading `/` takes the mobile site offline.
- **`dist-admin/` in the public repo** — it is gitignored on purpose.
- **`predeploy_check.js`** — never bypass. It blocks admin pages and secrets reaching the public build.
- **Secrets** — the user pastes them into Cloudflare. Never into a file, never into chat, never into
  git. `SOROSWAP_KEY` is a Cloudflare **Secret** (not Plaintext) in the `lumoscore` project.
- **Wallet signing** — the app is non-custodial. The user signs every transaction in their own wallet.
  Never build anything that could sign, and never execute a transfer.

---

## 6. Open items

Priority order. None are urgent; the site is in a good state.

### 6.1 LOBSTR cannot connect on mobile — CODE DONE, needs a WalletConnect Project ID

Fixed 2026-08-09. The adapter in `_tools/_wallet_realconnect.js` now branches: extension API when one
is actually there, WalletConnect when it is not. Detection is deliberately separated from the call, so
a user **rejecting** the extension surfaces as a rejection instead of escalating into a QR modal.

Signing was wired too, because connecting without it would have left phone users able to browse but
not trade. `window.__lxWcSign` / `window.__lxWcActive` live in `_wallet_realconnect.js`, and all seven
signing paths route through them: `_walletdata`, `_swapcalc`, `_ammdata`, `_cctp`, `_dexassetdata`,
`_launchpad`, `_lumostoken`. That also closed a latent bug — four of those had no `walletconnect`
branch at all and would have fallen through to **Freighter with the wrong account**.

**One thing is still required: paste a free Project ID from cloud.reown.com into `WC_PROJECT_ID`**
(line ~27), then re-run `_wallet_realconnect.js` and `extract_site.js`. Until then every WalletConnect
path stays off and behaviour is byte-identical to before — LOBSTR still says "not detected" on a phone.
The ID is a public client identifier (it ships in the page JS by design), so restrict it to
`lumoscore.com` in the Reown dashboard rather than treating it as a secret.

`lumos.transport` (`ext` | `wc`) is the new contract. Absent or `ext` means the extension path, so every
session that predates this keeps working unchanged. Disconnect clears `lumos.wallet`, which turns the
WalletConnect route off on its own.

**Not verified:** no phone and no Project ID, so a completed LOBSTR mobile sign-in and a WalletConnect
signature have never been executed end to end. What was proved is that with an ID present and no
extension, the code loads the full WalletConnect stack instead of reporting "not detected".

Freighter and Rabet are extension-only; their "not detected" on mobile is **correct**.

### 6.2 No confirmed end-to-end wallet connection

No Stellar extension was available in the previous session's test browser. The connect handler, error
paths and post-connect redirect are verified; a **completed sign-in is not**. Needs a human with
Freighter or LOBSTR.

### 6.3 Disconnected-journey sweep

Read-only pages were ungated late in the session, so being logged out on them is newly reachable.
**Three bugs already came from this gap.** In-page connect CTAs (Add liquidity, Buy/Sell) on
Trade-asset, pool detail, LUMOS and MCP have never been walked while logged out.

### 6.4 Holders tab pager

Same shape as the Exchanges pager that was serving the design's mock rows (fixed in `070b07d`).
Never checked. Assume it has the same defect until proven otherwise.

### 6.5 Cosmetic — wallet icon mask

`.lxw-ico` is `border-radius:50%` with `object-fit:cover`, clipping the corners of square wallet app
icons. Needs roughly `12px`. **Trap:** `_wallet_realimg.js` only *inserts* its `<style id="lx-wl-css">`
when absent, so editing `STYLE` never reaches pages that already have it — it must replace the block.
Several attempts failed on exactly this.

### 6.6 Smaller

- 21 wallet-logo paths are referenced but absent; they fall back to lettered circles by design.
- `www.lumoscore.com` serves rather than redirecting to the apex. Canonical already points at the
  apex, so this is tidiness, not SEO.
- Trade filter thresholds (10/100/1000/10K XLM) are meaningless for micro-caps like LUMOS, whose
  largest recent trade was 0.192 XLM. Scaling them per-asset is a possible improvement.

---

## 7. Git and deploys

- Commit with an explicit identity — **neither repo has one configured**:
  ```bash
  git -c user.name="RAZA" -c user.email="answerlynfts@gmail.com" commit -m "..."
  ```
- Push to `main` deploys automatically (~30s), then the edge rollout takes another ~60s.
- The public repo does **not** contain the source containers (337 MB, gitignored). GitHub is a
  **deployment mechanism, not a backup**. Keep `_BACKUP_*` folders and an off-machine copy.
- Write commit messages that explain the **root cause**. This history is the project's memory.

### If something breaks

```bash
git log --oneline -20          # find it
git revert <sha>               # undo cleanly, keeps history
```

Every change is revertible. Prefer revert over patching a live bug under pressure.

---

## 8. Working style the user asked for

- **Verify before claiming.** Say what was checked and what was not. If a wallet or device could not
  be tested, say so plainly rather than implying full coverage.
- **Don't hand work back.** If something cannot be done, say why in one sentence and offer the nearest
  thing that can. Do not ask the user to do a task twice.
- **Fix the reported problem**, not the nearest adjacent one. When a stat row was clipped, reflowing
  it to two lines "fixed" the clipping and broke the intent.
- **Ask on design decisions**, decide on technical ones.
- Do not change working behaviour as a side effect. Scope creep on a live financial app is how money
  gets lost.
