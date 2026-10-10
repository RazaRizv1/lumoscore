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
// STATIC BASE, KV TAIL. The Stellar sibling rebuilds its whole list live, but that walks dozens of
// accounts per request and this project's Functions run on a plan with a 10ms CPU budget. This file
// still does NO ledger work: the six below are fixed text, and every mint since is appended from
// `mintmeta:xrpl` — one KV read, no RPC.
//
// That key is written only by lxapi/xrplmintmeta.js, which proves on the validated ledger that the
// issuer is blackholed and that our mint fee was paid to our collector by the account that created
// it, before it stores anything. So the verification happens once, at mint time, where there is a
// budget for it — not on every request for this document. See appendMints() below for why that is a
// different proof from the funder walk, and why the appended block says so in its own words.

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

// ---- per-token overrides: the logo, and corrected words ------------------------------------------
//
// RAZA 2026-10-07: "For Lumoscore own minted tokens on XRPL, we add their logo and other details on
// toml lumoscore.com/.well-known/xrp-ledger.toml ... because the minters will also upload the logo
// and other details of the asset."
//
// The static list below stays the source of WHICH tokens are ours — that list comes from the funder
// walk and is the forgery-proof half. This only adds artwork and wording to entries already on it,
// so an override can never introduce a token or claim one we did not mint.
//
// SAME-ORIGIN IMAGES ONLY, which is the rule the Stellar sibling arrived at the hard way. Its note:
// it used to take each image from stellar.expert's tomlInfo, "which silently published nothing,
// because stellar.expert fills tomlInfo by reading THIS document — so the image could only ever
// appear here if it already appeared here." It broke the loop by publishing images WE host. The same
// applies with more force on this ledger, where an icon url is a string an anonymous account chose:
// a toml that could name any host would let this domain vouch for artwork served from anywhere.
const ORIGIN = 'https://lumoscore.com';
const MINTMETA_XRPL = 'mintmeta:xrpl';          // {"CODE-issuer": {name, desc, image}}

// The same two shapes lxapi/xrplmintmeta.js validates on the way IN, restated here rather than
// imported: that module lives in a sibling directory and this one is also built by the XRPL repo,
// where an import across that boundary would resolve in the combined build and fail in the other.
// A currency is three characters or forty hex digits; an address is base58 without 0 O I l.
const ADDR_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const CUR_RE = /^([A-Za-z0-9]{1,3}|[0-9A-Fa-f]{40})$/;

function safeImage(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (s.startsWith('/assets/')) return ORIGIN + s;
  if (s.startsWith(ORIGIN + '/assets/')) return s;
  // A minter's uploaded logo, which xrplmintmeta.js stores in KV and /lxapi/media serves. Still this
  // origin and still a path we control — the rule is "an image WE serve", not "a file in /assets".
  // Shape-checked rather than passed through: the id is a hash plus an extension, nothing else.
  const m = /^(?:https:\/\/lumoscore\.com)?\/lxapi\/media\?id=([0-9a-f]{32}\.(?:png|jpg|webp|gif))$/.exec(s);
  if (m) return ORIGIN + '/lxapi/media?id=' + m[1];
  return '';                                     // anything else is not ours to publish
}

const esc = (s) => String(s == null ? '' : s).replace(/[\\"]/g, '').replace(/[\r\n]+/g, ' ').trim();

// Line-based, because the document's shape is one we author: walk it, hold each [[TOKENS]] block
// until it ends, and emit the extra keys for the block we recognise. A block ends at the next
// `[`-header or at a comment, which is what keeps the trailing "NOT LISTED" note outside the last one.
function applyOverrides(toml, meta) {
  if (!meta || typeof meta !== 'object') return toml;
  const out = [];
  const seen = new Set();                 // every CODE-ISSUER the static document already names
  let buf = null, iss = '', cur = '';
  const flush = () => {
    if (!buf) return;
    if (cur && iss) {
      seen.add(cur + '-' + iss);
      seen.add(String(cur).toUpperCase() + '-' + iss);
    }
    const m = meta[cur + '-' + iss] || meta[String(cur).toUpperCase() + '-' + iss];
    if (m) {
      const img = safeImage(m.image);
      const has = (k) => buf.some((l) => new RegExp('^\\s*' + k + '\\s*=').test(l));
      if (m.name && !has('name')) buf.push('name = "' + esc(m.name) + '"');
      if (m.desc && !has('desc')) buf.push('desc = "' + esc(m.desc) + '"');
      if (img && !has('icon')) buf.push('icon = "' + img + '"');
    }
    out.push(...buf);
    buf = null; iss = ''; cur = '';
  };
  for (const line of String(toml).split('\n')) {
    const t = line.trim();
    if (t.startsWith('[')) {
      flush();
      if (t === '[[TOKENS]]') { buf = [line]; continue; }
      out.push(line);
      continue;
    }
    if (buf && t.startsWith('#')) { flush(); out.push(line); continue; }
    if (buf) {
      buf.push(line);
      const kv = /^(issuer|currency)\s*=\s*"([^"]*)"/.exec(t);
      if (kv) { if (kv[1] === 'issuer') iss = kv[2]; else cur = kv[2]; }
      continue;
    }
    out.push(line);
  }
  flush();
  return out.concat(appendMints(meta, seen)).join('\n');
}

