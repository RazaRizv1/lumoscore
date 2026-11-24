// SEP-1 stellar.toml for lumoscore.com — the domain's own statement of which assets are ours.
//
// This file is what makes a home_domain claim mean anything. An issuer writing "home_domain=lumoscore.com"
// is just an assertion by that issuer; SEP-1 only treats it as verified when THIS document, served from
// that domain, names the asset back. Wallets and explorers check both halves. Until now we served no toml
// at all (404), so every LumosCore mint was making a claim nothing could confirm.
//
// WHICH ASSETS GET LISTED, and why it is not simply "everyone claiming our domain":
//
//   1. the issuer declares home_domain = lumoscore.com      <- the asset's claim
//   2. the issuer ACCOUNT was created by our funding wallet  <- our proof
//
// Both are required. Condition 1 alone would be circular and dangerous: anyone on Stellar can set
// home_domain to lumoscore.com without permission, so a toml built on that would let a stranger mint
// "USDC", point it here, and be verified by us across every wallet that reads this file. Condition 2 cannot
// be forged -- an account's creator is fixed at creation and is on the ledger forever. Every one of the 24
// assets minted through the LumosCore launchpad satisfies it (checked: 24/24).
//
// This is also what makes the file self-maintaining: a new launchpad mint is funded by the same wallet, so
// it appears here on the next cache refresh with no deploy and no list to edit. A forgery never does.
const FUNDER = 'GA7VKQBOILVBDABEHRSVW72JM3OI54I2GSCCIHGNMECGUMKHLZG7JCDH';

// The launchpad's fee collector, and the number of operations a mint transaction has. Both are read
// by mintedByUs() below; see the note there for why paying this address is part of what proves a mint.
// Kept in step with _tools/_launchpad.js -- if the fee collector moves, it moves in both files.
const FEE_COLLECTOR = 'GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD';
// A mint is 7 operations. 20 leaves room for the shape to grow without this silently reading only part
// of a transaction and concluding the wrong thing from it.
const MINT_OPS = 20;

// LUMOS is listed by name rather than by the funder rule. It is the platform's own token and predates the
// launchpad -- its issuer was created by a different wallet (GBMAZPFH…), so the rule below correctly does
// not recognise it. Naming it here is safe for the same reason the rule is: this file is our assertion, and
// we are the ones asserting. Note its issuer still declares home_domain=lumosdao.io on chain, so a wallet
// doing the SEP-1 round trip for LUMOS resolves via that domain's toml; this entry keeps our own document
// complete and is already correct should the issuer's home_domain ever move here.
const PLATFORM = [{
  code: 'LUMOS',
  issuer: 'GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S',
  name: 'Lumos Core',
  // MUST BE MIRRORED to lumosdao.io/.well-known/stellar.toml, which is NOT in this repo. That domain is
  // the LUMOS issuer's on-chain home_domain, so it is the document wallets actually resolve through via
  // the SEP-1 round trip; this one is our own assertion and must not tell a different story about the
  // same asset. The two were byte-identical until 2026-10-10 and this rewrite breaks that until the
  // other host is updated with the identical string. If you change the text below, change it there too.
  //
  // Three things this field deliberately does NOT say, each having been in the previous wording:
  //
  //   SUPPLY. The old text said "fixed 1B supply". Two faults: the real figure was 999,988,097.152, and
  //   more importantly LUMOS can be burned by anyone holding it, so any number here drifts DOWN while
  //   the document sits in cache for TTL (six hours). A figure that is wrong by the time it is read is
  //   worse than no figure. The issuer being locked is still true and permanent -- master weight 0 with
  //   exactly one signer, so no key reaches threshold 1 and nothing can ever mint more -- but stating it
  //   invites the supply question back, so it is left out on purpose.
  //
  //   THE FEE THRESHOLD. "Hold 250K to halve trading fees" is a call to action in a verification
  //   document. The same fact stated as a fact -- holders receive reduced fees -- carries the
  //   information without the ask.
  //
  //   EXPLORERS. The old text promised "Wallets & Explorers"; lumoscore.com/explorer returns 404. The
  //   multichain explorer is roadmap, not shipped. Do not put it back here before the route is live.
  //
  // The platform pitch belongs to ORG_DESCRIPTION in the [DOCUMENTATION] section, not here. An asset's
  // desc describes the asset. The old wording did both jobs, which is what made it read as a sales page.
  desc: 'The native token of LumosCore, a multichain platform for token launches, DEX trading, liquidity and cross-chain transfers. LUMOS carries reduced trading fees for holders and is distributed to liquidity providers.',
  image: 'https://lumoscore.com/assets/tokens/lumos.png',
}];
const DOMAIN = 'lumoscore.com';
// GUARDRAILS E12: a second host, because Horizon rate-limits at 100 requests per 5 minutes per IP and a
// throttled verification must not be mistaken for a failed one.
const HOSTS = ['https://horizon.stellar.org', 'https://horizon.stellar.lobstr.co'];
// A FULL-HISTORY Horizon, for the creations the two above no longer hold. SDF keeps a rolling window and
// it has now advanced past the launchpad's first months: measured 2026-11-09, the oldest operation SDF
// still holds for TDT's issuer is dated 2025-11-03 while the account was created 2025-07-13, so the
// create_account is simply gone. This node answers it — same Horizon API and the same create_account
// record, so nothing downstream changes shape. Checked against all 27 assets in the icon manifest: it
// returned the creation for every one, 25 of them funded by FUNDER below.
//
// Trusting one node to report a creation is not the hole it looks like: a candidate only reaches this
// check by already being in a file WE write, so a node that lied could at most vouch for an asset we had
// already listed ourselves. The two SDF hosts still answer first for anything inside their window.
const FULL_HISTORY = 'https://pubnet.stellarchain.io';
// Its first read of an account is slow — measured 14s average, 23s worst, against 1.4s once served. Six
// seconds would abort every one of them, so this path gets its own allowance. It is paid at most once per
// asset ever, because the verdict is then cached permanently (see VERDICTS).
//
// NOT set to the 23s worst case, deliberately. These run in parallel, so the slowest one sets how long the
// whole document takes, and a Pages Function that sits too long is a 524 — no toml at all, which is far
// worse than a short one. Whatever does not answer in time stays unknown, and the next pass five minutes
// later finds it already warm. Converging is the mechanism; no single pass has to finish the job.
const FULL_TIMEOUT_MS = 12000;
const PASSPHRASE = 'Public Global Stellar Network ; September 2015';

