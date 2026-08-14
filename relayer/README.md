> **NOT DEPLOYED — parked.** LumosCore decided against paying destination gas: it comes straight out of
> the 0.5% fee and on Ethereum L1 a single delivery costs more than the fee on a $400 transfer. Users claim
> their own transfers, and the Bridge page walks them through it. This directory is kept because the
> argument does not hold on Solana and Sui, where gas is a fraction of a cent and there is no way for a
> normal user to claim at all. Nothing here runs until someone deploys it; the site does not call it.

# CCTP delivery relayer

Submits the destination-chain `receiveMessage()` for cross-chain transfers so users never have to.

A CCTP transfer burns USDC on Stellar and mints nothing until someone calls `receiveMessage()` on the
destination chain. Circle runs no relayer. LumosCore users connect a Stellar wallet, so without this the
last step falls on someone who has no EVM wallet and no gas on the destination.

**The key here cannot steal.** `receiveMessage` mints to the recipient encoded inside Circle's attested
message. This wallet cannot change the recipient, cannot mint extra, cannot touch user funds. The worst a
compromised key can do is waste its own gas.

## Provisioning — the parts only you can do

Everything below is one-time. Nothing on the live site breaks while it is undone: without the KV binding
the Pages Functions answer `{relayer:"off"}` and the Bridge page shows the manual Claim button it always
has.

**1. Install deps**

```bash
cd C:\LumosCore\relayer && npm install
```

**2. Create the KV namespace**

```bash
npx wrangler kv namespace create CCTP
```

Paste the returned `id` into `wrangler.toml` (replacing `REPLACE_WITH_KV_NAMESPACE_ID`), **and** bind the
same namespace to the `lumoscore` Pages project as `CCTP` — Cloudflare dashboard → Workers & Pages →
lumoscore → Settings → Bindings → KV namespace, variable name `CCTP`. Both halves must point at the same
namespace or the site and the relayer will not see each other's queue.

**3. Create the delivery wallet**

Generate a fresh EVM private key that is used for nothing else. Do not reuse a personal wallet.

Fund it with gas on every chain you want auto-delivery for. Rough starting amounts:

| Chain | Gas token | Suggested |
|---|---|---|
| Ethereum | ETH | 0.05 |
| Base, Optimism, Arbitrum, Linea, World Chain | ETH | 0.005 each |
| Polygon | POL | 5 |
| Avalanche | AVAX | 0.5 |

Ethereum L1 is the expensive one — that is why transfers under 25 USDC are not auto-delivered there. The
floors live in `CHAINS` in `src/index.js`; raise them if gas spikes, lower them if you want to subsidise
more.

**4. Set the secret and deploy**

```bash
npx wrangler secret put RELAYER_KEY
```

```bash
npx wrangler deploy
```

**5. Check it**

```bash
npx wrangler tail
```

The cron runs every minute. `GET /run` on the Worker drains the queue on demand while you are testing.

## Monitoring

Watch the gas balance. If the wallet runs dry, deliveries fail their simulation, retry with backoff, and
after 8 attempts fall back to `manual` — the user's Claim button. Nothing is lost, but the promise on the
Bridge page stops being kept, so treat an empty relayer wallet as an incident.

## Files

- `src/index.js` — the Worker: cron drain, Iris polling, delivery, retry/backoff, per-chain floors
- `../functions/lxapi/cctp/enqueue.js` — site → queue (validates the burn on Horizon first)
- `../functions/lxapi/cctp/status.js` — queue → Bridge page and Wallet activity
