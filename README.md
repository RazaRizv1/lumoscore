# LumosCore

A DeFi interface for the **Stellar mainnet** — trading, liquidity pools, cross-chain transfers,
a wallet view, a token launchpad and rewards, served as a static site from Cloudflare Pages.

Live at **<https://lumoscore.com>**.

Every number in the UI is read from the chain or a public API at runtime. There is no backend
database and no server-side account system: the app talks to Horizon, Soroswap, stellar.expert,
CoinGecko and DefiLlama directly from the browser, and **every transaction is signed in the user's own
wallet**. LumosCore never holds keys and never has custody.

---

## What's in it

| Section | What it does |
|---|---|
| **Dashboard** | Network stats, trending assets, quick actions |
| **Trade** | Asset pages with price/holders/pools, swaps routed across Soroswap, Aquarius and the Stellar SDEX orderbook, plus limit orders |
| **Pools** | Stellar AMM pools — browse, add liquidity, withdraw, create |
| **Bridge** | Cross-chain USDC transfers via Circle CCTP |
| **Wallet** | Balances, send/receive, trustlines, activity |
| **Launchpad** | Issue a new Stellar asset end to end |
| **Rewards** | LUMOS staking/liquidity rewards |
| **LUMOS** | The platform token's own page |

Wallets supported: Freighter, Rabet, Albedo, xBull and WalletConnect.

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
        |  _tools/*.js   ~100 transforms: data layers, theming, SEO, routing, fixes
        v
_tools/extract_site.js                splits containers into pages, rewrites links,
        |                             emits _redirects / _headers / _routes.json / middleware
        v
dist/                                 the deployed site  (committed — see below)
```

Each transform is small and re-runnable: running one twice produces the same output as running it
once. That is what makes it safe to replay the whole pipeline after changing any single step.

### Repository layout

```
_tools/          ~100 build transforms + extract_site.js + predeploy_check.js
dist/            the built public site — this is what Cloudflare serves
functions/       Cloudflare Pages Functions (see below)
serve.js         local server that mirrors production behaviour
LUMOSCORE_DEV.md development guide — read before changing anything
GUARDRAILS.md    hard rules for this codebase
WALLET_LOGIC.md  wallet page specification
```

### Cloudflare Functions

| Function | Purpose |
|---|---|
| `_middleware.js` | Clean-URL rewrites, legacy-filename 301s, device selection by User-Agent, edge SEO injection |
| `lxapi/soroswap/[[path]].js` | Server-side proxy that attaches the Soroswap API key so it never reaches the browser |
| `lxapi/holders.js` | Holder-distribution proxy |
| `robots.txt.js`, `sitemap.xml.js` | Generated at the edge; the sitemap enumerates live assets and pools from the chain |

`_middleware.js` and `_routes.json` are **generated** by `extract_site.js` from a single route table —
don't hand-edit them.

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

Pushing to `main` deploys automatically via Cloudflare Pages (build command empty, build output
directory `dist`).

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
  server, so publishing them here would defeat the point.
- **The design containers** (~337 MB) and the wider source asset library — excluded for size.
  `dist/assets` holds everything the built site actually references.
- **Any secret.** The Soroswap API key is a Cloudflare secret read server-side by the proxy Function;
  the browser calls `/lxapi/soroswap/…` with no credential attached. There are no keys in the git
  history to find.

---

## Security notes

- The app is **non-custodial**. Transactions are built client-side and signed in the user's wallet.
- The Soroswap `/send` endpoint relays an **already-signed** transaction, so the proxy can forward or
  refuse a swap but can never authorise one.
- `X-Frame-Options: DENY` is set site-wide: this app triggers wallet signing prompts, and a framed
  signing flow is a clickjacking target.
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
