# Adding XRP Ledger — capability map and briefing

**Status: planning only. Nothing here has been built.**

This is the document to hand over when the XRPL work starts. It deliberately does NOT describe what
each page looks like or what each button does — Claude Code can read that from the code, and the code
is never out of date. Documents that restate behaviour rot silently: on 2026-09-03 the "24H" columns
were not 24h, `launchTokens()` read a localStorage key nothing has ever written, and `renderTrending`
threw on an upstream rate-limit. A page description written a month earlier would have called all
three correct.

What is written down here is the part that cannot be read out of the code: **what XRPL's equivalent of
each Stellar primitive is, where there is no equivalent, and which decisions are still open.**

### How confident is this document

Everything under "ours" was measured in this repo on 2026-09-03 and is reliable.

Everything under "XRPL" is from general knowledge and is marked:

- **[C]** confident — core, long-standing ledger behaviour
- **[V]** needs verification before anyone relies on it — version-, amendment- or provider-specific

Do not let a **[V]** claim reach code without checking it against current XRPL docs. Several of them
decide whether a whole feature is possible.

---

## 0. The decision that comes first

Only **7** of our routes are network-scoped today (`/trade/stellar/:asset`, `/pools/stellar`,
`/account/stellar/:id`, …). Everything else — `/wallet`, `/dashboard`, `/launchpad`, `/rewards`,
`/bridge` — has no network in the path at all.

So before any integration work, one thing has to be settled:

**Option A — network in the path.** `/xrpl/wallet`, `/xrpl/trade/:asset`. Explicit, bookmarkable,
SEO-separable, no ambiguity about which chain a page is showing. Costs a routing change across ~44
pages and a redirect strategy for the existing un-scoped URLs.

**Option B — one set of routes plus a network switcher**, with the active chain in app state.
Cheaper to reach, but every page becomes conditional, the wallet connection has to be per-network,
and a shared URL no longer says which chain it meant.

**Recommendation: A.** The data layer already differs per chain in ways that cannot be hidden (see
§3), so the pages will end up branching regardless — better to have that visible in the URL than
implicit in state. It also keeps Stellar pages working untouched while XRPL is built alongside.

This decision changes almost everything downstream. It should be made before anything is written.

---

## 1. What we would be porting

44 unique pages, 98 built. The features that carry real network coupling:

| Feature | Pages | Depth of coupling |
|---|---|---|
| Trade (market table + asset page + swap/limit) | dex, dex-asset | **deep** |
| Liquidity pools | amm, amm-pool | **deep** |
| Wallet (balances, send, trustlines, activity) | wallet | **deep** |
| Launchpad (token issuance) | launch-token/review/confirm | **deep** |
| Account explorer | account | medium |
| Dashboard (activity feed, network stats, trending) | home | medium |
| Rewards | rewards | medium |
| Bridge (Circle CCTP) | bridge | **may not port at all** — see §4 |
| Blog, docs, support, admin, legal | ~20 pages | none — chain-agnostic |

Roughly half the pages need no network work whatsoever.

---

## 2. Primitive-by-primitive map

| Ours (Stellar) | Used by | XRPL equivalent | Risk |
|---|---|---|---|
| Trustline (`changeTrust`, limit, balance) | wallet, launchpad, swap | **[C]** Trust lines (`RippleState`, `TrustSet`), with limits and flags | Low — closest mapping in the whole list |
| Asset = `CODE-GISSUER` | everywhere | **[C]** currency code + issuer account | Low, but currency codes are 3-char OR 40-char hex — our `[A-Za-z0-9]{1,12}` validators will reject valid XRPL assets |
| Base reserve + subentries | wallet affordability checks | **[C]** account reserve + owner reserve | Low; **[V]** the current XRP amounts differ from Stellar's and have changed by amendment |
| AMM pools, `liquidity_pool_shares` | pools, rewards | **[C]** native AMM with LP tokens (XLS-30) | Medium — pool identity, fee model and deposit/withdraw semantics differ |
| Order book | trade, limit orders | **[C]** native DEX offers (`book_offers`, `OfferCreate`) | Low — XRPL's DEX is older than Stellar's |
| Path payments | swap routing | **[C]** pathfinding (`path_find` / `ripple_path_find`) | Medium — different call shape and trust semantics (rippling) |
| `home_domain` + SEP-1 `stellar.toml` | asset metadata, verification, our whole toml | **[V]** account `Domain` field exists; an `xrp-ledger.toml` convention exists but is **not** SEP-1 and is used differently | **HIGH — see §4** |
| `trade_aggregations` (OHLC) | charts, 24h volume/high/low/change | **[V]** believed to have **no** rippled/Clio equivalent | **HIGHEST — see §4** |
| Issuer lock (`set_options`, master weight 0) | launchpad, mint proof, toml | **[C]** blackholing: `asfDisableMaster` + regular key set unusable | Medium — same intent, different mechanics and different proof |
| Amount precision (stroops, 7 dp) | all formatting, all validators | **[C]** XRP is 6 dp (drops); IOUs are 15-significant-digit decimals | Medium — our formatters and the sub-1e-7 price handling assume Stellar |
| Wallets: Freighter, Albedo, LOBSTR, Rabet, xBull, WalletConnect | connect, sign | **[C]** entirely different set — Xaman, Crossmark, Gem, Ledger | **HIGH** — no code reuse; the whole signing layer is new |
| SDK: `stellar-sdk` (self-hosted, vendored) | signing, tx building | **[C]** `xrpl.js` | Medium — must be vendored the same way; see `lumoscore-security-hardening` note about self-hosting |
| Soroban / Soroswap routing | smart swap | **[V]** XRPL mainnet has no general smart contracts (Hooks is a sidechain) | Feature likely does not port |

