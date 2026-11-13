# LumosCore

A non-custodial, multi-network DeFi platform — trading, liquidity pools, cross-chain transfers, a
wallet view, a token launchpad and rewards, served as a static site from Cloudflare Pages.

Live at **<https://lumoscore.com>**.

## Networks

| Network | Status | Where it is built |
|---|---|---|
| **Stellar** | Live on mainnet | **This repository** |
| **XRPL** | Live on mainnet | Its own repository; its edge Functions live here |
| **NEAR** | Live on mainnet | Its own repository |

One site serves every network. A chain switcher moves between them, and each network keeps its own
assets, pools, wallets and data sources.

This repository holds the **Stellar application** plus the **shared Cloudflare edge Functions** that
every network calls: 28 of the 83 Functions serve a build other than this one, most of them XRPL.
Each network's front-end is built separately, but the edge layer is common to all of them.

Every number in the UI is read from the chain or a public API at runtime. There is no backend database
and no server-side account system: the app talks to Horizon, Soroban RPC, stellar.expert, CoinGecko
and DefiLlama, either directly from the browser or through a thin edge proxy where an upstream needs a
server-side key or shelter from rate limits. **Every transaction is signed in the user's own wallet.**
LumosCore never holds keys and never has custody.

---

## What's in it

These are the sections of the Stellar app held in this repository. The XRPL build carries its own
version of most of them, reading its own data sources.

| Section | What it does |
|---|---|
| **Dashboard** | Network stats, trending assets, quick actions |
| **Trade** | Asset pages with price/holders/pools, swaps on the Stellar SDEX orderbook via Horizon path-finding, plus limit orders |
| **Pools** | Stellar AMM pools — browse, add liquidity, withdraw, create |
| **Bridge** | Cross-chain transfers over four routes: Circle CCTP, LayerZero/USDT0, NEAR Intents and Axelar ITS |
| **Wallet** | Balances, send/receive, trustlines, activity |
| **Launchpad** | Issue a new Stellar asset end to end |
| **Rewards** | LUMOS staking/liquidity rewards |
| **LUMOS** | The platform token's own page |
| **Account** | Public per-address pages (excluded from search indexing) |
| **Blog** | Posts served from the edge |
| **FAQ** | Per-section question sets, rendered by one shared view |
| **MCP** | A Model Context Protocol server exposing read-only and quote tools — see [`mcp/`](mcp/) |

Wallets supported on Stellar: Freighter, Rabet, Albedo, xBull, LOBSTR and WalletConnect. The XRPL
build has its own set, Xaman among them. No build ever receives a private key — connecting returns an
address, and signing happens inside the wallet.

---

## How the build works

This is not a typical framework app, and the layout makes more sense once you know why.

The design ships as a small number of very large HTML **container** files — one per device variant —
each holding every page of the site as a JSON blob. The build is a pipeline of small, **idempotent**
transforms that rewrite those containers in place, followed by an extraction step that splits them
into one file per page.

```
lumoscore-aptos-desktop.html          design containers (not in this repo — see below)
lumoscore-aptos-mobile.html
        |
        |  _tools/*.js   246 transforms: data layers, theming, SEO, routing, fixes
        v
_tools/extract_site.js                splits containers into pages, rewrites links,
        |                             emits _redirects / _headers / _routes.json / middleware
        v
dist/                                 the deployed site  (committed — see below)
```

Each transform is small and re-runnable: running one twice produces the same output as running it
once. That is what makes it safe to replay the whole pipeline after changing any single step.

A transform writes the **containers**, not `dist/`. Reading `dist/` straight after running one shows
the previous build — rerun `extract_site.js` first.

### Repository layout

```
_tools/          246 build transforms + extract_site.js + predeploy_check.js
_lib/            shared server-side helpers (admin auth, audit log, rate limiting, mail templates)
_data/           static build inputs — admin schema, OG card manifest, map asset
dist/            the built public site — this is what Cloudflare serves
functions/       Cloudflare Pages Functions (see below)
mcp/             the Model Context Protocol server
relayer/         CCTP relayer worker (currently parked, not in the delivery path)
cron-warm/       standalone Worker that keeps the pool ranking warm (Pages has no cron trigger)
_email-worker/   transactional mail worker
serve.js         local server that mirrors production behaviour
LUMOSCORE_DEV.md development guide — read before changing anything
GUARDRAILS.md    hard rules for this codebase
WALLET_LOGIC.md  wallet page specification
```

### Cloudflare Functions

83 Functions in total. The main groups:

| Group | Purpose |
|---|---|
| `_middleware.js` | Clean-URL rewrites, legacy-filename 301s, device selection by User-Agent, edge SEO injection |
| `lxapi/` asset & market | Holder distribution, asset search and metadata, logos, prices, candles, movers, network stats |
| `lxapi/` bridge | Route quotes and transfer status for CCTP, LayerZero, NEAR Intents and Axelar |
| `lxapi/` launchpad & listing | Mint metadata, listing requests and their payment quotes |
| `lxapi/` blog | Post index and bodies, plus news. Published posts are public; drafts are not — see Security notes |
| `lxapi/` admin | Audit log, analytics and badge endpoints, reachable only from the private admin project |
| `lxapi/xrpl*` | The XRPL build's data endpoints — served from here because the edge layer is shared |
| `robots.txt.js`, `sitemap.xml.js`, `llms.txt.js` | Generated at the edge; the sitemap enumerates live assets and pools from the chain |
| `.well-known/*.toml.js` | SEP-1 `stellar.toml` and the XRPL equivalent |

