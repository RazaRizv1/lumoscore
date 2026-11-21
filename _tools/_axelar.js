// Cross-chain, FOURTH route: Axelar Interchain Token Service.
//
// WHY IT EXISTS: it is the only live corridor between LumosCore's two chains. CCTP has no XRPL domain, the USDT0 OFT
// has no XRPL peer (proved by scanning every mainnet eid from 30101 to 30700), and NEAR Intents lists XRP but returns
// a 500 on it in both directions. Axelar reaches XRPL and XRPL EVM, and both are in the Stellar ITS contract's own
// trusted-chain list.
//
// THE CALL, verified against mainnet by simulateTransaction from a real SHX holder before a line of this was written
// (it returned OK, minResourceFee 52122):
//   interchain_transfer(caller: Address, token_id: BytesN<32>, destination_chain: String,
//                       destination_address: Bytes, amount: i128, metadata: Option<Bytes>, gas_token: Option<Token>)
//   Token is a map {address: Address, amount: i128}; gas is paid in the XLM Stellar Asset Contract.
// Two things that are not guessable and cost hours if assumed:
//   * destination_address IS NOT ONE ENCODING. It is per destination chain, and the Stellar contract does not
//     check it -- see DEST ENCODING below. An earlier version of this comment said "the ASCII bytes of the address
//     string ... raw 20 bytes is refused", which is true for XRPL and WRONG for EVM; it was written from XRPL
//     testing alone and the EVM half was never exercised.
//   * the chain string is CASE-SENSITIVE, and not in the case axelarscan's registry prints. Read 2026-11-10 from
//     the contract's own is_trusted_chain: 'Ethereum', 'solana', 'xrpl', 'xrpl-evm' and 'hedera' are TRUE;
//     'ethereum', 'Solana', 'XRPL' and 'monad' are FALSE. Do not "tidy" these into one case.
//
// DEST ENCODING, each taken from a real executed mainnet transfer's own payload, not from docs:
//   Ethereum  RAW 20 BYTES. A real call carries `...0014ce16f69375520ab01377ce7b88f5ba8c48f8d666` -- length 0x14.
//   solana    RAW 32 BYTES, i.e. the recipient's base58 wallet address DECODED. A real delivery's mintTo landed in
//             a token account whose owner base58-encodes back to exactly those 32 bytes.
//   xrpl      the ASCII BYTES of the r-address. 2,154 executed transfers all carry the plain r-address.
// THE STELLAR CONTRACT VALIDATES NONE OF THIS. Measured 2026-11-10: raw-20, ASCII-with-0x and ASCII-without-0x all
// simulate OK for 'Ethereum', and raw-32 and ASCII-base58 both simulate OK for 'solana'. The bytes are passed
// through to the destination chain verbatim, so a wrong encoding leaves Stellar and fails over there, where we
// cannot see it. Simulation cannot catch this -- only matching live traffic can.
//
// Reading errors from this contract: ITS raises #13 only for an EMPTY destination_address. A #13 with a non-empty
// one comes from the TOKEN contract underneath, where #13 is TrustlineMissing -- i.e. the caller does not hold the
// asset. A deliberately bogus token_id returns #17 from ITS itself, which is the probe that proves execution got
// past the address check. #10 IS A BALANCE ERROR, not an amount error: with 68.85 SHX and 6.59 XLM in the account,
// 'xrpl' passed at 1 unit and failed at 10,000 SHX, and 'Ethereum' failed at EVERY amount including 1 unit --
// because Ethereum's gas estimate was 26.58 XLM and the account held 6.59. Drop the gas and Ethereum passes at
// once. An earlier comment read #10 as "that amount is not valid", which sent me looking at the amount for an
// hour while the shortfall was in the OTHER asset.
//
// TOKEN IDS COME FROM THE CONTRACT, NEVER FROM THE REGISTRY. axelarscan lists an "XLM" ITS asset under id
// 0xf0d7beb2…, and that id is NOT registered on the Stellar ITS contract (registered_token_address traps on it,
// and interchain_transfer answers #17). The contract's own canonical_interchain_token_id for the XLM SAC is
// 0x03f70cfc…, which DOES resolve -- but that id appears nowhere in Axelar's registry, so it has no counterpart on
// any destination chain. Sending to it would lock XLM on Stellar with nothing to mint on the far side. Hence XLM
// is NOT a transport asset here, however much it looks like one in the registry.
//
// WHAT IT CARRIES, and the honest limit. ITS moves a REGISTERED token, not whatever the user is holding:
//   * SHX -> XRPL works for real. Its Stellar contract is the Stellar Asset Contract for classic SHX (its name() is
//     "SHX:GDSTRSHX...", the CODE:ISSUER form), so SAC balances ARE classic balances and any SHX holder can send.
//   * USDC.axl -> XRPL / XRPL EVM is listed but is NOT Circle USDC. Its contract's name() is plain "USD Coin" -- a
//     pure Soroban ITS token, not a SAC. Circle USDC's real SAC is CCW67TSZ..., a different contract. Someone
//     holding the USDC this bridge already moves does NOT hold USDC.axl and cannot get it through a trustline or
//     the classic DEX, only by bridging it in. So that row is real but thinly useful, which RAZA chose knowingly.
// Because ITS moves a REGISTERED token, whatever the user is sending is swapped into SHX on Stellar first -- the
// same thing CCTP does into USDC and NEAR Intents does into its transport asset. This route originally REFUSED any
// source but SHX, reasoning that turning someone's USDC into SHX is not what "bridge my USDC" means. That was wrong
// twice over: it left the card permanently unavailable for every normal wallet, which is why it looked unlike the
// other three (RAZA 2026-09-23: "Why is Axelar bridge written differently?"), and it was inconsistent with the three
// routes that already convert. The card names what arrives -- "Receive SHX", "Stronghold SHX to the XRP Ledger" --
// and the route is only ever chosen deliberately, so the conversion is visible rather than silent.
//
// Gated like the other two optional routes: sendable only in an LZ_LIVE build until a real transfer has round-tripped.
//
// THE BROWSER CODE IS A REAL FUNCTION (serialised with toString), so `node --check` on this file checks what ships --
// no template literal, so no eaten backslashes and no backtick that can terminate the block early.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const { LZ_LIVE } = require(__dirname + '/_lzflag.js');
const B = String.fromCharCode(92);