---

## 3. The API surface a second network has to satisfy

32 functions in `functions/lxapi/`. **11 are Horizon-bound** and are the real integration surface:

```
assetlogo   candles   dexassets   lastprice   lastprices
listing     listingadmin          mintmeta    pools
poolvol     xlm
```

The other 21 (blog, mail, media, support, analytics, revenue, admin…) are chain-agnostic and need no
work.

**These endpoints are the natural seam.** Today the pages also call `horizon.stellar.org` directly
from 24 transforms, so there is no single place to swap. The cheapest honest path is:

1. Give each of the 11 a network parameter (or an `xrpl` sibling) — they already own the caching,
   rate-limit handling and error shapes, which is most of the value.
2. Move the 24 transforms' direct Horizon calls behind those endpoints as they are touched, rather
   than in one sweep. **Sweeping refactors in this repo have a bad record** — see `GUARDRAILS.md`.

An explicit contract worth defining before writing any of it, because it forces the gaps in §4 into
the open early:

```
price(asset)            stats24h(asset)   -> vol, trades, high, low, change
holdings(account)       pools(asset)      assetMeta(asset)
orderbook(pair)         candles(asset, resolution, limit)
```

---

## 4. Hard gaps — read this before promising a timeline

**1. No OHLC / aggregation endpoint. [V] — verify first, it is the biggest single risk.**
Stellar's `/trade_aggregations` gives volume, high, low, trade count and candles in one call. XRPL is
believed to have no equivalent on public rippled or Clio. Everything below depends on it:

- the price chart on the asset page (1D/1W/1M/1Y)
- 24h volume, high/low, trade count and % change on the market table *and* the asset page
- the 7-day sparkline on every market row
- "movers" on Trade-main and Trending on the dashboard

Options if confirmed absent: a third-party data provider (a dependency and probably a cost), or
computing aggregates ourselves from transaction history (expensive — note that Cloudflare's free plan
CPU limits already shape this codebase, see `lumoscore-cf-plan-limits`). **Resolve this before
committing to a date.** It is plausibly the difference between weeks and months.

**2. No SEP-1. [V]**
Our entire asset-metadata and verification story is SEP-1: issuer declares `home_domain`, we serve
`/.well-known/stellar.toml`, and `mintedByUs` proves a launchpad mint on-chain. XRPL's `Domain` field
plus the `xrp-ledger.toml` convention is *not* the same mechanism and is not used the same way by
wallets. Needs its own design: how an XRPL asset gets a name, logo, description, and what "verified"
means. Our KV-backed `assetmeta` / `mintmeta` records port fine — the *verification* does not.

**3. The bridge probably does not port. [V]**
Cross-chain is Circle CCTP, and CCTP is not believed to support XRPL. If confirmed, the Bridge feature
is out of scope for XRPL entirely rather than "ported" — say so up front rather than discovering it
mid-build.

**4. The signing layer is new work, not ported work. [C]**
Six wallet adapters exist for Stellar. None work on XRPL. Budget for it as a feature, and note the
unresolved mobile issue in `lumoscore-send-picker-mobile`.

---

## 5. What ports for free

Roughly half the site. Blog, docs, support inbox, admin panel, legal pages, SEO/FAQ layers, the whole
design system, the build chain, the deploy pipeline, and the 21 chain-agnostic endpoints. The KV/D1
backend and the admin auth model are network-independent.

---

## 6. Open questions

1. Routing model — §0. **Blocks everything.**
2. Is there a usable XRPL OHLC source? — §4.1. **Blocks the whole Trade section.**
3. Does the launchpad port, and what is the XRPL definition of "minted here"? — §2, §4.2.
4. Is Bridge in or out? — §4.3.
5. Are XRPL pages built from the existing `lumoscore-xrpl-*` containers, or from the aptos ones the
   Stellar site is built from? The XRPL containers exist but have never been built.
6. Does LUMOS exist on XRPL, and if not, what happens to Rewards and the fee discount?

---

## 7. Companion documents

- `GUARDRAILS.md`, `LUMOSCORE_DEV.md` — build-system traps. **Read before touching anything.**
- `RELEASE.md` — branch and deploy process. `main` is production; `git push` does not deploy.
- `WALLET_LOGIC.md` — the Stellar wallet spec, useful as the reference implementation.