// WHY A VERDICT IS CACHED FOREVER AND NEVER RE-DERIVED. Both facts behind it are immutable: an account's
// creator is fixed at creation, and the transaction that created it can never be rewritten. So a definite
// answer is a permanent one. Only definite answers are stored — a null (timeout, throttle, out of
// allowance) is never written, or a bad minute upstream would be frozen into the record.
//
// This is also what makes the document converge on its own. A cold cache cannot verify 31 assets inside
// one Worker's 50 subrequests, so the first pass gets part of the way, stores what it proved, and says it
// is incomplete — which caches the file for TTL_ERR rather than TTL, so five minutes later another pass
// starts from what the first one already knew. No sweep, no state machine; the cache IS the progress.
const VERDICTS = 'toml:verdict:v1';

// Mints are rare, so the file can be cached hard. This also keeps Horizon load near zero: one refresh
// every six hours regardless of how many people or wallets fetch the toml.
const TTL = 21600;
const TTL_ERR = 300;
const TIMEOUT_MS = 6000;

// Free-plan Workers allow 50 subrequests per invocation and we spend one per issuer verification. The cap
// is stated in the output rather than silently truncating -- a toml that quietly drops assets is worse than
// one that says it is incomplete. Workers Paid raises the limit to 10,000, which removes the ceiling.
const MAX_VERIFY = 45;
// Every verification attempt, first tries and RETRIES alike, draws from this. 50 minus the two spent on
// candidates() and the icon manifest, minus a small margin. In practice ~19 assets claim our domain, so
// the first pass costs ~19 and the rest is retry headroom; the cap only binds if that grows a lot.
const VERIFY_BUDGET = 46;

// The slow pass behind the response draws from the SAME 50 subrequests the response itself did — a
// waitUntil is still part of this invocation, not a new one. So the two allowances are split rather than
// each given the whole ceiling: the response takes what it needs from VERIFY_BUDGET and what is left
// bounds the background pass. DEEP_MAX is the stricter of the two limits in practice, and it is there for
// wall-clock, not subrequests: these run in parallel against a node that can take 14s to answer.
const DEEP_BUDGET = 14;
const DEEP_MAX = 10;

// WHERE A LAUNCHPAD MINT'S LOGO COMES FROM, and why not from stellar.expert.
//
// This file used to take every asset's image from stellar.expert's tomlInfo. That silently published
// nothing, because stellar.expert fills tomlInfo by reading THIS document -- so the image could only ever
// appear here if it already appeared here. Measured before the fix: 10 [[CURRENCIES]] blocks, one image=
// line, and that one the hardcoded LUMOS entry. Every launchpad token went out with no logo at all.
//
// The loop is broken by publishing images WE host. _tools/_launchicons.js writes the launchpad icons to
// assets/tokens/ and emits this manifest alongside them, so an image can only be named here if the file
// it names was written in the same run.
//
// It is read over HTTP rather than baked in so that adding an icon needs no edit to this file, and a
// missing or malformed manifest degrades to exactly the previous behaviour instead of breaking the toml.
const ICON_MANIFEST = '/assets/tokens/launchpad-icons.json';