function runtime(AX_SENDABLE) {
  // Mainnet addresses, taken from axelar-contract-deployments/axelar-chains-config/info/mainnet.json -- the
  // deployment config Axelar itself publishes -- not from a docs page. ITS version() answers "2.1.1".
  var ITS = 'CBDBMIOFHGWUFRYH3D3STI2DHBOWGDDBCRKQEUB4RGQEBVG74SEED6C6';
  var XLM_SAC = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
  // THREE DESTINATIONS, and the set is not a preference -- it is everything the chain data allows. Measured
  // 2026-11-10: Axelar's ITS registry holds 152 assets, SIX of them registered on Stellar (USDC.axl, solvBTC,
  // xSolvBTC, SHX, XLM, DT0), and only SHX is both holdable on Stellar (its Stellar contract is the Stellar Asset
  // Contract for classic SHX -- name() is "SHX:GDSTRSHX...", the CODE:ISSUER form, so SAC balances ARE classic
  // balances) and registered on a chain the Stellar ITS contract trusts. SHX reaches Ethereum, solana and xrpl.
  // Everything else was excluded by measurement, not by taste:
  //   * USDC.axl is NOT Circle USDC. Its name() is plain "USD Coin" -- a pure Soroban ITS token, not a SAC (Circle
  //     USDC's real SAC is CCW67TSZ..., a different contract). It has no trustline and no classic DEX market, and
  //     the bridge's From list is built from CLASSIC assets, so nothing can source it. It is the ONLY asset
  //     registered from Stellar on hedera and xrpl-evm, which is why both stay off despite being trusted chains.
  //   * solvBTC and xSolvBTC are the same shape -- stellar.expert lists each as its own contract token, and the
  //     classic SOLVBTC-GBHZ6UQZ... has no SAC at all, so the two are unrelated.
  //   * DT0 is named "Test token DT0".
  //   * XLM looks available in the registry and is not. See the header.
  //   * monad is in the registry against Stellar, and the contract answers is_trusted_chain('monad') FALSE.
  // The VALUE of these three is not a new chain -- all three were already reachable (Ethereum by CCTP, LayerZero
  // and NEAR Intents; solana and xrpl by NEAR Intents). It is a SECOND route on each, carrying SHX itself rather
  // than a stablecoin, with no route minimum where NEAR Intents will not quote below about 1.51 USDC.
  var AX_CHAIN = { 'Ethereum': 'Ethereum', 'Solana': 'solana', 'XRPL': 'xrpl' };
  // The asset each destination actually carries, with its ITS token id and decimals, and the ENCODING its
  // destination_address takes -- which differs per chain and is not validated by the Stellar contract (header).
  // `src` is the bridge's own source-asset key the card names when no path to the transport asset exists.
  // `dp` is the STELLAR side's decimals (7 for any classic asset); ITS rescales on delivery, so SHX landing on
  // solana as a 6-decimal SPL mint loses only the seventh digit.
  var SHX_ITS = '91e104d86483f05635e0dbb3a9016677e00a7504572ea1890ca478eb8750bcfe';
  var AX_TOKEN = {
    'Ethereum': { sym: 'SHX', src: 'SHX', dp: 7, id: SHX_ITS, enc: 'evm20' },
    'Solana':   { sym: 'SHX', src: 'SHX', dp: 7, id: SHX_ITS, enc: 'b58_32' },
    'XRPL':     { sym: 'SHX', src: 'SHX', dp: 7, id: SHX_ITS, enc: 'ascii' }
  };
  // WHAT THE RECIPIENT MUST ALREADY HAVE, per destination. SHX is a native-ish balance on none of these except
  // Ethereum, and this is the trap that took the route off the site on 2026-09-24:
  //   XRPL    SHX is an IOU from the Axelar gateway rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw (234,658,791 SHX
  //           outstanding, read 2026-11-10). XRPL refuses an IOU to an account with no trustline to its issuer,
  //           so the recipient must sign a TrustSet and lock 0.2 XRP of reserve BEFORE the transfer.
  //   Solana  SHX is a Token-2022 SPL mint. A real executed delivery's instruction list is a bare `mintTo` with
  //           NO create-ATA instruction and no Idempotent log line, so the recipient's token account must exist.
  //   Ethereum  nothing. An ERC-20 transfer needs no setup from the receiver.
  // The old card said "delivered automatically -- no claim, and no gas needed there" for XRPL and nothing checked
  // the recipient, so a send could be aimed at an address that cannot receive it. Now /lxapi/axelar?op=ready
  // answers for a given address and BOTH the route card and the confirm step read it. A failed read is not a
  // verdict: it warns and allows, it never blocks.
  var AX_NEEDS = {
    'XRPL': 'a trustline for SHX to ' + 'rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw' + ' (costs 0.2 XRP of reserve)',
    'Solana': 'an SHX token account (for mint EFchnNkBvh4gSY5zqDgqRfuPR7mStBLvKBxPq5JUJcmP)'
  };
  var AX_SCAN = 'https://axelarscan.io/gmp/';

  window.__lxAxSendable = !!AX_SENDABLE;
  // Published for lxBrRoutes in _lzusdt0.js. Step 1's Next is gated on the chosen network appearing in that table,
  // so a destination missing from it is pickable and then dead with no message -- which is exactly what happened to
  // the NEAR Intents chains before they were published the same way.
  window.__lxAxChains = Object.keys(AX_CHAIN);
  // No stylesheet reads lx-ax-on any more -- it used to reveal this layer's own injected XRPL row, and the layer
  // injects no rows now (see "THIS LAYER ADDS NONE" at the bottom of the file). Kept because it is the one thing
  // on the page that says from the outside whether the route is sendable, which is worth a single class.
  try { if (AX_SENDABLE) document.documentElement.classList.add('lx-ax-on'); } catch (_) {}

  // ---- two picker-wide fixes ------------------------------------------------------------------------------------
  // Neither belongs to Axelar; they live here because this is the LAST route layer to run, so by the time it
  // executes every layer's rows are in the DOM and the destination list is complete.
  //
  // 1. A-Z. The list was design order, then CCTP's rows, then LayerZero's, then NEAR Intents', then this one --
  //    four appended blocks, so it read as four lists stuck together. With 52 destinations that is unusable
  //    (RAZA 2026-09-23: "sort it alphabetically a-z"). Sorted in place by data-net, case-insensitively.
  // 2. The address placeholder must name the CHOSEN network. It is written by the design and there are two
  //    controls that change the destination, so it could be left describing the previous one while the hint below
  //    it already named the new one -- "Enter XRPL address" under "To Zcash". Rather than chase which control
  //    forgot to update it, this keeps it true: it only writes when the text is actually wrong, so it never fights
  //    the design's own animation of that field.
  function axSortPicker() {
    try {
      var rows = [].slice.call(document.querySelectorAll('.brd-opt[data-net]'));
      if (rows.length < 2) return;
      var host = rows[0].parentNode; if (!host) return;
      var sorted = rows.slice().sort(function (a, b) {
        var x = (a.getAttribute('data-net') || '').toLowerCase(), y = (b.getAttribute('data-net') || '').toLowerCase();
        return x < y ? -1 : (x > y ? 1 : 0);
      });
      var same = true;
      for (var i = 0; i < rows.length; i++) if (rows[i] !== sorted[i]) { same = false; break; }
      if (same) return;                       // already in order: touch nothing, so no needless reflow
      var frag = document.createDocumentFragment();
      for (var j = 0; j < sorted.length; j++) frag.appendChild(sorted[j]);
      host.appendChild(frag);
    } catch (_) {}
  }
  function axSyncPlaceholder() {
    try {
      var i = document.querySelector('.br-addr-in'); if (!i) return;
      // READ THE DOM, NOT lxBrDestNet. That function is declared inside the CCTP layer's script, and _externalize.js
      // moves each script into its own file with its own scope -- so window.lxBrDestNet is UNDEFINED in this one.
      // The first version of this called it, got nothing, and returned silently: the placeholder stayed wrong and
      // the "fix" looked applied. The picker's own label is the source of truth and is always in the document.
      var t = document.querySelector('.br-step[data-step="1"] .brd-trigger .nm')
           || document.querySelector('.brd-trigger .nm');
      var n = t ? (t.textContent || '').trim() : '';
      if (!n || /select/i.test(n)) return;          // placeholder state, not a chosen network
      var want = 'Enter ' + n + ' address';
      if (i.getAttribute('placeholder') !== want) i.setAttribute('placeholder', want);
    } catch (_) {}
  }
  function axPickerBoot() { axSortPicker(); axSyncPlaceholder(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', axPickerBoot); else axPickerBoot();
  setTimeout(axPickerBoot, 600);
  setInterval(axSyncPlaceholder, 500);
  // A click can be the one that moves the wizard to step 2, and that transition takes a few hundred milliseconds --
  // so a single check 60ms later runs before the field it is meant to correct has even been laid out, and the
  // interval below only catches it on the next tick. That gap is visible as the old network's name in the box for
  // a moment. Re-check across the whole transition instead.
  document.addEventListener('click', function () {
    [60, 250, 600, 1000].forEach(function (ms) { setTimeout(axSyncPlaceholder, ms); });
  }, true);

  function chainOf(d) { return AX_CHAIN[d] || null; }
  function tokenOf(d) { return AX_TOKEN[d] || null; }

  // ---- destination_address, per chain -----------------------------------------------------------------------------
  // Three encodings, each copied from live mainnet traffic (header). The Stellar contract accepts any bytes, so a
  // mistake here is invisible until the far side drops the delivery -- which is why each branch THROWS rather than
  // falling back to something plausible. A guessed encoding is worse than a refusal.
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58decode(s) {
    var bytes = [0];
    for (var i = 0; i < s.length; i++) {
      var v = B58.indexOf(s.charAt(i));
      if (v < 0) throw new Error('That is not a valid Solana address.');
      for (var j = 0; j < bytes.length; j++) bytes[j] *= 58;
      bytes[0] += v;
      var carry = 0;
      for (var k = 0; k < bytes.length; k++) { bytes[k] += carry; carry = bytes[k] >> 8; bytes[k] &= 0xff; }
      while (carry) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (var z = 0; z < s.length && s.charAt(z) === '1'; z++) bytes.push(0);
    return new Uint8Array(bytes.reverse());
  }
  function destBytesFor(dest, recipient) {
    var t = tokenOf(dest); if (!t) throw new Error('Unsupported destination.');
    var a = String(recipient || '').trim();
    if (t.enc === 'ascii') {
      var u = new Uint8Array(a.length);
      for (var i = 0; i < a.length; i++) u[i] = a.charCodeAt(i);
      return u;
    }
    if (t.enc === 'evm20') {
      var h = a.replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]{40}$/.test(h)) throw new Error('That is not a valid Ethereum address.');
      var e = new Uint8Array(20);
      for (var j = 0; j < 20; j++) e[j] = parseInt(h.substr(j * 2, 2), 16);
      return e;
    }
    if (t.enc === 'b58_32') {
      var b = b58decode(a);
      // A Solana wallet address is exactly 32 bytes. Anything else means we decoded something that is not one,
      // and padding or truncating it would send SHX to an address nobody holds.
      if (b.length !== 32) throw new Error('That is not a valid Solana address.');
      return b;
    }
    throw new Error('Unsupported destination.');
  }

  // ---- can the recipient receive it? ------------------------------------------------------------------------------
  // Answered by /lxapi/axelar?op=ready, which reads the XRPL trustline or the Solana token account (see AX_NEEDS).
  // Cached per destination AND address, because it changes only when the recipient acts -- not with the amount.
  // THREE STATES, and the third is the one that matters: 1 ready, 0 definitely not, null could not check. A failed
  // read must never read as "not ready" or an upstream hiccup blocks a perfectly good send.
  var READY = {};
  function readyOf(dest, recipient) {
    var c = chainOf(dest); if (!c) return Promise.resolve(null);
    if (!AX_NEEDS[dest]) return Promise.resolve(1);              // Ethereum needs nothing of the receiver
    var a = String(recipient || '').trim();
    if (!a || !window.lxBrValidAddr || !window.lxBrValidAddr(dest, a)) return Promise.resolve(null);
    var key = c + '|' + a;
    if (READY[key] !== undefined) return Promise.resolve(READY[key]);
    // Solana's only public RPC rate-limits Cloudflare's shared edge IPs, so ~6% of server-side checks come
    // back "could not check". The VISITOR's own connection is not subject to that limit, and the endpoint
    // hands back the derived account address even when its own read failed — so finish the check here
    // rather than give up. The address comes from our endpoint, but it is still shape-checked before use.
    function askDirect(ata) {
      if (!ata || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ata)) return Promise.resolve(null);
      return fetch('https://solana-rpc.publicnode.com', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [ata, { encoding: 'base64' }] })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.error || !j.result || !('value' in j.result)) return null;
        var v = j.result.value;
        if (v === null) return 0;
        return v.owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ? 1 : 0;
      }).catch(function () { return null; });
    }
    function ask() {
      return fetch('/lxapi/axelar?op=ready&dest=' + encodeURIComponent(c) + '&addr=' + encodeURIComponent(a))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok && (j.ready === 0 || j.ready === 1)) return j.ready;
          return (c === 'solana' && j && j.ata) ? askDirect(j.ata) : null;
        })
        .catch(function () { return null; });
    }
    // NEVER CACHE A FAILURE, AND ASK TWICE. Caching the null turned ONE upstream blip into "could not check"
    // for that address for the rest of the page's life — the card stayed sendable to an address the endpoint
    // had already answered 0 for. Seen live 2026-11-10: endpoint said ready=0, the card still said available.
    // Only a definite 0 or 1 is an answer, so only a definite 0 or 1 is remembered.
    return ask()
      .then(function (v) { return v === null ? ask() : v; })
      .then(function (v) { if (v === 0 || v === 1) READY[key] = v; return v; });
  }
  function notReadyMsg(dest) {
    return 'That ' + dest + ' address cannot receive SHX yet — it needs ' + AX_NEEDS[dest]
      + '. Set that up on ' + dest + ' first, then come back.';
  }
  function feeRate() { return window.__lxFeeRate || ((window.__lxCCTP || {}).feeRate) || 0.002; }
  function srcKey() { return (window.__lxBr || {}).srcKey || 'USDC'; }
  function amtNow() { return (window.__lxBr || {}).amount || 0; }

  // Axelar's own estimate for relaying and executing on the destination, in XLM. Proxied through /lxapi/axelar
  // because api.axelarscan.io does not answer a browser preflight from our origin. Cached per destination for the
  // page's life: it moves with gas prices, not with the amount being sent.
  var GAS = {};
  function gasXlm(dest) {
    var c = chainOf(dest); if (!c) return Promise.resolve(null);
    if (GAS[c] != null) return Promise.resolve(GAS[c]);
    return fetch('/lxapi/axelar?op=gas&dest=' + encodeURIComponent(c)).then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error('no estimate'); GAS[c] = j.xlm; return j.xlm; })
      .catch(function () { return null; });
  }

  // What arrives, and what the recipient must already have for it to arrive. Stated per destination rather than
  // once, because the old single sentence ("no claim, and no gas needed there") was true only on Ethereum and was
  // the reason this route came off the site.
  function claimNoteFor(dest, sym) {
    var need = AX_NEEDS[dest];
    if (!need) return 'Delivered as ' + sym + ' to your address on ' + dest
      + ' automatically — no claim, and no gas needed there.';
    return 'Delivered as ' + sym + ' automatically once it lands — but the receiving ' + dest
      + ' address must already have ' + need + '. We check that before you send.';
  }
  function baseRow(dest) {
    var t = tokenOf(dest);
    return {
      route: 'Axelar', asset: t.sym, assetLogo: '/assets/tokens/shx.png', assetName: 'Stronghold',
      // No `tag` here on purpose: the card falls back to LZ_TAG, which holds the SHORT uppercase badge the other
      // three use ("FASTEST", "MULTI-ASSET"). "Interchain Token Service" sat in that badge as a sentence and was
      // the main reason this card did not look like its neighbours.
      available: true, recv: null, networkFeeXlm: 0,
      etaSeconds: 300, etaText: '~5 minutes, delivered automatically', needsClaim: false,
      claimNote: claimNoteFor(dest, t.sym)
    };
  }

  // Shown immediately so the card never appears late (the no-flash rule): same shape as the priced row, with recv
  // left null until a real figure exists.
  //
  // IT CARRIES THE SOURCE-MATCH VERDICT TOO. A skeleton that always said "available" would render a selectable
  // Axelar card for someone sending USDC, and only turn it unavailable when the priced row landed a second later
  // -- a card that invites a click and then withdraws it, which is the flash rule applied to state rather than
  // to a value. The check is cheap and synchronous, so the first frame is already right.
  window.lxAxSkeleton = function (dest) {
    if (!chainOf(dest) || !tokenOf(dest)) return null;
    return baseRow(dest);
  };
  function axWhy(dest, t) {
    return 'Axelar carries ' + t.sym + ' to ' + dest + '. Choose ' + t.src + ' as the asset you are sending to use this route.';
  }

  // THE SOURCE IS SWAPPED INTO SHX ON STELLAR FIRST, exactly as CCTP swaps into USDC and NEAR Intents swaps into
  // its transport asset. This route originally REFUSED anything but SHX, on the reasoning that turning someone's
  // USDC into SHX is not what "bridge my USDC" means -- but that made the card permanently unavailable for every
  // normal wallet, which is why it looked unlike the other three (RAZA 2026-09-23: "Why is Axelar bridge written
  // differently?"). It was also inconsistent: every other route already converts. The card names what arrives
  // ("Receive SHX", "Stronghold SHX to the XRP Ledger") and the route is only ever chosen deliberately, so the
  // conversion is visible rather than silent.
  var SHX_SPEC = { code: 'SHX', issuer: 'GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH' };
  function srcSpecOf(k) {
    var CC = window.__lxCCTP || {};
    if (k === 'XLM') return { native: true };
    if (k === 'USDC') return { code: 'USDC', issuer: CC.usdcIssuer };
    var A = (window.LX_ASSETS || {})[k];
    var spec = A && A.spec;
    if (spec === 'USDC') return { code: 'USDC', issuer: CC.usdcIssuer };
    if (spec === 'XLM' || spec === 'native') return { native: true };
    return spec || null;
  }
  // How much SHX the amount buys, after LumosCore's rate. SHX in means no swap at all.
  function transportOut(k, amt) {
    var net = amt * (1 - feeRate());
    if (k === 'SHX') return Promise.resolve(net);
    var spec = srcSpecOf(k);
    if (!spec || !window.lxStrictPath) return Promise.reject(new Error('No route from ' + k + ' to SHX on Stellar.'));
    return window.lxStrictPath(window.__lxCCTP || {}, spec, net.toFixed(7), SHX_SPEC).then(function (p) { return +p.out; });
  }

  window.lxAxRow = function (dest, amountHuman, sourceKey, recipient) {
    if (!chainOf(dest) || !tokenOf(dest)) return Promise.resolve(null);
    var t = tokenOf(dest), row = baseRow(dest);
    var sk = sourceKey || srcKey();
    var amt = parseFloat(String(amountHuman || 0).replace(/,/g, '')) || 0;
    return gasXlm(dest).then(function (g) {
      // NO ESTIMATE MEANS NO ROUTE, and the row has to say so rather than keep baseRow's 0. A message sent with no
      // gas prepaid is never relayed, so lxAxConfirm refuses outright when this is null -- and a card reading
      // "Bridge fee 0.1%" with no XLM figure beside it reads as a FREE transfer, which is the opposite of the
      // truth. This only became reachable when the route grew past one destination: with XRPL alone the estimate
      // either worked or the whole card was missing, so a 0 here was never on screen.
      if (g == null) {
        row.available = false;
        row.error = 'Axelar could not price the ' + dest + ' delivery just now, so this route is unavailable. Try again shortly.';
        return row;
      }
      row.networkFeeXlm = g;
      if (!(amt > 0)) return row;
      // ITS is lock/mint, so once the transfer is in SHX what leaves is what arrives. The only question is how much
      // SHX the source buys, and that is the Stellar DEX's answer -- the same pathfinder CCTP and NEAR Intents use.
      return transportOut(sk, amt).then(function (out) {
        row.recv = +out.toFixed(t.dp);
        return row;
      }, function (e) {
        row.available = false;
        row.error = (e && e.message) || axWhy(dest, t);
        return row;
      });
    }).then(function (r) {
      // THE RECIPIENT CHECK ON THE CARD, not only in the confirm step. Learning at the signature prompt that the
      // address cannot receive SHX is learning it one step too late, and the comparison is where the user is
      // choosing between routes. Only a definite 0 withdraws the row -- null (could not check) leaves it alone.
      if (!r || r.available === false || !AX_NEEDS[dest]) return r;
      return readyOf(dest, recipient).then(function (ok) {
        if (ok === 0) { r.available = false; r.error = notReadyMsg(dest); }
        return r;
      }, function () { return r; });
    });
  };

  // Appended to whatever the other routes produced, the same way NEAR Intents is: wrapped rather than woven in, so
  // a failure here can only ever cost this row.
  (function () {
    var base = window.lxBrCompare;
    if (typeof base !== 'function') return;
    window.lxBrCompare = function (dest, amountHuman, recipient, sourceKey) {
      // THE BASE COMPARE MAY REJECT, and for an Axelar-only destination it does: XRPL has no CCTP domain and no
      // LayerZero peer, so the two stablecoin routes have nothing to price and the chain ends in a rejection.
      // Chaining .then onto that never ran, the rejection reached lzDraw as an EMPTY row set, and the result was a
      // card left on screen from an earlier draw with NO stats block under it -- the Receive / Bridge fee /
      // Estimated time rows simply never rendered, because lzPaintStats had no rows to find (RAZA 2026-09-23).
      // Recovering to [] keeps this route's row alive on exactly the destinations that need it most.
      return Promise.resolve()
        .then(function () { return base(dest, amountHuman, recipient, sourceKey); })
        .catch(function () { return []; })
        .then(function (out) {
          out = out || [];
          if (!chainOf(dest)) return out;
          return Promise.resolve(window.lxAxRow(dest, amountHuman, sourceKey, recipient))
            .then(function (r) { return r ? out.concat([r]) : out; })
            .catch(function () { return out; });
        });
    };
  })();

  // ---- the send ------------------------------------------------------------------------------------------------
  // Two transactions, deliberately: Soroban allows ONE operation per transaction, so LumosCore's fee cannot ride
  // along with the contract call the way it does on the classic-payment routes. The fee is taken FIRST and only
  // when it is non-zero -- if the interchain transfer then fails, the user has paid a fee for a transfer that did
  // not happen, so the fee amount is kept small and the failure message says plainly what was and was not sent.
  window.lxAxConfirm = function (btn, say, net, domain, recipient, amt, k, A) {
    var CC = window.__lxCCTP || {}, t = tokenOf(net), chain = chainOf(net);
    if (!window.__lxAxSendable || !t || !chain) { say('Sending by Axelar isn’t switched on yet — choose another route.'); return; }
    // Through the shared hint, so Hedera's two address forms are explained here too -- this route
    // reaches Hedera as well, and it is the route the EVM-address rule was first recorded for.
    if (!window.lxBrValidAddr || !window.lxBrValidAddr(net, recipient)) { say(window.lxBrAddrHint ? window.lxBrAddrHint(net, recipient) : ('That doesn’t look like a valid ' + net + ' address.')); return; }
    var srcAmt = parseFloat(String(amt).replace(/,/g, '')) || 0;
    if (!(srcAmt > 0)) { say('Enter a valid amount on the previous step.'); return; }
    var feeAmt = +(srcAmt * feeRate()).toFixed(7);
    if (!(srcAmt - feeAmt > 0)) { say('That amount is too small to bridge.'); return; }
    // ENCODE THE ADDRESS BEFORE ANYTHING IS SIGNED. destBytesFor throws on an address it cannot encode for this
    // chain, and the Stellar contract would have accepted the wrong bytes without complaint -- so this is the only
    // place the mistake is still cheap. Done here, outside the promise chain, so a bad address costs no signature
    // and no swap.
    var destBytes;
    try { destBytes = destBytesFor(net, recipient); } catch (e) { say((e && e.message) || 'That address cannot be used for this route.'); return; }
    if (!destBytes.length) { say('Enter the address the funds should arrive at.'); return; }

    if (btn) btn.disabled = true;
    say('');
    window.lxBrProgShow('Axelar');
    var up = function (m) { window.lxBrProgUpdate(m); };
    var S, f, pk;

    // THE RECIPIENT GATE, and it runs FIRST -- before the swap, before the fee, before any signature. A send to an
    // address with no trustline (XRPL) or no token account (Solana) is the trap that took this route off the site;
    // reaching it after the swap would mean the user has already paid a fee and converted their asset.
    // A FAILED CHECK IS NOT A REFUSAL. ready===0 stops; ready===null says so and continues, because an upstream
    // that cannot be read is not evidence about the recipient.
    Promise.resolve(AX_NEEDS[net] ? readyOf(net, recipient) : 1).then(function (ok) {
      if (ok === 0) throw new Error(notReadyMsg(net));
      if (ok === null) up('Could not check whether that ' + net + ' address can receive SHX — continuing. It needs ' + AX_NEEDS[net] + '.');
      return window.lxCctpSdk();
    }).then(function (s) { S = s; return window.lxCctpSigner(); }).then(function (fx) {
      f = fx;
      return Promise.resolve(f.requestAccess ? f.requestAccess() : null).then(function () {
        return f.getAddress ? f.getAddress() : (f.getPublicKey ? f.getPublicKey() : null);
      });
    }).then(function (a) {
      pk = (a && a.address) || a;
      if (!pk) throw new Error('Could not read your wallet address.');

      function acc() { return fetch(CC.horizon + '/accounts/' + pk).then(function (r) { return r.json(); }); }
      function signSubmitClassic(tb, label) {
        up('Waiting for signature (' + label + ')…');
        var goSign = function () { return Promise.resolve(f.signTransaction(tb.toXDR(), { networkPassphrase: CC.passphrase, network: 'PUBLIC', address: pk })); };
        return (window.lxCctpGateSign ? window.lxCctpGateSign(label, goSign) : goSign()).then(function (sig) {
          var xdr = (sig && (sig.signedTxXdr || sig.signedXDR)) || sig;
          if ((sig && sig.error) || typeof xdr !== 'string') throw new Error('Cancelled by the user.');
          up('Submitting ' + label + '…');
          return fetch(CC.horizon + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(xdr) })
            .then(function (r) { return r.json(); }).then(function (res) {
              if (res.successful || res.hash) return res;
              var rc = res.extras && res.extras.result_codes;
              throw new Error(label + ' failed: ' + (rc ? JSON.stringify(rc) : 'unknown'));
            });
        });
      }

      // 1. Get the amount into SHX, and take LumosCore's fee, in ONE classic transaction -- the CCTP pattern. A
      //    Soroban op cannot share a transaction with classic ops, so the contract call below has to be a second
      //    signature either way; putting the swap and the fee together at least keeps it to two.
      //    What actually arrived is MEASURED from the balance, never assumed from the quote: a path payment
      //    guarantees only destMin, and sending the contract more than the wallet holds fails at the token.
      function shxBal(ad) {
        var b = (ad.balances || []).filter(function (x) { return x.asset_code === 'SHX' && x.asset_issuer === SHX_SPEC.issuer; })[0];
        return b ? (+b.balance || 0) : 0;
      }
      // A ZERO BALANCE AND A MISSING TRUSTLINE ARE NOT THE SAME THING, and shxBal() cannot tell them
      // apart -- it answers 0 for both. Every non-SHX source below is path-paid INTO SHX and delivered
      // to the sender's OWN account, so a sender with no SHX trustline fails that op with op_no_trust
      // and rolls the swap back with it.
      //
      // RAZA 2026-11-13, bridging LUMOS via Axelar: "Bridge failed" at the fee/swap step with
      // {"transaction":"tx_failed","operations":["op_no_trust"]}. This file carried NO changeTrust at
      // all, while the CCTP path has had the equivalent line for USDC since it shipped -- same trap,
      // fixed on one route and not the other.
      function hasShxTrust(ad) {
        return (ad.balances || []).some(function (x) { return x.asset_code === 'SHX' && x.asset_issuer === SHX_SPEC.issuer; });
      }
      // A new trustline costs one subentry = 0.5 XLM of base reserve, and it is checked BEFORE the
      // signature so a wallet that cannot afford it is told so plainly, rather than walked through a
      // wallet prompt to op_low_reserve. Base reserve is 0.5 XLM: 1 XLM minimum + 0.5 per subentry,
      // with a little left for the network fee.
      function xlmFree(ad) {
        var b = (ad.balances || []).filter(function (x) { return x.asset_type === 'native'; })[0];
        if (!b) return 0;
        return (+b.balance || 0) - (1 + 0.5 * (+ad.subentry_count || 0)) - 0.01;
      }
      // THE FEE IS TAKEN IN XLM, NOT IN THE ASSET BEING BRIDGED.
      //
      // It was a plain payment of the source asset to the fee collector, which requires the COLLECTOR
      // to hold a trustline for whatever the user happened to bridge. Measured 2026-11-13, it holds
      // eight (AQUA, BLND, EURC, LUMOS, SHX, sUSD, USDC, yXLM) -- so bridging PYUSD, USDT0, XRP or
      // anything else outside that set killed the whole transaction with op_no_trust. XLM needs a
      // trustline from nobody, which is precisely why the CCTP path already routes its fee there.
      //
      // A FEE TOO SMALL TO ROUTE IS SKIPPED, NOT FATAL -- same rule and same bookkeeping as CCTP:
      // `spend` below is already srcAmt - feeAmt, so dropping the op leaves the slice in the user's
      // own wallet. Nothing is ever deducted and not collected.
      function feeOpFor(spec, sendAsset, feeAmt) {
        if (!(feeAmt > 0)) return Promise.resolve(null);
        if (spec && spec.native)
          return Promise.resolve(S.Operation.payment({ destination: CC.feeCollector, asset: S.Asset.native(), amount: feeAmt.toFixed(7) }));
        return window.lxStrictPath(CC, spec, feeAmt.toFixed(7), { native: true }).then(function (pf) {
          if (!(pf && +pf.out >= 1e-5)) return null;        // unroutable dust -- see above
          return S.Operation.pathPaymentStrictSend({
            sendAsset: sendAsset, sendAmount: feeAmt.toFixed(7),
            destination: CC.feeCollector, destAsset: S.Asset.native(),
            destMin: (pf.out * 0.97).toFixed(7),
            path: window.lxToAssets ? window.lxToAssets(S, pf.path) : []
          });
        }).catch(function () { return null; });
      }
      var sendP = acc().then(function (ad) {
        var before = shxBal(ad);
        var spend = +(srcAmt - feeAmt).toFixed(7);
        var takeFee = feeAmt > 0 && CC.feeCollector && CC.feeCollector !== pk;
        if (k === 'SHX') {
          if (!takeFee) return spend;
          return feeOpFor(SHX_SPEC, new S.Asset('SHX', SHX_SPEC.issuer), feeAmt).then(function (op) {
            if (!op) return spend;                         // fee could not be routed -- see feeOpFor
            var tbF = new S.TransactionBuilder(new S.Account(pk, ad.sequence), { fee: '100000', networkPassphrase: CC.passphrase })
              .addOperation(op).setTimeout(180).build();
            return signSubmitClassic(tbF, 'fee').then(function () { return spend; });
          });
        }
        up('Pricing the swap into SHX…');
        var needTrust = !hasShxTrust(ad);
        if (needTrust && xlmFree(ad) < 0.5)
          throw new Error('Your account needs an SHX trustline to receive the swap, and that locks 0.5 XLM of reserve. Add a little XLM and try again — nothing has been sent or charged.');
        return window.lxStrictPath(CC, srcSpecOf(k), spend.toFixed(7), SHX_SPEC).then(function (p) {
          var sendAsset = (k === 'XLM') ? S.Asset.native() : new S.Asset(k, axIssuerOf(ad, k));
          return (takeFee ? feeOpFor(srcSpecOf(k), sendAsset, feeAmt) : Promise.resolve(null)).then(function (feeOp) {
            var tb = new S.TransactionBuilder(new S.Account(pk, ad.sequence), { fee: '200000', networkPassphrase: CC.passphrase });
            // The trustline goes FIRST: the path payment on the next line delivers SHX into it inside
            // the same transaction, so the order is what makes one signature enough.
            if (needTrust) tb = tb.addOperation(S.Operation.changeTrust({ asset: new S.Asset('SHX', SHX_SPEC.issuer) }));
            tb = tb.addOperation(S.Operation.pathPaymentStrictSend({
              sendAsset: sendAsset, sendAmount: spend.toFixed(7),
              destination: pk, destAsset: new S.Asset('SHX', SHX_SPEC.issuer),
              destMin: (p.out * 0.97).toFixed(7),
              path: window.lxToAssets ? window.lxToAssets(S, p.path) : []
            }));
            if (feeOp) tb = tb.addOperation(feeOp);
            return signSubmitClassic(tb.setTimeout(180).build(), 'swap+fee').then(function () {
              return acc().then(function (after) {
                var got = +(shxBal(after) - before).toFixed(7);
                if (!(got > 0)) throw new Error('The swap into SHX did not deliver — nothing was sent cross-chain.');
                return got;
              });
            });
          });
        });
      });

      // The issuer of the source asset, read from the sender's own balances rather than a hardcoded map, so a
      // curated asset cannot be paired with the wrong issuer.
      function axIssuerOf(ad, code) {
        var b = (ad.balances || []).filter(function (x) { return x.asset_code === code; })[0];
        if (!b || !b.asset_issuer) throw new Error('You do not hold ' + code + ' on Stellar.');
        return b.asset_issuer;
      }

      var sendAmt = 0;
      return sendP.then(function (got) {
        sendAmt = got;
        up('Pricing the Axelar message…');
        return gasXlm(net);
      }).then(function (g) {
        // No estimate means no gas prepaid, and a message with no gas is never relayed. Refuse rather than send.
        if (g == null) throw new Error('Could not price the Axelar message — nothing was sent cross-chain.');
        var gasStroops = String(Math.ceil(g * 1e7));
        up('Building the interchain transfer…');
        var units = BigInt(Math.round(sendAmt * Math.pow(10, t.dp))).toString();
        // destBytes was encoded at the top of this function, per destination chain -- see destBytesFor.
        var idBytes = new Uint8Array(32);
        for (var j = 0; j < 32; j++) idBytes[j] = parseInt(t.id.substr(j * 2, 2), 16);
        var gasTok = S.nativeToScVal({ address: new S.Address(XLM_SAC), amount: gasStroops },
          { type: { address: ['symbol', 'address'], amount: ['symbol', 'i128'] } });
        var args = [
          new S.Address(pk).toScVal(),
          S.nativeToScVal(idBytes, { type: 'bytes' }),
          S.nativeToScVal(chain, { type: 'string' }),
          S.nativeToScVal(destBytes, { type: 'bytes' }),
          S.nativeToScVal(units, { type: 'i128' }),
          S.nativeToScVal(null),
          gasTok
        ];
        var op = new S.Contract(ITS).call.apply(new S.Contract(ITS), ['interchain_transfer'].concat(args));
        return acc().then(function (ad) {
          var tx = new S.TransactionBuilder(new S.Account(pk, ad.sequence), { fee: '2000000', networkPassphrase: CC.passphrase })
            .addOperation(op).setTimeout(300).build();
          var server = new S.rpc.Server(CC.rpc || 'https://mainnet.sorobanrpc.com');
          up('Checking the transfer…');
          return server.simulateTransaction(tx).then(function (sim) {
            if (sim.error) throw new Error(axSimErr(sim.error, t));
            var prepared = S.rpc.assembleTransaction(tx, sim).build();
            up('Waiting for signature (transfer)…');
            var goSign = function () { return Promise.resolve(f.signTransaction(prepared.toXDR(), { networkPassphrase: CC.passphrase, network: 'PUBLIC', address: pk })); };
            return (window.lxCctpGateSign ? window.lxCctpGateSign('transfer', goSign) : goSign()).then(function (sig) {
              var xdr = (sig && (sig.signedTxXdr || sig.signedXDR)) || sig;
              if ((sig && sig.error) || typeof xdr !== 'string') throw new Error('Cancelled by the user.');
              up('Submitting the transfer…');
              return server.sendTransaction(S.TransactionBuilder.fromXDR(xdr, CC.passphrase)).then(function (res) {
                if (res.status === 'ERROR') throw new Error('The network rejected the transfer.');
                var hash = res.hash;
                function poll(n) {
                  return server.getTransaction(hash).then(function (g2) {
                    if (g2.status === 'SUCCESS') return hash;
                    if (g2.status === 'FAILED') throw new Error('The transfer failed on Stellar (' + hash + ').');
                    if (n > 40) throw new Error('The transfer timed out waiting for Stellar (' + hash + ').');
                    return new Promise(function (rr) { setTimeout(rr, 2000); }).then(function () { return poll(n + 1); });
                  });
                }
                up('Waiting for Stellar to confirm…');
                return poll(0);
              });
            });
          });
        });
      });
    }).then(function (hash) {
      if (btn) btn.disabled = false;
      window.lxBrProgDone
        ? window.lxBrProgDone('Sent. Axelar is relaying it to ' + net + ' — it usually lands within five minutes. Track it at ' + AX_SCAN + hash)
        : up('Sent — Axelar is relaying it to ' + net + '.');
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      var m = (e && e.message) || 'Transfer failed.';
      window.lxBrProgFail ? window.lxBrProgFail(m) : say(m);
    });

    // A contract error is a number; say what it means rather than printing the number. #13 from the TOKEN contract
    // is the one a user will actually hit: they do not hold the asset, or have no trustline for it.
    function axSimErr(err, tok) {
      var s = String(err), m = s.match(/Error\(Contract, #(\d+)\)/);
      if (!m) return 'Could not build the transfer: ' + s.split('\n')[0].slice(0, 120);
      var n = +m[1];
      if (n === 13) return 'Your wallet does not hold ' + tok.sym + ' (or has no trustline for it), so there is nothing to bridge. Nothing was sent.';
      // #10 IS A SHORTFALL, and it is as often the GAS as the amount. Measured 2026-11-10 on an account with
      // 68.85 SHX and 6.59 XLM: 'xrpl' passed at 1 unit, failed at 10,000 SHX (not enough SHX), and 'Ethereum'
      // failed at EVERY amount including 1 unit -- purely because its gas estimate was 26.58 XLM. Naming only the
      // amount sends the user to adjust the one number that is not the problem.
      if (n === 10) return 'Not enough balance to cover this transfer. It needs ' + tok.sym
        + ' for the amount and about ' + (GAS[chain] != null ? (Math.ceil(GAS[chain] * 100) / 100) : '?')
        + ' XLM for the ' + net + ' gas, on top of the Stellar fee. Nothing was sent.';
      if (n === 17) return tok.sym + ' is not registered with Axelar for this route.';
      if (n === 7) return net + ' is not a trusted destination on Axelar right now.';
      return 'The transfer was refused by the contract (error ' + n + '). Nothing was sent.';
    }
  };
}

