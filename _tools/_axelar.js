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
//   * destination_address is the ASCII BYTES OF THE ADDRESS STRING -- the r-address for XRPL, the 0x string for EVM.
//     Raw 20 bytes is refused.
//   * the chain string is CASE-SENSITIVE. 'xrpl' and 'xrpl-evm' are trusted; 'ethereum' is refused while 'Ethereum'
//     passes. Do not "tidy" these into title case.
// Reading errors from this contract: ITS raises #13 only for an EMPTY destination_address. A #13 with a non-empty
// one comes from the TOKEN contract underneath, where #13 is TrustlineMissing -- i.e. the caller does not hold the
// asset. A deliberately bogus token_id returns #17 from ITS itself, which is the probe that proves execution got
// past the address check.
//
// WHAT IT CARRIES, and the honest limit. ITS moves a REGISTERED token, not whatever the user is holding:
//   * SHX -> XRPL works for real. Its Stellar contract is the Stellar Asset Contract for classic SHX (its name() is
//     "SHX:GDSTRSHX...", the CODE:ISSUER form), so SAC balances ARE classic balances and any SHX holder can send.
//   * USDC.axl -> XRPL / XRPL EVM is listed but is NOT Circle USDC. Its contract's name() is plain "USD Coin" -- a
//     pure Soroban ITS token, not a SAC. Circle USDC's real SAC is CCW67TSZ..., a different contract. Someone
//     holding the USDC this bridge already moves does NOT hold USDC.axl and cannot get it through a trustline or
//     the classic DEX, only by bridging it in. So that row is real but thinly useful, which RAZA chose knowingly.
// Because of that, this route requires the SOURCE asset to be the asset it carries. It does not swap into it: a
// swap would quietly convert someone's USDC into SHX to satisfy the route, which is not what "bridge my USDC" means.
// When the source does not match, the row is shown UNAVAILABLE with the reason rather than hidden, so the choice is
// visible and explained.
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
  // XRPL ONLY, and XRPL EVM deliberately absent. Both chains are trusted by the ITS contract and both were
  // verified, but the only asset registered for XRPL EVM is USDC.axl -- and USDC.axl cannot be the SOURCE of a
  // transfer here, because the bridge's From list is built from CLASSIC Stellar assets (code + issuer) and
  // USDC.axl is a pure Soroban token with no trustline. The row would therefore have shown a route nobody could
  // ever satisfy. SHX is registered on XRPL and IS classic (its Stellar contract is the SAC), which is the whole
  // reason that one works. XRPL EVM returns the day a holdable asset is registered on it.
  var AX_CHAIN = { 'XRPL': 'xrpl' };
  // The asset each destination actually carries, with its ITS token id and decimals. `src` is the bridge's own
  // source-asset key that a user must be sending for this route to apply.
  var AX_TOKEN = {
    'XRPL': { sym: 'SHX', src: 'SHX', dp: 7, id: '91e104d86483f05635e0dbb3a9016677e00a7504572ea1890ca478eb8750bcfe' }
  };
  var AX_SCAN = 'https://axelarscan.io/gmp/';

  window.__lxAxSendable = !!AX_SENDABLE;
  // Published for lxBrRoutes in _lzusdt0.js. Step 1's Next is gated on the chosen network appearing in that table,
  // so a destination missing from it is pickable and then dead with no message -- which is exactly what happened to
  // the NEAR Intents chains before they were published the same way.
  window.__lxAxChains = Object.keys(AX_CHAIN);
  try { if (AX_SENDABLE) document.documentElement.classList.add('lx-ax-on'); } catch (_) {}

  function chainOf(d) { return AX_CHAIN[d] || null; }
  function tokenOf(d) { return AX_TOKEN[d] || null; }
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

  function baseRow(dest) {
    var t = tokenOf(dest);
    return {
      route: 'Axelar', asset: t.sym, assetLogo: '/assets/tokens/shx.png', assetName: t.sym === 'SHX' ? 'Stronghold' : 'USD Coin',
      available: true, recv: null, tag: 'Interchain Token Service', networkFeeXlm: 0,
      etaSeconds: 300, etaText: '~5 minutes, delivered automatically', needsClaim: false,
      claimNote: 'Delivered as ' + t.sym + ' to your address on ' + dest + ' automatically — no claim, and no gas needed there.'
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
    var t = tokenOf(dest);
    if (!chainOf(dest) || !t) return null;
    var row = baseRow(dest);
    if (srcKey() !== t.src) { row.available = false; row.error = axWhy(dest, t); }
    return row;
  };
  function axWhy(dest, t) {
    return 'Axelar carries ' + t.sym + ' to ' + dest + '. Choose ' + t.src + ' as the asset you are sending to use this route.';
  }

  window.lxAxRow = function (dest, amountHuman, sourceKey, recipient) {
    if (!chainOf(dest) || !tokenOf(dest)) return Promise.resolve(null);
    var t = tokenOf(dest), row = baseRow(dest);
    var sk = sourceKey || srcKey();
    // THE ROUTE IS ONLY HONEST WHEN THE SOURCE MATCHES. Saying "unavailable, and here is why" beats hiding the row:
    // someone looking for a way to reach XRPL should see that one exists and what it needs.
    if (sk !== t.src) { row.available = false; row.error = axWhy(dest, t); return Promise.resolve(row); }
    var amt = parseFloat(String(amountHuman || 0).replace(/,/g, '')) || 0;
    return gasXlm(dest).then(function (g) {
      if (g != null) { row.networkFeeXlm = g; row.etaText = '~5 minutes, delivered automatically'; }
      // ITS is lock/mint: what leaves is what arrives, less only LumosCore's own rate. There is no swap and no
      // slippage on this route, so the figure is exact rather than quoted.
      if (amt > 0) row.recv = +(amt * (1 - feeRate())).toFixed(t.dp);
      return row;
    });
  };

  // Appended to whatever the other routes produced, the same way NEAR Intents is: wrapped rather than woven in, so
  // a failure here can only ever cost this row.
  (function () {
    var base = window.lxBrCompare;
    if (typeof base !== 'function') return;
    window.lxBrCompare = function (dest, amountHuman, recipient, sourceKey) {
      return Promise.resolve(base(dest, amountHuman, recipient, sourceKey)).then(function (out) {
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
    if (k !== t.src) { say('Axelar carries ' + t.sym + ' to ' + net + '. Choose ' + t.src + ' as the asset you are sending.'); return; }
    if (!window.lxBrValidAddr || !window.lxBrValidAddr(net, recipient)) { say('That doesn’t look like a valid ' + net + ' address.'); return; }
    var srcAmt = parseFloat(String(amt).replace(/,/g, '')) || 0;
    if (!(srcAmt > 0)) { say('Enter a valid amount on the previous step.'); return; }
    var feeAmt = +(srcAmt * feeRate()).toFixed(7);
    var netAmt = +(srcAmt - feeAmt).toFixed(t.dp);
    if (!(netAmt > 0)) { say('That amount is too small to bridge.'); return; }

    if (btn) btn.disabled = true;
    say('');
    window.lxBrProgShow('Axelar');
    var up = function (m) { window.lxBrProgUpdate(m); };
    var S, f, pk;

    window.lxCctpSdk().then(function (s) { S = s; return window.lxCctpSigner(); }).then(function (fx) {
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
          if ((sig && sig.error) || typeof xdr !== 'string') throw new Error('Signing cancelled.');
          up('Submitting ' + label + '…');
          return fetch(CC.horizon + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(xdr) })
            .then(function (r) { return r.json(); }).then(function (res) {
              if (res.successful || res.hash) return res;
              var rc = res.extras && res.extras.result_codes;
              throw new Error(label + ' failed: ' + (rc ? JSON.stringify(rc) : 'unknown'));
            });
        });
      }

      // 1. LumosCore's fee, in the asset being sent, as its own classic payment.
      var feeP = (feeAmt > 0 && CC.feeCollector && CC.feeCollector !== pk)
        ? acc().then(function (ad) {
            var asset = (t.src === 'XLM') ? S.Asset.native() : new S.Asset(t.src, axIssuerOf(ad, t.src));
            var tb = new S.TransactionBuilder(new S.Account(pk, ad.sequence), { fee: '100000', networkPassphrase: CC.passphrase })
              .addOperation(S.Operation.payment({ destination: CC.feeCollector, asset: asset, amount: feeAmt.toFixed(7) }))
              .setTimeout(180).build();
            return signSubmitClassic(tb, 'fee');
          })
        : Promise.resolve(null);

      // The issuer of the source asset, read from the sender's own balances rather than a hardcoded map, so a
      // curated asset cannot be paired with the wrong issuer.
      function axIssuerOf(ad, code) {
        var b = (ad.balances || []).filter(function (x) { return x.asset_code === code; })[0];
        if (!b || !b.asset_issuer) throw new Error('You do not hold ' + code + ' on Stellar.');
        return b.asset_issuer;
      }

      return feeP.then(function () {
        up('Pricing the Axelar message…');
        return gasXlm(net);
      }).then(function (g) {
        // No estimate means no gas prepaid, and a message with no gas is never relayed. Refuse rather than send.
        if (g == null) throw new Error('Could not price the Axelar message — nothing was sent cross-chain.');
        var gasStroops = String(Math.ceil(g * 1e7));
        up('Building the interchain transfer…');
        var units = BigInt(Math.round(netAmt * Math.pow(10, t.dp))).toString();
        var destBytes = new Uint8Array(recipient.length);
        for (var i = 0; i < recipient.length; i++) destBytes[i] = recipient.charCodeAt(i);
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
              if ((sig && sig.error) || typeof xdr !== 'string') throw new Error('Signing cancelled.');
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
      if (n === 10) return 'That amount is not valid for this transfer.';
      if (n === 17) return tok.sym + ' is not registered with Axelar for this route.';
      if (n === 7) return net + ' is not a trusted destination on Axelar right now.';
      return 'The transfer was refused by the contract (error ' + n + '). Nothing was sent.';
    }
  };
}

// ---- the destination rows ---------------------------------------------------------------------------------------
// Neither chain is in the design's dropdown, so both are built here, on the same anchor and the same /g strip
// contract the CCTP, LayerZero and NEAR Intents rows use. Gated behind lx-ax-on so the route and its destinations
// switch on together -- a row whose only route is locked is the dead-route problem moved one step earlier.
const AX_ONLY = [['XRPL', 'XRP', '#23292f']];
const AX_OPTS = AX_ONLY.map(function (n) {
  return '<button class="brd-opt lx-axopt" type="button" data-net="' + n[0] + '">'
    + '<span class="brd-ic lx-netlm" style="background:' + n[2] + '">' + n[1] + '</span>'
    + '<span class="brd-nm">' + n[0] + '</span></button>';
}).join('');
const AX_CSS = '<style id="lx-axpick-css">'
  + '.brd-opt.lx-axopt{display:none !important}'
  + 'html.lx-ax-on .brd-opt.lx-axopt{display:flex !important}'
  + '<' + '/style>';

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
    h = h.replace(new RegExp('<script id="lx-axelar">[' + B + 's' + B + 'S]*?<' + B + '/script>', 'g'), '');
    h = h.replace(new RegExp('<style id="lx-axpick-css">[' + B + 's' + B + 'S]*?<' + B + '/style>', 'g'), '');
    h = h.replace(new RegExp('<button class="brd-opt lx-axopt"[' + B + 's' + B + 'S]*?<' + B + '/button>', 'g'), '');
    if (h.indexOf('</head>') >= 0) h = h.replace('</head>', AX_CSS + '</head>');
    { const anchor = '<span class="brd-nm">World Chain</span></button>';
      const ai = h.indexOf(anchor);
      if (ai >= 0) { h = h.slice(0, ai + anchor.length) + AX_OPTS + h.slice(ai + anchor.length); dd++; } }
    // AFTER the NEAR Intents script: this one wraps whatever lxBrCompare is by then, so it must run last of the
    // route layers or its wrapper would be the one replaced.
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) { json[k] = h; continue; }
    h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    seen++;
    if (h !== before) { json[k] = h; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('Axelar ITS route: ' + seen + ' bridge page key(s), ' + n + ' changed, ' + dd + ' dropdown(s) got the ' + AX_ONLY.length + ' rows' + (LZ_LIVE ? ' (sendable)' : ' (shown, not sendable)'));
if (!seen) { console.error('  ! no bridge page matched'); process.exit(1); }