// Serve image URLs on the origin this document was served from. A wallet only ever reads the copy at
// lumoscore.com, so in production these are lumoscore.com URLs; on a preview deploy they point at that
// preview, which is what makes the result checkable there instead of only after going live.
function originOf(request) {
  try {
    const u = new URL(request.url);
    if (u.protocol === 'https:' && /^[A-Za-z0-9.-]{1,253}$/.test(u.hostname)) return u.origin;
  } catch (e) { /* fall through */ }
  return 'https://' + DOMAIN;
}

// Never throws and never blocks the document: a toml without images is degraded, a toml that 500s is
// broken, and a broken one un-verifies every asset we have.
async function iconManifest(origin) {
  try {
    const r = await withTimeout(origin + ICON_MANIFEST);
    if (!r.ok) return {};
    const m = await r.json();
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    const out = {};
    for (const k of Object.keys(m)) {
      // An entry is either a bare path (older writes) or {image, name}. Both are accepted so the manifest
      // can gain names without invalidating what is already published.
      const v = m[k];
      const img = (v && typeof v === 'object') ? v.image : v;
      const name = (v && typeof v === 'object' && typeof v.name === 'string') ? v.name.slice(0, 80) : '';
      // desc rides along with name. Without this it is read off the manifest and thrown away, so every
      // asset we host falls through to the client's generic line and they all read identically.
      // Split/join rather than a regex: this is written into a double-quoted TOML string, and a stray
      // quote or newline there would break the document for every wallet that parses it.
      const desc = (v && typeof v === 'object' && typeof v.desc === 'string')
        ? v.desc.split('"').join('').split("'").join('')
                .split('\r').join(' ').split('\n').join(' ')
                .split('\t').join(' ').trim().slice(0, 300) : '';
      // An entry with NO image is still kept. The manifest doubles as our register of which assets are
      // ours, and several are ours without artwork yet -- RICHARD, PUMP, PEPE, ZBS, FED, NEIRO and HULK
      // all declare our domain and were minted by our wallet, but stellar.expert records no domain for
      // them, so nothing else surfaces them. Dropping them here would keep them invisible for want of a
      // picture. They are still funder-checked below before anything is published.
      //
      // When there IS an image it must be a same-origin absolute path: a manifest that could name an
      // arbitrary host would let one bad write point every wallet at someone else's picture.
      const ok = typeof img === 'string' && img.charAt(0) === '/' && img.indexOf('//') !== 0;
      out[k] = { image: ok ? origin + img : '', name, desc };
    }
    return out;
  } catch (e) { return {}; }
}

function tomlResponse(body, ttl) {
  return new Response(body, {
    status: 200,
    headers: {
      // SEP-1 requires the file be readable cross-origin, or wallets cannot fetch it at all
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=' + ttl,
    },
  });
}

function withTimeout(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || TIMEOUT_MS);
  return fetch(url, { signal: ctl.signal, cf: { cacheTtlByStatus: { '200-299': TTL, '300-399': 0, '400-599': 0 }, cacheEverything: true } })
    .finally(() => clearTimeout(t));
}

