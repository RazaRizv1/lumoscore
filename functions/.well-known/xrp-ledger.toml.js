// xrp-ledger.toml for lumoscore.com — the domain's statement of which XRP Ledger tokens are ours.
//
// The XRPL counterpart to stellar.toml.js next door, and it exists for the same reason: an issuer
// setting Domain = lumoscore.com is only making a claim. It counts as verified when THIS document,
// served from that domain, names the token back. Wallets and explorers check both halves.
//
// WHICH TOKENS ARE LISTED, and why it is not "everyone claiming our domain":
//
//   1. the issuer declares Domain = lumoscore.com          <- the token's claim
//   2. the issuer ACCOUNT was funded by our launchpad wallet <- our proof
//
// Condition 2 is the one that cannot be forged: the account that created an XRPL account is fixed at
// creation and stays on the ledger forever. Condition 1 alone would be circular — anyone can set
// Domain to lumoscore.com without permission, and a toml built on that would let a stranger mint
// "USDC", point it here, and be blessed by us in every wallet that reads this file.
//
// Every token below was found by condition 2, walking the payments of the launchpad funding wallet
// rLgbG2dUJBvC3uifB8zcCRWUSVXFcSZ2DJ on 2026-09-06 and keeping the accounts that issue something.
// All six are blackholed (master key disabled, RegularKey set to a burn address), so their supplies
// are fixed and no more can ever be minted from them.
//
// A KNOWN LIMITATION, recorded because it cannot be fixed. Only POP and BRO actually carry
// Domain = lumoscore.com. RAC declares api.lumoscore.com (a host that 404s), and NPENGU, LLAMA and
// XRLINK declare nothing at all. Since every issuer is blackholed, none of those four can ever be
// corrected — a Domain change needs a signature from a key that no longer exists. Wallets resolve
// issuer -> Domain -> toml, so in practice this file verifies POP and BRO; the rest are listed
// because this is still LumosCore's own public record of what it minted.
//
// STATIC ON PURPOSE. The Stellar sibling rebuilds its list live, but that walks dozens of accounts
// per request and this project's Functions run on a plan with a 10ms CPU budget. This file does no
// ledger work at all. When the launchpad mints again, regenerate the list with the funder walk
// described above and add the entry here.

const TOML = `# xrp-ledger.toml for lumoscore.com
# Tokens minted through the LumosCore launchpad on the XRP Ledger.
#
# Every issuer listed here was funded by the LumosCore launchpad wallet
# rLgbG2dUJBvC3uifB8zcCRWUSVXFcSZ2DJ, which is what makes this list forgery-proof:
# the creator of an XRPL account is fixed at creation and cannot be changed.
# All issuers are blackholed, so their supplies are final.

[METADATA]
modified = "2026-09-06T00:00:00Z"

[[ISSUERS]]
address = "r389VP68xLBJjUtyaV5vDCJ7LFDGfUzZaK"
name = "LumosCore Launchpad — POP"

[[TOKENS]]
issuer = "r389VP68xLBJjUtyaV5vDCJ7LFDGfUzZaK"
currency = "POP"
name = "POP"
desc = "Minted on the XRP Ledger through the LumosCore launchpad. Issuer blackholed; supply is fixed."

[[ISSUERS]]
address = "rU6PSp49XJzNQV1BMNk1jeD13KjwVAL6Hu"
name = "LumosCore Launchpad — BRO"

[[TOKENS]]
issuer = "rU6PSp49XJzNQV1BMNk1jeD13KjwVAL6Hu"
currency = "BRO"
name = "BRO"
desc = "Minted on the XRP Ledger through the LumosCore launchpad. Issuer blackholed; supply is fixed."

[[ISSUERS]]
address = "rUZvaqWQpTeePGWdxof6kVgosWyMyBzTRg"
name = "LumosCore Launchpad — RAC"

[[TOKENS]]
issuer = "rUZvaqWQpTeePGWdxof6kVgosWyMyBzTRg"
currency = "RAC"
name = "RAC"
desc = "Minted on the XRP Ledger through the LumosCore launchpad. Issuer blackholed; supply is fixed."

[[ISSUERS]]
address = "r4THLuZStmoF9Mu6metU79Hz3fAc8dA6QH"
name = "LumosCore Launchpad — NPENGU"

[[TOKENS]]
issuer = "r4THLuZStmoF9Mu6metU79Hz3fAc8dA6QH"
currency = "NPENGU"
name = "NPENGU"
desc = "Minted on the XRP Ledger through the LumosCore launchpad. Issuer blackholed; supply is fixed."

[[ISSUERS]]
address = "rhXXbaE7MiA6JHi2aVu4cgjLzZ8HzdwNFA"
name = "LumosCore Launchpad — LLAMA"

[[TOKENS]]
issuer = "rhXXbaE7MiA6JHi2aVu4cgjLzZ8HzdwNFA"
currency = "LLAMA"
name = "LLAMA"
desc = "Minted on the XRP Ledger through the LumosCore launchpad. Issuer blackholed; supply is fixed."

[[ISSUERS]]
address = "rHW6cRyt2pwgXy3g1zqJpX4ydjatLZ1xJw"
name = "LumosCore Launchpad — XRLINK"

[[TOKENS]]
issuer = "rHW6cRyt2pwgXy3g1zqJpX4ydjatLZ1xJw"
currency = "XRLINK"
name = "XRLINK"
desc = "Minted on the XRP Ledger through the LumosCore launchpad. Issuer blackholed; supply is fixed."

# NOT LISTED: LUMOS itself.
# LUMOS is issued by rsPqeamjpr3Bxu4LhtCgvJEAQusYRRg6Ha, whose on-ledger Domain is lumosdao.com.
# Its toml therefore lives at https://lumosdao.com/.well-known/xrp-ledger.toml and cannot move here:
# that issuer is blackholed, so its Domain can never be changed. Claiming LUMOS from this domain
# would be an assertion nothing on the ledger supports.
`;

export async function onRequestGet() {
  return new Response(TOML, {
    headers: {
      // text/plain is what SEP-1 style consumers and XRPL toml readers expect.
      'content-type': 'text/plain; charset=utf-8',
      // Readable by wallets and explorers from any origin.
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
}