// EVERY MINT SINCE, APPENDED (RAZA 2026-10-09: "fix the xrpl toml to add mints automatically").
//
// The header above used to end "When the launchpad mints again, regenerate the list with the funder
// walk described above and add the entry here" — a manual step nobody was going to remember, and the
// reason a token minted today was invisible to every wallet that reads this file.
//
// WHAT MAKES AN APPENDED ENTRY SAFE IS NOT THE FUNDER WALK, and that distinction is the whole of this
// block. lxapi/xrplmintmeta.js is the only writer of `mintmeta:xrpl`, and it refuses to store anything
// until it has proved, on the validated ledger: the issuer is blackholed; which account created the
// issuer; and that OUR mint fee was paid to our collector BY THAT SAME ACCOUNT. Reproducing that means
// paying us from the account that funded the issuer and then destroying the issuer's keys — which is
// precisely the claim being made. So a key in that map is a verified LumosCore mint before it ever
// reaches this file.
//
// It is a DIFFERENT proof from the six above, which really were funded by the launchpad wallet.
// Today's launchpad funds the new issuer from the MINTER's own wallet (mint.js step 2), so demanding
// our funder would reject every real mint. The appended block carries its own note saying which of
// the two proofs applies to it, because a document whose job is verification must not make a claim
// about an issuer that is not true of it.
//
// Shape-checked even though the writer checked first: this is the public document, the values reach
// it through KV, and an issuer or currency that is not the right shape is dropped rather than
// published. Same rule the rest of the XRPL surface follows for minter-supplied values.
function appendMints(meta, seen) {
  const ids = Object.keys(meta).filter((id) => !seen.has(id));
  if (!ids.length) return [];
  const blocks = [];
  for (const id of ids.sort()) {
    const cut = id.lastIndexOf('-');                       // a currency never contains "-"
    if (cut < 1) continue;
    const cur = id.slice(0, cut), iss = id.slice(cut + 1);
    if (!ADDR_RE.test(iss) || !CUR_RE.test(cur)) continue;
    const m = meta[id] || {};
    const img = safeImage(m.image);
    blocks.push('[[ISSUERS]]', 'address = "' + iss + '"');
    if (m.name) blocks.push('name = "' + esc(m.name) + '"');
    blocks.push('', '[[TOKENS]]', 'issuer = "' + iss + '"', 'currency = "' + cur + '"');
    if (m.name) blocks.push('name = "' + esc(m.name) + '"');
    if (m.desc) blocks.push('desc = "' + esc(m.desc) + '"');
    if (img) blocks.push('icon = "' + img + '"');
    blocks.push('');
  }
  if (!blocks.length) return [];
  return ['', '# Minted through the LumosCore launchpad since this document was first written.',
    '# These issuers were funded by the minter\'s own wallet rather than by the launchpad wallet',
    '# named above. Each is listed only after LumosCore verified, on the validated ledger, that the',
    '# issuer is blackholed and that the mint fee was paid to LumosCore by the same account that',
    '# created it.', ''].concat(blocks);
}

export async function onRequestGet(context) {
  // NEVER BLOCKS THE DOCUMENT. A toml without icons is degraded; a toml that 500s is a domain that
  // cannot verify its own tokens, and wallets cache that. One KV read, no ledger work — the budget
  // this file's header protects is spent on walking accounts, which this does not do.
  let body = TOML;
  try {
    const kv = context && context.env && context.env.CONTENT_KV;
    if (kv) body = applyOverrides(TOML, await kv.get(MINTMETA_XRPL, 'json'));
  } catch (e) { body = TOML; }

  return new Response(body, {
    headers: {
      // text/plain is what SEP-1 style consumers and XRPL toml readers expect.
      'content-type': 'text/plain; charset=utf-8',
      // Readable by wallets and explorers from any origin.
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
}