// TOML strings are double-quoted; a stray quote or newline in an asset name would otherwise break the
// document for every consumer, so anything interpolated goes through here.
function q(v) {
  return '"' + String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim() + '"';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every upstream call shares one allowance, because exceeding it is not a slow response -- the Worker is
// killed and the whole document 502s. Retries draw from the same pool as first attempts, so a bad day
// upstream degrades this into "some assets undetermined" instead of "no toml at all".
function budget(n) {
  return { left: n, take() { if (this.left <= 0) return false; this.left--; return true; } };
}

// Was this issuer account created by us? The first operation on any account is its creation, and the
// funder recorded there cannot be changed afterwards.
//
// THREE-VALUED ON PURPOSE: true = ours, false = provably not ours, null = could not determine.
// It used to return false for any non-ok response, which quietly turned a Horizon 429 into "not ours" and
// dropped a real asset out of the document -- the list would shrink under rate-limiting and then be cached
// that way for six hours, with nothing to say it had. A null is never published (we must not vouch for an
// asset we could not check) but it IS counted, stated in the file, and it shortens the cache lifetime.
//
// `deep` DECIDES WHETHER THE SLOW SOURCE MAY BE ASKED, and it is false while a response is being built.
// The full-history node answers in ~14s the first time it is asked about an account, so reaching for it
// here made every refresh of this document a 13-second response — measured, five passes in a row. The
// document is served from what is already settled and the slow half runs behind it; see deepPass().
async function fundedByUs(issuer, b, deep) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!b.take()) return null;                       // out of allowance -> unknown, NOT a denial
    try {
      const host = HOSTS[attempt % HOSTS.length];
      const r = await withTimeout(host + '/accounts/' + issuer + '/operations?order=asc&limit=1');
      // Throttled or upstream-broken: retryable, and emphatically not an answer.
      if (r.status === 429 || r.status >= 500) { await sleep(250 * (attempt + 1)); continue; }
      // A 404 HERE IS NOT "no such account". This asks for an account's OPERATIONS, and Horizon answers 404 when it holds
      // none for it — which is what a rolling history window produces for an old account. Measured: POTATO, ZOMBIE, JROLL
      // and MILL all answer 404 on this path while `/accounts/{id}` answers 200, so the accounts plainly exist and the
      // comment that used to sit here ("no such account, so it is certainly not one we funded") was wrong about all four.
      // Their creator is still on the ledger; it is only this node that has stopped keeping it, so ask a full-history one.
      if (!r.ok) return deep ? await createdByFunder(issuer, b) : null;
      const d = await r.json();
      const op = ((d._embedded || {}).records || [])[0] || {};
      if (op.type === 'create_account') {
        if ((op.funder || op.source_account) === FUNDER) return true;
        // Not funded by our wallet -- which on mainnet is the NORMAL case, not a red flag. Fall through
        // to the launchpad-shape check below rather than denying here.
        return await mintedByUs(op.transaction_hash, issuer, b, host);
      }
      // THE CREATION HAS AGED OUT OF HORIZON, WHICH IS NOT A DENIAL (RAZA 2026-09-17: "Trade Titan (TDT) is not in
      // lumoscore.com/.well-known/stellar.toml"). This read the FIRST RETAINED operation and treated anything that was not
      // a create_account as proof the account was not ours. SDF's Horizon keeps a rolling window, not full history: TDT's
      // issuer was created 2025-07-13 and the oldest operation Horizon still holds for it is dated 2025-11-03, so the
      // creation is simply gone. For five others -- POTATO, REKT, ZOMBIE, JROLL, MILL -- Horizon returns no operations at
      // all. All seven were created by our own funding wallet, and all seven had quietly fallen out of this document; the
      // list was 24 when it was written and was 22 when he asked. It would have kept shrinking as the window advanced.
      return deep ? await createdByFunder(issuer, b) : null;
    } catch (e) { await sleep(250 * (attempt + 1)); }  // timeout / network -> retry, do not conclude
  }
  return null;
}

// The creator of an account, for the case above where Horizon no longer holds the creation itself.
//
// An account's creator is fixed at creation and permanent on the ledger — that is the whole basis of the rule this file
// enforces — so the fact is not in question; only whether the node we asked still keeps a record of it.
//
// IT USED TO BE ASKED OF stellar.expert, AND THAT ENDPOINT WENT PAID. Around 2026-11-08 api.stellar.expert put its
// per-item endpoints behind x402 micropayments — /account/<id> among them — so this returned null for every asset
// whose creation had aged out of SDF's window, which by now is nearly all of them. (Its LIST endpoints are still
// free; see candidates(). The failure was narrow and the diagnosis must be too.) Measured on production 2026-11-09:
// the document carried 4 launchpad assets and the line "27 asset(s) could not be verified in this request". Those 27
// were not unverifiable; they were unasked. RAZA saw it as LumosCore mints losing their logos in LOBSTR, which reads
// this file to decide whether an asset's home_domain claim is real.
//
// It is asked of the ledger directly now. create_account records the funder, and that is the same fact stellar.expert
// was reporting second-hand, so this is a narrower trust, not a wider one.
//
// Three-valued like everything else here: true = created by our wallet, false = created by someone else (a real answer
// from a full-history source), null = could not determine, which is never published.
async function createdByFunder(issuer, b) {
  if (!b.take()) return null;
  let r;
  try {
    r = await withTimeout(FULL_HISTORY + '/accounts/' + issuer + '/operations?order=asc&limit=1', FULL_TIMEOUT_MS);
  } catch (e) { return null; }                           // timeout -> unknown, and so not cached as a no
  if (r.status === 429 || r.status >= 500) return null;
  if (!r.ok) return null;
  let op;
  try { op = ((((await r.json())._embedded) || {}).records || [])[0] || {}; } catch (e) { return null; }
  // A full-history node that does not lead with the creation is not answering the question that was asked.
  if (op.type !== 'create_account') return null;
  if ((op.funder || op.source_account) === FUNDER) return true;
  // CREATED BY SOMEONE ELSE IS NOT THE END OF IT. Every mainnet mint is funded by the MINTER's own wallet (see
  // mintedByUs), so once a mainnet launch is old enough to fall out of SDF's window it arrives here looking exactly
  // like a stranger's token. Judging it on the funder alone would start silently dropping real launches the moment
  // they aged — the same failure as above, on a timer. The mint transaction still proves it, and still has to.
  return await mintedByUs(op.transaction_hash, issuer, b, HOSTS[0]);
}

