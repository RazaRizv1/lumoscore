# LumosCore — project instructions

**Before making ANY change to this project, read `GUARDRAILS.md` and follow it.**

`GUARDRAILS.md` is authoritative and **locked** (OS read-only). Never edit, move, or delete it. To modify it, the user must explicitly ask **and** clear the read-only flag themselves — never do it on your own initiative.

Key standing rules (full detail in `GUARDRAILS.md`):
- Only ADD; never regress finalized/working behavior.
- After every change: `node --check` the transform, rebuild, reload, and confirm `window.__lxHoldings` is set AND watch the full load for **flash bugs** before calling anything done.
- One change → build → verify → next. Never batch risky edits.
- Horizon calls must stay throttled + retried + host-fallback (stellar.org → lobstr).

Also see `LUMOSCORE_DEV.md` (landmines) and `WALLET_LOGIC.md` (wallet spec).