// ---- the destination rows: THIS LAYER ADDS NONE ------------------------------------------------------------------
// It used to inject an XRPL row (and a gate stylesheet to hide it while the route was off), because XRPL was in no
// other route's list. All three of this route's destinations now already have a row in the picker -- Ethereum from
// the design, Solana and XRPL from _nearintents.js's NI_ONLY set -- so injecting anything here would produce a
// DUPLICATE row for the same data-net, which the A-Z sort would then place next to its twin.
//
// THE TWO STRIPS STAY. The page containers are gitignored and still hold whatever an older run injected, so the
// only way those stale buttons and that stale stylesheet leave is for this pass to keep removing them. A strip
// with no matching inject is not dead code here; it is the cleanup half of an idempotent transform.
const AX_ONLY = [];

const JS = '(' + runtime.toString() + ')(' + (LZ_LIVE ? 'true' : 'false') + ');';
try { new Function(JS); } catch (e) { console.error('  ! Axelar runtime does not parse: ' + e.message); process.exit(1); }
const SCRIPT = '<script id="lx-axelar">' + JS + '<' + '/script>';

let n = 0, seen = 0, dd = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  for (const k of Object.keys(json)) {
    if (!/bridge/.test(k)) continue;
    let h = json[k];
    const before = h;
    h = h.replace(new RegExp('<style id="lx-axpick-css">[' + B + 's' + B + 'S]*?<' + B + '/style>', 'g'), '');
    h = h.replace(new RegExp('<button class="brd-opt lx-axopt"[' + B + 's' + B + 'S]*?<' + B + '/button>', 'g'), '');
    // RE-ENABLED 2026-11-10 (RAZA: "i just want you to add axelar for all the networks that we can do ... if that
    // particular network also has Near intents, its okay to also add axelar on it"). Between 2026-09-24 and now
    // this pass was a strip only, and the layer was off two ways at once -- AX_CHAIN was {} AND the script was
    // never injected, so even filling AX_CHAIN in would have shipped nothing. Both halves are back on; the strips
    // above stay because they are what makes the inject idempotent.
    // IN PLACE, not strip-and-append. Re-adding the block before </body> lands this layer LAST, so
    // running this transform on its own silently reorders the bridge page's layers -- the trap that
    // costs an hour every time it is sprung. Swapping the block where it already sits cannot do that,
    // and only a container that has never had the layer falls through to the append below.
    //
    // (The two strips above stay strips: they are cleanup with no matching inject, which is the other
    // half of being idempotent. See [[a-transform-that-patches-in-place-cannot-reorder]].)
    const AXO = '<script id="lx-axelar">', AXC = '<' + '/script>';
    const at = h.indexOf(AXO);
    if (at >= 0) {
      const end = h.indexOf(AXC, at);
      if (end > at) {
        h = h.slice(0, at) + SCRIPT + h.slice(end + AXC.length);
        seen++;
        if (h !== before) { json[k] = h; n++; }
        continue;
      }
    }
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) { if (h !== before) { json[k] = h; n++; } continue; }
    h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    seen++;
    if (h !== before) { json[k] = h; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('Axelar ITS route: ' + seen + ' bridge page key(s), ' + n + ' changed, ' + dd + ' dropdown(s) got the ' + AX_ONLY.length + ' rows'
  + ' | destinations: Ethereum, Solana, XRPL' + (LZ_LIVE ? ' (sendable)' : ' (shown, not sendable)'));
if (!seen) { console.error('  ! no bridge page matched'); process.exit(1); }