// Was this issuer minted through our launchpad, judged from the transaction that created it?
//
// WHY THIS EXISTS ALONGSIDE THE FUNDER CHECK. FUNDER was the whole test while the launchpad ran on
// testnet, where a LumosCore wallet created every issuer with friendbot. The mainnet migration moved
// that to the MINTER's own wallet -- there is no friendbot on mainnet, so the connected wallet funds
// the new issuer with real XLM. From that day the funder check could never be true for a real mint,
// and every mainnet launchpad token was silently refused a place in this document. FUNDER's own last
// operation is dated 2026-08-02, right when the migration landed.
//
// WHAT IS BEING TRUSTED. Not "someone paid us" on its own -- a dust payment would be trivial to fake.
// The whole transaction has to look like a launchpad mint: it created this issuer, it paid our fee
// collector in XLM, and it locked the issuer by zeroing its master weight. Reproducing that means
// actually paying us and actually surrendering control of the issuer, which is not a forgery of a
// LumosCore mint so much as a description of one.
//
// ADDITIVE, deliberately: an asset that satisfied the old rule still satisfies it, on the same code
// path, before this function is ever called. Nothing that appears in today's document can drop out.
async function mintedByUs(txHash, issuer, b, host) {
  if (!txHash) return false;
  if (!b.take()) return null;                         // no allowance left -> unknown, never a denial
  let r;
  try {
    r = await withTimeout(host + '/transactions/' + encodeURIComponent(txHash) + '/operations?limit=' + MINT_OPS);
  } catch (e) { return null; }                        // timeout -> unknown, so it is not cached as a no
  if (r.status === 429 || r.status >= 500) return null;
  if (!r.ok) return false;

  let recs;
  try { recs = (((await r.json())._embedded) || {}).records || []; } catch (e) { return null; }

  let paidUs = false, locked = false;
  for (const op of recs) {
    if (op.type === 'payment' && op.to === FEE_COLLECTOR && op.asset_type === 'native'
        && parseFloat(op.amount) > 0) paidUs = true;
    // The lock has to be on THIS issuer: a transaction may set options on more than one account, and
    // "some account in this transaction was locked" is not the same claim.
    if (op.type === 'set_options' && op.source_account === issuer
        && String(op.master_key_weight) === '0') locked = true;
  }
  return paidUs && locked;
}

// THE SLOW HALF, RUN BEHIND THE RESPONSE. Everything the fast sources could not settle is asked of the
// full-history node here, and whatever it proves is written to the verdict record — so it is the NEXT
// refresh that publishes the result, five minutes later, and no reader ever waits for this.
//
// It does not have to finish. Each pass proves a few more, the record keeps them, and the document stops
// saying it is incomplete once the record covers everything. Measured from an empty record against a cold
// node: a few assets per pass, complete inside an hour, and then nothing runs here again — a settled
// asset is read straight out of the record and costs no upstream call at all.
// `fresh` is what the response itself proved on the way past. It is written HERE rather than alongside
// the response because two writers would race: a second put built from a read taken before the first one
// landed would silently drop whatever the first had just proved. One reader, one merge, one write.
async function deepPass(kvb, issuers, fresh) {
  if (!kvb) return;
  const take = issuers.slice(0, DEEP_MAX);
  let got = [];
  if (take.length) {
    const b = budget(DEEP_BUDGET);
    got = await Promise.all(take.map((i) => createdByFunder(i, b).catch(() => null)));
  }
  // Read LAST, after the slow lookups: another invocation may have proved something while they ran, and
  // this write must add to that rather than roll it back.
  let known = {};
  try { known = (await kvb.get(VERDICTS, 'json')) || {}; } catch (e) { known = {}; }
  if (!known || typeof known !== 'object' || Array.isArray(known)) known = {};
  let learned = 0;
  for (const i of fresh) if (known[i] !== true) { known[i] = true; learned++; }
  for (let i = 0; i < take.length; i++) {
    if (got[i] === true && known[take[i]] !== true) { known[take[i]] = true; learned++; }
  }
  if (learned) { try { await kvb.put(VERDICTS, JSON.stringify(known)); } catch (e) { /* next pass retries */ } }
}

// THIS ONE STILL WORKS, and it is worth being precise about why. stellar.expert went to paid access
// THIS ONE STILL WORKS, and it is worth being precise about why. stellar.expert went to paid access
// around 2026-11-08, but per ENDPOINT, not wholesale: measured 2026-11-10, the LIST endpoint below
// answers 200 while every per-item endpoint — /asset/<id>, /account/<id>, /liquidity-pool,
// /liquidity-pool/<id>, /ledger/ledger-stats, /asset-stats/overall, .../holders — answers 402. So
// discovery is intact and it is only the per-asset lookups that had to be rebuilt elsewhere. Do not
// conclude from one 402 here that the whole API is gone; check the endpoint you actually need.
async function candidates() {
  const u = 'https://api.stellar.expert/explorer/public/asset?search=' + DOMAIN + '&limit=200';
  const r = await withTimeout(u);
  if (!r.ok) return [];
  const d = await r.json();
  const recs = (d && d._embedded && d._embedded.records) || [];
  const out = [];
  for (const rec of recs) {
    if (String(rec.domain || '').toLowerCase() !== DOMAIN) continue;
    const dash = String(rec.asset || '').indexOf('-');
    if (dash < 1) continue;
    const code = rec.asset.slice(0, dash);
    const issuer = rec.asset.slice(dash + 1).split('-')[0];
    if (!/^G[A-Z2-7]{55}$/.test(issuer)) continue;
    const ti = rec.tomlInfo || rec.toml_info || {};
    out.push({ code, issuer, name: ti.name || rec.name || '', image: ti.image || '', desc: ti.desc || '' });
  }
  return out;
}

