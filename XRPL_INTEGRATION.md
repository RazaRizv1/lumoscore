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
| `home_domain` + SEP-1 `stellar.toml` | asset metadata, verification, our whole toml | **[C]** account `Domain` field for display; our own KV `assetmeta`/`mintmeta` already carries name/desc/logo and is chain-agnostic; OnTheDEX `/token/meta` as a third source | Low — see §4.2 |
| `trade_aggregations` (OHLC) | charts, 24h volume/high/low/change | **[C]** no rippled/Clio equivalent, but OnTheDEX `/ohlc` + `/ticker` + `/daily/tokens` cover it, free and keyless | Low — **resolved, see §4.1** |
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

**1. ~~No OHLC / aggregation endpoint~~ — RESOLVED 2026-09-03. [C] Not a blocker.**
rippled/Clio has no native OHLC endpoint, but it does not need one. **OnTheDEX**
(`https://api.onthedex.live/public/v1`) is free, needs **no API key**, has fair-use limits and offers
a WebSocket:

| endpoint | replaces |
|---|---|
| `/ohlc` (5/15/60/240min, D, W) | `candles.js` — the asset-page chart |
| `/ticker/:tokens_or_pairs` | the 24h volume / high / low / change columns |
| `/daily/tokens` (top 100 by volume + mcap) | the Trade-main market roster |
| `/daily/pairs` | pair discovery |
| `/token/meta/:tokens` | part of the metadata gap in §4.2 |

`https://api.xrpl.to/v1/ohlc/{md5}` is a free second source if a fallback is wanted.

**This is easier than Stellar, not harder.** `/daily/tokens` returns the market roster in one call.
On Stellar that roster needs the whole ranked-list machinery in `pools.js`/`dexassets.js` — which
exists *because* `/trade_aggregations` is the one metered Horizon endpoint (100 per 5 min). That
constraint, and the 300s TTL it forces, simply does not apply here.

Two things to weigh, neither a blocker:

- It is a **third-party dependency** on the price path. That is not new — the site already leans on
  stellar.expert for search, trending and logos, and that dependency rate-limited us to 429 on
  2026-09-03. Cache it at the edge the way `candles.js` does and treat an outage as "figures
  unavailable", never as zero.
- **No AMM/pool data.** Pools come from rippled's native `amm_info` instead, which is first-party and
  fine.

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
2. ~~Is there a usable XRPL OHLC source?~~ **ANSWERED 2026-09-03: yes — OnTheDEX, free and keyless,
   plus xrpl.to as a fallback. See §4.1. This was the estimate's biggest unknown and it is closed.**
3. Does the launchpad port, and what is the XRPL definition of "minted here"? — §2, §4.2.
4. Is Bridge in or out? — §4.3.
5. Are XRPL pages built from the existing `lumoscore-xrpl-*` containers, or from the aptos ones the
   Stellar site is built from? The XRPL containers exist but have never been built.
6. Does LUMOS exist on XRPL, and if not, what happens to Rewards and the fee discount?

---

## 7. Reference implementation — xMagnetic (observed 2026-09-03)

xmagnetic.org is a live XRPL DEX with almost our exact feature set, and it is fast. Its data layer was
read from its own network calls, so this is what it *does*, not what it claims.

**Their services** — note this is a split microservice architecture, i.e. what it grows into, not what
v1 needs:

| Host | Purpose | Our equivalent |
|---|---|---|
| `pairsapi.xmagnetic.org/pairsApi/TokenData?currency_hex=&issuer=` | per-token market stats | `dexassets.js` |
| `pairsapi…/MainPrice?network=MAINNET` | native-asset price | `xlm.js` |
| `ammapi.xmagnetic.org/AMMAPI/AMMPool?currency1=&issuer1=&currency2=&issuer2=` | AMM pool data | `pools.js` |
| `token-info.xmagnetic.org/v1/tokens/{CODE}_{issuer}` | curated token metadata | `assetmeta.js` / `mintmeta.js` |
| `img.xmagnetic.org/u/{issuer}_{CODE}.webp` | logos, keyed by issuer+code | `/lxapi/media` |
| `node1` / `node2.xmagnetic.org` | **their own rippled nodes** | Horizon (public) |
| `xrpldata.inftf.org/v1/iou/exchanges/{issuer}_{CODE}/XRP?limit=400&descending=true` | **raw trade history** | `candles.js` |

**Two findings that settle open questions:**

1. **Metadata is a curated first-party service, not an on-chain standard.** Their `token-info`
   response is `{id, tokenName, description, currency, currencyHex, issuer, website, twitter,
   telegram, iconUrl, launchpad, …}` — essentially our `assetmeta`/`mintmeta` record, including a
   `launchpad` field that mirrors our mint registry. This is the industry answer to "there is no
   SEP-1", and **we already have the whole thing built**. §4.2 is a rekeying job.

2. **A third OHLC path.** They do not use OnTheDEX; they pull raw exchanges from the free public
   `xrpldata.inftf.org` and aggregate themselves. The records carry `base_amount`, `counter_amount`,
   `rate`, `executed_time`, `tx_hash`, `ledger_index` and `provider_is_amm` (so AMM and orderbook
   fills are distinguishable). So there are three viable routes — OnTheDEX `/ohlc`, xrpl.to, or raw
   exchanges plus our own aggregation. **The risk in §4.1 is dead several times over.**

**Their routing puts the pair in the path**: `/dex/{CODE}+{issuer}_{CODE}+{issuer}`, with separate
`/swap`, `/amm`, `/pro` trees. Independent support for Option A in §0.

**Their feature set maps to ours almost 1:1** — `dex`, `swap`, `amm`, `farming` (our Rewards),
`memepad` (our Launchpad), `pro`, `nfts`, `xrpl-radar`, and `token-trasher`. That last one exists
because clearing dead trust lines is a real XRPL pain point — the same problem as the PEACE trustline
fix on 2026-09-03, and worth noting as a small feature XRPL users actively look for.

**What to take, and what not to.** Take the shape: curated token-info, a per-token stats service, a
separate AMM service, logos keyed by issuer+code. Do **not** copy the own-nodes-plus-microservices
footprint for v1 — public rippled clusters and the existing `lxapi` functions are enough to launch.
Their node1/node2 exist because public clusters throttle at scale, which is the same lesson Horizon
and stellar.expert taught this codebase; treat it as the scaling path, not the starting point.

---

## 8. Companion documents

- `GUARDRAILS.md`, `LUMOSCORE_DEV.md` — build-system traps. **Read before touching anything.**
- `RELEASE.md` — branch and deploy process. `main` is production; `git push` does not deploy.
- `WALLET_LOGIC.md` — the Stellar wallet spec, useful as the reference implementation.