`_middleware.js` and `_routes.json` are **generated** by `extract_site.js` from a single route table —
don't hand-edit them.

The convention for a `/lxapi/` endpoint is to answer **200 with an `ok: false` body** on failure rather
than a 5xx, because Cloudflare replaces a real 5xx body with its own error page and the client can no
longer read why it failed. 41 of the 75 endpoints follow it; the rest predate the convention and are
being migrated.

---

## Running it locally

```bash
npm install
npm run serve
```

Then open <http://localhost:8080>.

`dist/` is committed, so this works straight after cloning — no build step needed. `serve.js`
deliberately mirrors production: it reads the same `dist/_redirects` Cloudflare uses, applies the same
legacy-URL redirects, and does the same User-Agent device selection, so local behaviour matches the
deployed site instead of drifting from it.

### Rebuilding

```bash
npm run build          # public site  -> dist/
```

⚠️ **This will not work from a fresh clone.** The build reads the design containers
(`lumoscore-aptos-*.html`, ~337 MB), which are excluded from the repository because of their size.
Without them there is nothing to transform. The committed `dist/` is the build output, so you can
read, run, host and modify the site without ever rebuilding.

### Testing like production

```bash
npx wrangler pages dev dist
```

`serve.js` is close to production but not identical — some behaviours only appear under the real
Cloudflare runtime (`.html` → extensionless 308s, `_routes.json` coverage, Functions execution). Test
anything routing-related with `wrangler pages dev` before deploying.

---

## Deploying

There are two paths to production, and both are live:

1. **Pushing to `main`** triggers a Cloudflare Pages build (build command empty, build output
   directory `dist`). Any other branch produces a preview deployment and cannot affect production.
2. **A direct upload** of an already-built tree with `wrangler pages deploy`. Release builds are
   published this way, because production is assembled from more than one build before it ships.

Because of (2), a commit on `main` is not by itself proof of what is live. Verify a release against
the deployed URL, not against the repository.

A pre-deploy gate runs automatically before any manual deploy:

```bash
npm run deploy
```

`_tools/predeploy_check.js` blocks the deploy if it finds admin pages in the public build, anything
resembling a secret (API keys, Stellar seeds, AWS or GitHub tokens), oversized files, or a missing
`index.html`.

---

## Things this repository deliberately does not contain

- **The admin panel.** It lives in a separate private repository and deploys as its own Cloudflare
  Pages project behind Cloudflare Access. Its protection is that its files are not on any public
  server, so publishing them here would defeat the point. The `lxapi/admin*` Functions are here, but
  they authenticate against that project.
- **The design containers** (~337 MB) and the wider source asset library — excluded for size.
  `dist/assets` holds everything the built site actually references.
- **The XRPL and NEAR front-ends.** Only their shared edge Functions live here; each has its own
  repository.
- **Any secret.** Every third-party key lives as a Cloudflare secret and is read server-side by the
  Function that needs it; the browser never receives a credential. There are no keys in the git
  history to find.

---

## Security notes

- The app is **non-custodial**. Transactions are built client-side and signed in the user's wallet.
  This holds for every surface, the LUMOS wallet view included.
- `X-Frame-Options: DENY` is set site-wide: this app triggers wallet signing prompts, and a framed
  signing flow is a clickjacking target.
- Asset codes, issuer domains and token names are **attacker-controlled input** — anyone can issue an
  asset and call it anything. They are escaped at every render site and never trusted for identity;
  verification comes from the curated list and the issuer's own `stellar.toml`.
- **Privileged requests need `requireAdmin()`, which is two conditions, not one**: the request must
  arrive on the admin hostname *and* carry a Cloudflare Access JWT that verifies against our team's
  keys. The hostname alone proves nothing, because `functions/` is shared across all three Pages
  projects — every endpoint in here also exists on `lumoscore.com`.
- **A post that is not live yet is not public.** "Live" means `published` **and** `publishAt` in the
  past, and that one test is applied in all three places a post can surface: the public API, the
  index, and the edge SEO injection on an article's own url. Two gaps were closed on 2026-11-13 —
  `lxapi/blog?all=1` honoured a request for drafts without checking who was asking, and the
  middleware's own lookup tested `published` while ignoring `publishAt`, so a scheduled post's
  headline and cover were injected at its direct url before its time. Asking for drafts without
  admin credentials now returns 403. If a draft preview is ever built, it belongs on an
  authenticated path, not on the public page.
- There is no Content-Security-Policy. The design carries hundreds of inline scripts, so any workable
  policy would need `unsafe-inline` and would buy nothing. A real CSP requires extracting that inline
  code first.

---

## Contributing

Read [`LUMOSCORE_DEV.md`](LUMOSCORE_DEV.md) and [`GUARDRAILS.md`](GUARDRAILS.md) first. They document
the landmines that have actually caused breakage here — competing icon painters, flash-of-unstyled
content gates, escaping levels through template literals, and the transform ordering rules.

---

## License

[MIT](LICENSE).