// WHAT THE TRADE-ASSET PAGE READS FOR AN ASSET WE PUBLISH, so our own copy reaches our own page.
//
// RAZA 2026-10-11: "fix lumos trade asset description according to toml."
//
// The page's description comes from assetFacts(), which asks stellar.expert, which resolves the
// asset's home_domain and reads the toml it finds there. For LUMOS that is lumosdao.io -- the issuer
// declares it on chain -- and that file still carries the pre-2026-10-10 wording. So the page was
// faithfully showing the authoritative document; it was just not OUR document.
//
// This does not change which document is authoritative, and it must not: SEP-1 says the home_domain
// copy is the one wallets read, and the two should be made to agree at the source. What it changes is
// narrower and defensible -- on OUR OWN pages, for the assets OUR OWN toml describes, we prefer what
// we publish over a third party's cached copy of someone else's file. Same thing xrplAssetMeta() does
// for the XRP Ledger, so the two chains behave alike.
//
// SCOPE IS DELIBERATELY SMALL: the platform assets named in PLATFORM, and the mints in our icon
// manifest -- which we write, so it cannot be forged by a token pointing home_domain at us. An asset
// we do not publish is untouched and keeps whatever stellar.expert knows.
export async function stellarAssetMeta(request, assetId) {
  try {
    const id = String(assetId || '');
    const cut = id.indexOf('-');
    if (cut < 1) return null;
    const code = id.slice(0, cut), issuer = id.slice(cut + 1);

    for (const p of PLATFORM) {
      if (p.code === code && p.issuer === issuer) {
        return { name: p.name || '', desc: p.desc || '', image: p.image || '' };
      }
    }

    // Our own register of mints. Keyed CODE-ISSUER, so a ticker alone cannot match.
    const man = await iconManifest(originOf(request));
    const e = man && man[id];
    if (e && (e.name || e.desc)) {
      return { name: e.name || '', desc: e.desc || '', image: e.image || '' };
    }
  } catch (e) { /* no override is a valid answer */ }
  return null;
}

