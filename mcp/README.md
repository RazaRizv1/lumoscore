# @lumoscore/mcp

The [LumosCore](https://lumoscore.com) MCP server — Stellar DeFi tools for AI agents.

Ten tools: live market data, liquidity pools, portfolios and best-route quotes, plus prepared
swap, liquidity, bridge and token-launch actions.

## Install

```bash
npm i -g @lumoscore/mcp
```

Then point your client at it. For Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lumoscore": { "command": "lumoscore-mcp" }
  }
}
```

No account and no API key. Every read is public chain data.

## It never holds a key, and never signs

The five read tools answer directly. The five write tools — `swap`, `add_liquidity`,
`remove_liquidity`, `bridge`, `launch_token` — **do not sign anything**. They validate the request and
return an `approve_url`: you open it, LumosCore shows the prepared transaction, and your own wallet
asks you to sign.

This is the design, not a missing feature. An MCP server runs inside an agent loop, so a private key
here would be a key an AI could spend with nobody watching. Arguments are checked before the link is
built, so a malformed request fails with a reason instead of in a wallet you have already been asked
to trust.

## Tools

| Tool | What it does |
|---|---|
| `get_market` | Price, 24h change, volume, high/low for a Stellar asset |
| `list_pools` | Liquidity pools by TVL, optionally filtered to one asset |
| `get_portfolio` | Balances, pool positions and open orders for an account |
| `get_quote` | Best-route price, from Stellar's own path finding |
| `get_rewards` | Where to check and claim LUMOS rewards |
| `swap` | Prepares a swap for you to approve |
| `add_liquidity` | Prepares an AMM deposit for you to approve |
| `remove_liquidity` | Prepares an AMM withdrawal for you to approve |
| `bridge` | Prepares a cross-chain transfer for you to approve |
| `launch_token` | Prepares a token issuance for you to approve |

Assets are `CODE-ISSUER` (`SHX-GDSTRSHX…`), or `XLM` for the native asset.

## Where the numbers come from

Reads call the same endpoints that serve lumoscore.com, and `get_quote` and `get_portfolio` read
Stellar Horizon directly — so an agent sees what a visitor sees, and a portfolio cannot be stale
against some cache of ours. When an upstream cannot answer, a tool returns an error saying so. It
never returns empty data, because "no pools" and "I could not look" are different claims and an agent
will act on both.

`LUMOSCORE_API` overrides the API base if you need to point at a preview deployment.

## Licence

MIT