export async function onRequestGet(ctx) {
  const origin = originOf(ctx && ctx.request);
  const head = [
    '# LumosCore — SEP-1 stellar.toml',
    '#',
    '# Lists the assets minted through the LumosCore launchpad on Stellar mainnet.',
    '# An asset appears here only if the ledger proves it was minted here: either its issuer account was',
    '# created by the LumosCore funding wallet, or the transaction that created its issuer also paid the',
    '# LumosCore mint fee and locked that issuer. Both are recorded on the ledger and neither can be',
    '# forged. Declaring home_domain=lumoscore.com is not sufficient on its own.',
    '',
    'VERSION="2.0.0"',
    'NETWORK_PASSPHRASE=' + q(PASSPHRASE),
    '',
    '[DOCUMENTATION]',
    'ORG_NAME="LumosCore"',
    'ORG_URL="https://lumoscore.com"',
    'ORG_LOGO="https://lumoscore.com/assets/tokens/lumos.png"',
    'ORG_DESCRIPTION="Multi-chain DeFi on Stellar — trade, pools, launchpad and cross-chain bridge."',
    '',
  ];

  let list, icons;
  // iconManifest never rejects, so this still fails exactly and only when the asset list does.
  // Approved launchpad metadata, merged on top of the static manifest. The manifest is written into
  // the repo at build time, so a token minted by a stranger can never appear in it -- which is why a
  // mint's own name, description and logo never reached this document. mintmeta.js keeps them in one
  // KV key, already reviewed, in exactly the shape the manifest uses, so the merge is a merge and the
  // emitter below is untouched. A missing binding or a bad value degrades to the manifest alone.
  // The verdict record. A missing binding or a bad value degrades to "nothing is known yet", which is the
  // behaviour this file had before the record existed — slower, never wrong.
  const kvb = (ctx && ctx.env && ctx.env.CONTENT_KV) || null;
  let known = {};
  try { if (kvb) known = (await kvb.get(VERDICTS, 'json')) || {}; } catch (e) { known = {}; }
  if (!known || typeof known !== 'object' || Array.isArray(known)) known = {};

  let approved = {};
  try {
    const kv = ctx && ctx.env && ctx.env.CONTENT_KV;
    if (kv) approved = (await kv.get('mintmeta:approved', 'json')) || {};
    if (!approved || typeof approved !== 'object' || Array.isArray(approved)) approved = {};
    // Same-origin absolute paths only, and made absolute here -- the identical rule the manifest gets,
    // for the identical reason: one bad write must not be able to point every wallet at another host's
    // picture. An image that does not satisfy it is dropped, not published relative.
    for (const k of Object.keys(approved)) {
      const v = approved[k] || {};
      const img = v.image;
      const okImg = typeof img === 'string' && img.charAt(0) === '/' && img.indexOf('//') !== 0;
      approved[k] = { name: v.name || '', desc: v.desc || '', image: okImg ? origin + img : '' };
    }
  } catch (e) { approved = {}; }

  try { [list, icons] = await Promise.all([candidates(), iconManifest(origin)]); }
  catch (e) { return tomlResponse(head.join('\n') + '\n# asset list temporarily unavailable\n', TTL_ERR); }

  // THE CANDIDATE LIST CANNOT COME FROM stellar.expert ALONE. Its index does not carry every asset that
  // declares our domain -- WAZAAA, GROK, WHALEUM and XLIQM are all absent from it, and were therefore
  // never even considered here, which looked from the outside exactly like failing verification. They
  // are not: each one's issuer was created by our funding wallet, checked on the ledger.
  //
  // The icon manifest knows CODE and ISSUER for every asset we host, so it is seeded as candidates too.
  // This widens who gets ASKED, never who gets believed: the funder rule below still decides, so an
  // entry appearing here cannot vouch for itself.
  for (const k of Object.keys(icons)) {
    const dash = k.indexOf('-');
    if (dash < 1) continue;
    const code = k.slice(0, dash), issuer = k.slice(dash + 1);
    if (!/^[A-Za-z0-9]{1,12}$/.test(code) || !/^G[A-Z2-7]{55}$/.test(issuer)) continue;
    const mi = icons[k] || {};
    const hit = list.find((a) => a.code === code && a.issuer === issuer);
    if (hit) {
      // Already discovered through stellar.expert. Its tomlInfo is a mirror of THIS document, so it can
      // never be the source of a description we have not published yet -- the manifest is. Fill in only
      // what the discovered record is missing, so a real upstream value is never overwritten.
      if (!hit.name && mi.name) hit.name = mi.name;
      if (!hit.desc && mi.desc) hit.desc = mi.desc;
      continue;
    }
    list.push({ code, issuer, name: mi.name || '', image: '', desc: mi.desc || '' });
  }

  // A token minted MINUTES ago is in NEITHER source above, so until now it could not appear here at all:
  // the icon manifest is written into the repo at build time, and stellar.expert's index both lags a
  // fresh issuance and (see the note above) misses assets outright. The approved map was therefore only
  // ever able to ENRICH an asset something else had already discovered -- never to introduce one.
  // Measured 2026-09-03: BOMB (GDK6R7M6…) minted correctly, home_domain set, issuer locked, fee paid, its
  // metadata accepted and stored by mintmeta.js, and it still did not appear in this document.
  //
  // Seeding candidates from the mint registry closes that. It is the same widening as the manifest and
  // carries the same guarantee: this changes who gets ASKED, never who gets believed -- mintedByUs still
  // decides, on the ledger. Nor can a stranger stuff this list: mintmeta.js verifies the mint on chain
  // BEFORE it writes, so every key here is already a real launch that paid us and locked its issuer.
  // Seeded at the FRONT because a fresh mint is precisely the entry MAX_VERIFY would otherwise truncate.
  const fresh = [];
  for (const k of Object.keys(approved)) {
    const dash = k.indexOf('-');
    if (dash < 1) continue;
    const code = k.slice(0, dash), issuer = k.slice(dash + 1);
    if (!/^[A-Za-z0-9]{1,12}$/.test(code) || !/^G[A-Z2-7]{55}$/.test(issuer)) continue;
    if (list.some((a) => a.code === code && a.issuer === issuer)) continue;
    fresh.push({ code, issuer, name: '', image: '', desc: '' });
  }
  if (fresh.length) list = fresh.concat(list);

  const checked = list.slice(0, MAX_VERIFY);
  const b = budget(VERIFY_BUDGET);
  // An asset already proved costs nothing to list again — no subrequest, no wait — so the allowance is
  // spent only on issuers this document has never settled. Keyed by ISSUER, not by code: the question is
  // who created the account, and one account issuing two codes has one answer.
  const verdicts = await Promise.all(checked.map((a) => (
    known[a.issuer] === true ? true : fundedByUs(a.issuer, b, false)
  )));
  const unknown = verdicts.filter((v) => v === null).length;

  // ONLY A YES IS KEPT. A null is an unanswered question rather than a no, and that much was always true
  // here — but a no is not kept either, and that part is new. Caching forever changes what a mistake
  // costs: a stray false would previously have been retried on the next refresh and now would simply
  // never be revisited, quietly un-listing a real asset for good. A no is cheap to re-derive (two assets
  // in the current list, a handful of subrequests every six hours) and a yes is the expensive one, so
  // this spends nothing to remove the whole class of permanent mistake.
  const proved = checked.filter((a, i) => verdicts[i] === true && known[a.issuer] !== true).map((a) => a.issuer);
  const stuck = checked.filter((_, i) => verdicts[i] === null).map((a) => a.issuer);
  // Behind the response, never in front of it: the full-history node takes ~14s on a first read and there
  // are `unknown` of them to do. The document below is already decided; this only moves the NEXT one on.
  if (kvb && (proved.length || stuck.length) && ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(deepPass(kvb, stuck, proved).catch(() => {}));
  }
  // Platform assets first, then launchpad mints. Deduped by code|issuer so a platform asset that also
  // satisfies the funder rule cannot appear twice and give two conflicting entries for one asset.
  const seen = new Set();
  const ours = [];
  for (const a of PLATFORM.concat(checked.filter((_, i) => verdicts[i] === true))) {
    const k = a.code + '|' + a.issuer;
    if (seen.has(k)) continue;
    seen.add(k); ours.push(a);
  }

  const body = [head.join('\n')];
  if (list.length > MAX_VERIFY) {
    body.push('# NOTE: ' + list.length + ' candidate assets found but only the first ' + MAX_VERIFY
      + ' could be verified in this request; the rest are omitted rather than listed unchecked.', '');
  }

  // ADMIN EDITS WIN (RAZA 2026-11-24, JENSEN: "I mistakenly wrote Billion instead of Million. I edited it from the
  // admin token edit description but doesnt work"). The admin Edit dialog writes KV asset:<CODE-ISSUER> and says
  // "Edited fields override it" -- but this document never read that key, so a launch typo stayed published here for
  // every wallet, explorer and our own asset page (which reads this file directly and overwrote the corrected line).
  // An admin-edited name / description / same-origin logo now wins over the launch record and the manifest.
  const adminMeta = {};
  if (kvb) {
    await Promise.all(ours.map(async (a) => {
      const k = a.code + '-' + a.issuer;
      try { const m = await kvb.get('asset:' + k, 'json'); if (m && typeof m === 'object' && !Array.isArray(m)) adminMeta[k] = m; } catch (e) { /* the launch record still answers */ }
    }));
  }
  for (const a of ours) {
    const c = ['[[CURRENCIES]]', 'code=' + q(a.code), 'issuer=' + q(a.issuer), 'display_decimals=7'];
    const ad = adminMeta[a.code + '-' + a.issuer] || {};
    const adName = typeof ad.name === 'string' ? ad.name.trim() : '';
    const adDesc = typeof ad.description === 'string' ? ad.description.trim() : '';
    const adImg = (typeof ad.image === 'string' && ad.image.charAt(0) === '/' && ad.image.indexOf('//') !== 0) ? origin + ad.image : '';
    // Our own manifest wins for BOTH fields. a.name/a.image (stellar.expert's tomlInfo) stay as the
    // fallback: correct for an asset that publishes through some other domain, and empty for our mints.
    // Reviewed mint metadata first, then the build-time manifest, then stellar.expert's tomlInfo. The
    // order is deliberate: an approved submission is the most recent thing a human looked at.
    const ok = approved[a.code + '-' + a.issuer] || {};
    const mine = icons[a.code + '-' + a.issuer] || {};
    const name = adName || ok.name || mine.name || a.name;
    const img = adImg || ok.image || mine.image || a.image;
    const desc = adDesc || ok.desc || a.desc;
    if (name) c.push('name=' + q(name));
    if (desc) c.push('desc=' + q(desc));
    if (img) c.push('image=' + q(img));
    // These are launchpad-issued tokens, not claims on an off-chain reserve. Saying so explicitly stops a
    // reader inferring a backing that does not exist.
    c.push('is_asset_anchored=false');
    body.push(c.join('\n'), '');
  }

  // An incomplete list must say so and must not be cached hard. Six hours of a silently shortened toml
  // would un-verify a real asset across every wallet that reads this file.
  if (unknown) {
    body.push('# NOTE: ' + unknown + ' asset(s) could not be verified in this request (upstream '
      + 'unavailable or rate-limited). They are omitted rather than listed unchecked, and this document '
      + 'is cached briefly so it refreshes soon.', '');
  }

  if (!ours.length) body.push('# no verified LumosCore assets found at this time', '');
  return tomlResponse(body.join('\n'), (ours.length && !unknown) ? TTL : TTL_ERR);
}
