// Cross-chain, third route: NEAR Intents (1Click). Delivers the TOKEN THE USER PICKS on the destination -- native gas
// (ETH, POL, AVAX...) or a major token -- in ~30 seconds, with no claim and no gas needed on arrival.
//
// RAZA 2026-09-19: "allow me to select more assets for destination than just USDC or USDT ... native asset is must. I
// don't wanna see not enough eth error, if we can send eth itself." CCTP moves only USDC and LayerZero only USDT0, so
// neither can. 1Click takes XLM or USDC from Stellar (its only Stellar assets) and a solver network delivers the
// destination token. Measured live the same day: 100 XLM -> ETH on Arbitrum ~24s at 0.53% all-in (keyless).
//
// THE FLOW, and where each guarantee comes from:
//   1. price    a dry 1Click quote through /lxapi/oneclick (which holds the API key, if one is set) -- after
//               LumosCore's fee and after any Stellar swap, so "You will receive" is what arrives
//   2. swap     a source that is neither XLM nor USDC is swapped into USDC on Stellar first (path payment to self),
//               LumosCore's fee paid in the SAME transaction -- the CCTP pattern
//   3. quote    a LIVE quote for exactly what the wallet now holds -> a deposit address + memo
//   4. deposit  one Stellar payment to that address with that memo (plus LumosCore's fee, for XLM/USDC sources)
//   5. submit   the tx hash to 1Click (speeds pickup), then poll status until SUCCESS / REFUNDED / FAILED
//   If anything fails after the deposit, 1Click refunds to the SAME Stellar wallet (refundTo = the signer).
//
// Nothing is auto-selected: this route delivers a DIFFERENT token, so it is only ever the user's choice.
// Gated like LayerZero: sendable only in an LZ_LIVE build (staging) until a real transfer has round-tripped.
//
// THE BROWSER CODE IS A REAL FUNCTION (serialised with toString), so `node --check` on this file checks what ships.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const { LZ_LIVE } = require(__dirname + '/_lzflag.js');
const B = String.fromCharCode(92);

function runtime(NI_SENDABLE) {
  // Our network names -> 1Click chain keys. The 9 of our 16 destinations 1Click serves.
  var NI_CHAIN = { Ethereum: 'eth', Arbitrum: 'arb', Base: 'base', Polygon: 'pol', Optimism: 'op', Avalanche: 'avax', Berachain: 'bera', Monad: 'monad', Plasma: 'plasma' };
  // The offer per chain: NATIVE FIRST, then majors. Fixed on purpose -- 1Click's own lists include micro-caps.
  var NI_DEST = {
    eth: ['ETH', 'USDC', 'USDT', 'WBTC', 'cbBTC', 'DAI', 'LINK', 'UNI', 'AAVE', 'WETH'],
    arb: ['ETH', 'USDC', 'USDT0', 'ARB', 'WETH', 'GMX'],
    base: ['ETH', 'USDC', 'cbBTC', 'WETH'],
    op: ['ETH', 'USDC', 'USDT', 'OP', 'WETH'],
    pol: ['POL', 'USDC', 'USDT', 'WETH'],
    avax: ['AVAX', 'USDC', 'USDT'],
    bera: ['BERA', 'USDT0'],
    monad: ['MON', 'USDC', 'USDT0'],
    plasma: ['XPL', 'USDT0']
  };
  var NI_NAME = { ETH: 'Ether', WETH: 'Wrapped Ether', USDC: 'USD Coin', USDT: 'Tether USD', USDT0: 'Tether USD0', WBTC: 'Wrapped Bitcoin',
    cbBTC: 'Coinbase Wrapped BTC', DAI: 'Dai', LINK: 'Chainlink', UNI: 'Uniswap', AAVE: 'Aave', ARB: 'Arbitrum', GMX: 'GMX', OP: 'Optimism',
    POL: 'Polygon', AVAX: 'Avalanche', BERA: 'Berachain', MON: 'Monad', XPL: 'Plasma' };
  var STABLE = { USDC: 1, USDT: 1, USDT0: 1, DAI: 1 };
  var PLACEHOLDER_EVM = '0x1111111111111111111111111111111111111111';   // DRY quotes only (1Click refuses 0x..dEaD); a real send uses the user's validated address

  window.__lxNiSendable = !!NI_SENDABLE;
  window.__lxNiAsset = window.__lxNiAsset || {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function feeRate() { return window.__lxFeeRate || ((window.__lxCCTP || {}).feeRate) || 0.002; }
  function srcKey() { return (window.__lxBr || {}).srcKey || 'USDC'; }
  function transportOf(sk) { return sk === 'XLM' ? 'XLM' : 'USDC'; }   // XLM goes as XLM; everything else as USDC
  // Logos: the 20 shipped with the site (assets/tokens/ni, _nilogos.js); any other token on 1Click's list through our
  // logo lookup, keyed on the coingeckoId 1Click gives it; nothing known -> a letter disc (see the menu's onerror).
  var NI_LOCAL = { NEAR: 1, ETH: 1, WETH: 1, USDC: 1, USDT: 1, USDT0: 1, WBTC: 1, cbBTC: 1, DAI: 1, LINK: 1, UNI: 1, AAVE: 1, ARB: 1, GMX: 1, OP: 1, POL: 1, AVAX: 1, BERA: 1, MON: 1, XPL: 1 };
  function logo(sym, chain) {
    if (NI_LOCAL[sym]) return '/assets/tokens/ni/' + sym + '.png';
    var t = chain ? tok(chain, sym) : null;
    return (t && t.coingeckoId) ? ('/lxapi/oneclick?op=logo&id=' + encodeURIComponent(t.coingeckoId)) : '';
  }
  function chainOf(dest) { return NI_CHAIN[dest] || null; }
  // ANY token 1Click delivers on the chain may be picked (RAZA 2026-09-19: "show the full list of possibilities"); the
  // default is the native coin. Before the list has loaded, a stored pick is trusted and checked by the quote itself.
  function pick(dest) {
    var c = chainOf(dest); if (!c) return null; var s = window.__lxNiAsset[dest];
    if (s && (NI_DEST[c].indexOf(s) >= 0 || !TOK || tok(c, s))) return s;
    return NI_DEST[c][0];
  }
  // the chain's full deliverable list, in the order the menu shows it: our majors first (native leading), then the rest A-Z
  function fullList(c) {
    var all = (TOK || []).filter(function (t) { return t.blockchain === c; });
    var pri = NI_DEST[c].filter(function (s) { return all.some(function (t) { return t.symbol === s; }); });
    var rest = all.map(function (t) { return t.symbol; }).filter(function (s, i, a) { return pri.indexOf(s) < 0 && a.indexOf(s) === i; })
      .sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
    return pri.concat(rest);
  }

  // ---- the token list (origin + destination ids), from our proxy, once per page ----------------------------------
  var TOK = null, TOKP = null, KEYED = false;
  function tokens() {
    if (TOK) return Promise.resolve(TOK);
    if (TOKP) return TOKP;
    TOKP = fetch('/lxapi/oneclick?op=tokens').then(function (r) { return r.json(); }).then(function (j) {
      TOK = (j && j.tokens) || []; KEYED = !!(j && j.keyed); return TOK;
    }).catch(function (e) { TOKP = null; throw e; });
    return TOKP;
  }
  function tok(chain, sym) { return (TOK || []).filter(function (t) { return t.blockchain === chain && t.symbol === sym; })[0] || null; }

  // 1Click's cut, as its fee schedule states it: 25 bps keyless; with a key 20 bps, or 1 bp stablecoin -> stablecoin
  function niFeeBps(transport, sym) { if (!KEYED) return 25; return (transport === 'USDC' && STABLE[sym]) ? 1 : 20; }

  // The route card's tag: HOW MANY tokens this chain can receive, counted from 1Click's live list (RAZA 2026-09-19:
  // 'Any token' overstated it -- 'be more accurate'). Before the list has loaded, the count of our majors.
  function tagFor(dest) {
    var c = chainOf(dest); if (!c) return '';
    var n = TOK ? fullList(c).length : NI_DEST[c].length;
    return n + (TOK ? '' : '+') + (n === 1 ? ' asset' : ' assets');
  }
  function baseRow(dest, sym) {
    var chainName = dest;
    return { route: 'NEAR Intents', asset: sym, assetLogo: logo(sym, chainOf(dest)), assetName: NI_NAME[sym] || sym, available: true, recv: null,
      tag: tagFor(dest), networkFeeXlm: 0, niFeeBps: niFeeBps(transportOf(srcKey()), sym), etaSeconds: 30, etaText: '~30 seconds', needsClaim: false,
      claimNote: 'Delivered as ' + sym + ' to your address automatically — no claim, and no gas needed on ' + chainName + '.' };
  }

  // What reaches the deposit, in the transport asset: after LumosCore's fee, and after the Stellar swap for others.
  function transportOut(sk, amt) {
    var net = amt * (1 - feeRate());
    if (sk === 'XLM' || sk === 'USDC') return Promise.resolve(net);
    var A = (window.LX_ASSETS || {})[sk], spec = A && A.spec, CC = window.__lxCCTP || {};
    if (spec === 'USDC') return Promise.resolve(net);
    if (!spec || !window.lxStrictPath) return Promise.reject(new Error('No route from ' + sk + ' to USDC on Stellar.'));
    return window.lxStrictPath(CC, spec, net.toFixed(7), { code: 'USDC', issuer: CC.usdcIssuer }).then(function (p) { return +p.out; });
  }

  function niQuote(dest, sym, transport, transportAmt, recipient, refundTo, dry) {
    return tokens().then(function () {
      var o = tok('stellar', transport), d = tok(chainOf(dest), sym);
      if (!o || !d) throw new Error(sym + ' on ' + dest + ' is not available from NEAR Intents right now.');
      var units = String(Math.floor(transportAmt * Math.pow(10, o.decimals)));
      return fetch('/lxapi/oneclick?op=quote', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dry: !!dry, originAsset: o.assetId, destinationAsset: d.assetId, amount: units,
          refundTo: refundTo, recipient: recipient, slippageTolerance: 100 }) })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (x) {
          if (x.status >= 300 || !x.body || !x.body.quote) {
            var m = String((x.body && (x.body.message || x.body.error)) || 'Quote unavailable');
            var min = /minimum swap amount is \$?([0-9,.]+)/i.exec(m);
            throw new Error(min ? ('NEAR Intents needs at least $' + min[1] + ' for ' + sym + ' on ' + dest + ' right now.') : m);
          }
          if (typeof x.body.keyed === 'boolean') KEYED = x.body.keyed;
          return x.body.quote;
        });
    });
  }

  // ---- the row for the route panel (called by lxBrCompare in _lzusdt0.js) -------------------------------------------
  var LAST = {};
  function lastKey(dest, sym, sk, amt) { return dest + '|' + sym + '|' + sk + '|' + amt; }
  function amtNow() { var el = document.querySelector('.br-step[data-step="2"] .br-io > .br-side:first-child .br-amt input'); return parseFloat(String(el ? el.value : '').replace(/,/g, '')) || 0; }
  window.lxNiSkeleton = function (dest) {
    var sym = pick(dest); if (!sym) return null;
    var r = baseRow(dest, sym), k = lastKey(dest, sym, srcKey(), amtNow());
    if (LAST[k] != null) r.recv = LAST[k];
    return r;
  };
  window.lxNiRow = function (dest, amountHuman, sourceKey, recipient) {
    var sym = pick(dest); if (!sym) return Promise.resolve(null);
    var sk = sourceKey || srcKey(), amt = parseFloat(String(amountHuman || 0).replace(/,/g, '')) || 0;
    var row = baseRow(dest, sym);
    if (!(amt > 0)) return tokens().then(function () { row.niFeeBps = niFeeBps(transportOf(sk), sym); row.tag = tagFor(dest); return row; }, function () { return row; });
    var to = /^0x[0-9a-fA-F]{40}$/.test(recipient || '') ? recipient : PLACEHOLDER_EVM;
    // A DRY quote still names a refund account, and 1Click checks it holds the origin asset: the USDT0 issuer (the old
    // fallback) has no USDC trustline, so every USDC-source quote failed before a key was loaded. The fee collector
    // holds both XLM and USDC. A real send always refunds to the signer (lxNiConfirm).
    var refund = (window.__lxBr || {}).pk || (window.__lxCCTP || {}).feeCollector || '';
    return transportOut(sk, amt).then(function (tAmt) {
      return niQuote(dest, sym, transportOf(sk), tAmt, to, refund, true);
    }).then(function (q) {
      row.recv = +q.amountOutFormatted;
      row.recvUsd = +q.amountOutUsd || null;
      row.etaSeconds = q.timeEstimate || 30;
      row.etaText = '~' + (q.timeEstimate || 30) + ' seconds';
      row.niFeeBps = niFeeBps(transportOf(sk), sym);
      row.tag = tagFor(dest);
      LAST[lastKey(dest, sym, sk, amt)] = row.recv;
      return row;
    }).catch(function (e) {
      row.available = false;
      var m = String((e && e.message) || e || '');
      row.error = /Failed to fetch|NetworkError|Load failed/i.test(m) ? 'Couldn’t reach NEAR Intents — try again in a moment.' : m;
      return row;
    });
  };

  // ---- the destination token picker ----------------------------------------------------------------------------
  function destNow() { var t = document.querySelector('.br-step[data-step="1"] .brd-trigger .nm'); return t ? (t.textContent || '').trim() : ''; }
  function closeMenu() { var m = document.querySelector('.lx-ni-menu'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  // THE FULL LIST, with a search box on top (RAZA 2026-09-19: "show the full list of possibilities" / "add search on top
  // of the dropdown"). Every token 1Click delivers on the chain, majors first; each row names the token and, where there
  // is no known name, its contract -- a ticker is not an identity. A logo that will not load becomes a letter disc.
  function short(a) { return a ? (a.slice(0, 6) + '…' + a.slice(-4)) : ''; }
  function row(c, s, cur) {
    var t = tok(c, s), lg = logo(s, c), sub = NI_NAME[s] || (t && t.contractAddress ? short(t.contractAddress) : (t && !t.contractAddress ? 'Native' : ''));
    return '<button type="button" data-sym="' + esc(s) + '" data-q="' + esc((s + ' ' + (NI_NAME[s] || '') + ' ' + ((t && t.contractAddress) || '')).toLowerCase()) + '" aria-selected="' + (s === cur ? 'true' : 'false') + '">'
      + (lg ? '<img src="' + esc(lg) + '" alt="" data-l="' + esc(s.slice(0, 1).toUpperCase()) + '">' : '<span class="lx-ni-l" data-l="' + esc(s.slice(0, 1).toUpperCase()) + '"></span>')
      + '<span><span>' + esc(s) + '</span><br><span class="n">' + esc(sub) + '</span></span></button>';
  }
  function openMenu(anchor) {
    closeMenu();
    var dest = destNow(), c = chainOf(dest); if (!c) return;
    var m = document.createElement('div'); m.className = 'lx-ni-menu';
    m.innerHTML = '<div class="lx-ni-search"><input type="text" placeholder="Search token or contract" spellcheck="false" autocomplete="off" aria-label="Search tokens"></div>'
      + '<div class="lx-ni-list"><div class="lx-ni-empty">Loading tokens…</div></div>';
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.left + window.scrollX)) + 'px';
    m.style.top = (r.bottom + window.scrollY + 6) + 'px';
    var list = m.querySelector('.lx-ni-list'), q = m.querySelector('input');
    tokens().then(function () {
      var cur = pick(dest), syms = fullList(c);
      list.innerHTML = syms.map(function (s) { return row(c, s, cur); }).join('') + '<div class="lx-ni-empty" hidden>No token matches</div>';
      // a failed logo becomes the letter disc
      [].slice.call(list.querySelectorAll('img[data-l]')).forEach(function (im) {
        im.addEventListener('error', function () { var sp = document.createElement('span'); sp.className = 'lx-ni-l'; sp.setAttribute('data-l', im.getAttribute('data-l') || '?'); if (im.parentNode) im.parentNode.replaceChild(sp, im); });
      });
    }, function () { list.innerHTML = '<div class="lx-ni-empty">Couldn’t load NEAR Intents’ token list — try again.</div>'; });
    q.addEventListener('input', function () {
      var v = (q.value || '').trim().toLowerCase(), shown = 0;
      [].slice.call(list.querySelectorAll('button[data-sym]')).forEach(function (b) { var ok = !v || (b.getAttribute('data-q') || '').indexOf(v) >= 0; b.style.display = ok ? '' : 'none'; if (ok) shown++; });
      var em = list.querySelector('.lx-ni-empty'); if (em) em.hidden = shown > 0;
    });
    setTimeout(function () { try { q.focus(); } catch (_) {} }, 30);
    m.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('button[data-sym]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var s = b.getAttribute('data-sym'); window.__lxNiAsset[dest] = s; closeMenu();
      // show the new face at once (dash for the figure until the quote lands), then re-quote
      var de = document.documentElement;
      de.setAttribute('data-lxroute-asset', s); de.setAttribute('data-lxroute-logo', logo(s, c) || ''); de.setAttribute('data-lxroute-name', NI_NAME[s] || s);
      de.setAttribute('data-lxroute-recv', '');
      try { if (window.lxBrRouteRender) window.lxBrRouteRender(); } catch (_) {}
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var face = t.closest('.br-step[data-step="2"] .br-io > .br-side:last-child .br-asset.lx-s2pick');
    if (face) { e.preventDefault(); e.stopPropagation(); if (document.querySelector('.lx-ni-menu')) closeMenu(); else openMenu(face); return; }
    if (!t.closest('.lx-ni-menu')) closeMenu();
  }, true);

  // ---- sending ---------------------------------------------------------------------------------------------------
  function status(depositAddress, memo) {
    return fetch('/lxapi/oneclick?op=status&depositAddress=' + encodeURIComponent(depositAddress) + (memo ? '&depositMemo=' + encodeURIComponent(memo) : ''))
      .then(function (r) { return r.json(); });
  }
  window.lxNiConfirm = function (btn, say, net, domain, recipient, amt, k, A) {
    var CC = window.__lxCCTP || {}, dest = net, sym = pick(dest), chain = chainOf(dest);
    if (!window.__lxNiSendable) { say('Sending by NEAR Intents isn’t switched on yet — choose another route.'); return; }
    if (!chain || !sym) { say('NEAR Intents does not deliver to ' + dest + '.'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient || '')) { say('That doesn’t look like a valid ' + dest + ' address.'); return; }
    var srcAmt = parseFloat(String(amt).replace(/,/g, '')) || 0; if (!(srcAmt > 0)) { say('Enter a valid amount on the previous step.'); return; }
    var rate = feeRate(), feeAmt = +(srcAmt * rate).toFixed(7), transport = transportOf(k);
    var spec = (A && A.spec === 'USDC') ? { code: 'USDC', issuer: CC.usdcIssuer } : (A && A.spec);
    if (btn) btn.disabled = true;
    say('Checking the destination address and your XLM…', true);
    // The EXCHANGE check only. The other half of lxBrDestCheck refuses a destination holding under $0.50 of gas -- a
    // "probably a mistyped address" heuristic that, here, blocks the very thing this route is for: sending ETH to a
    // wallet that has none (RAZA: "I don't wanna see not enough eth error, if we can send eth itself").
    var addrP = (domain != null && window.lxBrDestExchange) ? window.lxBrDestExchange(domain, recipient) : Promise.resolve({ ok: true });
    addrP.then(function (chk) { if (!chk.ok) throw { user: chk.msg }; return go(); })
      .catch(function (e) { if (btn) btn.disabled = false; if (e && e.user) say(e.user); else { window.lxBrProgFail(((e && e.message) || 'Transfer failed.') + (e && e.__lxSwapped ? ' — your swap completed, so the USDC is in your Stellar wallet. Nothing was sent cross-chain.' : '')); } });

    function go() {
      if (btn) btn.disabled = false; say('');
      window.lxBrProgShow('NEAR Intents');
      var up = function (m) { window.lxBrProgUpdate(m); };
      var S, f, pk, swapped = false;
      return window.lxCctpSdk().then(function (s) { S = s; return window.lxCctpSigner(); }).then(function (fx) {
        f = fx; return Promise.resolve(f.requestAccess ? f.requestAccess() : null).then(function () { return f.getAddress ? f.getAddress() : (f.getPublicKey ? f.getPublicKey() : null); });
      }).then(function (a) {
        pk = (a && a.address) || a; if (!pk) throw new Error('Could not read your wallet address.');
        function acc() { return fetch(CC.horizon + '/accounts/' + pk).then(function (r) { return r.json(); }); }
        function signSubmit(tb, label) {
          up('Waiting for signature (' + label + ')…');
          var goSign = function () { return Promise.resolve(f.signTransaction(tb.toXDR(), { networkPassphrase: CC.passphrase, network: 'PUBLIC', address: pk })); };
          return (window.lxCctpGateSign ? window.lxCctpGateSign(label, goSign) : goSign()).then(function (sig) {
            var xdr = (sig && (sig.signedTxXdr || sig.signedXDR)) || sig;
            if ((sig && sig.error) || typeof xdr !== 'string') throw new Error('Signing cancelled.');
            up('Submitting ' + label + '…');
            return fetch(CC.horizon + '/transactions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'tx=' + encodeURIComponent(xdr) })
              .then(function (r) { return r.json(); }).then(function (res) {
                if (res.successful || res.hash) return res;
                var rc = res.extras && res.extras.result_codes; throw new Error(label + ' failed: ' + (rc ? JSON.stringify(rc) : 'unknown'));
              });
          });
        }
        function bal(ad, code, iss) { var b = (ad.balances || []).filter(function (x) { return code === 'XLM' ? x.asset_type === 'native' : (x.asset_code === code && x.asset_issuer === iss); })[0];
          return b ? Math.max(0, (+b.balance || 0) - (+b.selling_liabilities || 0)) : 0; }

        // 2. a source that is neither XLM nor USDC: swap into USDC first, our fee in the same transaction
        var netP;
        if (k === 'XLM' || k === 'USDC') netP = Promise.resolve(+(srcAmt - feeAmt).toFixed(7));
        else netP = acc().then(function (before) {
          var swapAmt = +(srcAmt - feeAmt).toFixed(7);
          up('Finding a ' + k + '→USDC route…');
          return window.lxStrictPath(CC, spec, swapAmt.toFixed(7), { code: 'USDC', issuer: CC.usdcIssuer }).then(function (pSwap) {
            var feePathP = (spec.native || CC.feeCollector === pk) ? Promise.resolve(null) : window.lxStrictPath(CC, spec, feeAmt.toFixed(7), { native: true });
            return feePathP.then(function (pFee) {
              var src = window.lxAssetOf(S, spec), U = new S.Asset('USDC', CC.usdcIssuer);
              var tb = new S.TransactionBuilder(new S.Account(pk, before.sequence), { fee: '3000', networkPassphrase: CC.passphrase });
              var hasU = (before.balances || []).some(function (x) { return x.asset_code === 'USDC' && x.asset_issuer === CC.usdcIssuer; });
              if (!hasU) tb.addOperation(S.Operation.changeTrust({ asset: U }));
              tb.addOperation(S.Operation.pathPaymentStrictSend({ sendAsset: src, sendAmount: swapAmt.toFixed(7), destination: pk, destAsset: U,
                destMin: (pSwap.out * 0.97).toFixed(7), path: window.lxToAssets(S, pSwap.path) }));
              if (CC.feeCollector !== pk && feeAmt > 0) tb.addOperation(spec.native
                ? S.Operation.payment({ destination: CC.feeCollector, asset: S.Asset.native(), amount: feeAmt.toFixed(7) })
                : S.Operation.pathPaymentStrictSend({ sendAsset: src, sendAmount: feeAmt.toFixed(7), destination: CC.feeCollector, destAsset: S.Asset.native(),
                    destMin: (pFee.out * 0.97).toFixed(7), path: window.lxToAssets(S, pFee.path) }));
              up('Swapping ' + k + '→USDC…');
              return signSubmit(tb.addMemo(S.Memo.text('lx:ni')).setTimeout(180).build(), 'swap').then(function () {
                swapped = true;
                return acc().then(function (after) { var got = +(bal(after, 'USDC', CC.usdcIssuer) - bal(before, 'USDC', CC.usdcIssuer)).toFixed(7);
                  if (!(got > 0)) throw new Error('The swap did not deliver any USDC.'); return got; });
              });
            });
          });
        });

        return netP.then(function (net) {
          // 3. a LIVE quote for exactly what will be deposited -> deposit address + memo
          up('Getting a live quote for ' + sym + '…');
          return niQuote(dest, sym, transport, net, recipient, pk, false).then(function (q) {
            if (!q.depositAddress) throw new Error('NEAR Intents did not return a deposit address.');
            // 4. the deposit: one payment with the memo (+ our fee, for XLM/USDC sources -- other sources paid it in the swap)
            return acc().then(function (ad) {
              var A2 = transport === 'XLM' ? S.Asset.native() : new S.Asset('USDC', CC.usdcIssuer);
              var tb = new S.TransactionBuilder(new S.Account(pk, ad.sequence), { fee: '2000', networkPassphrase: CC.passphrase });
              if ((k === 'XLM' || k === 'USDC') && CC.feeCollector !== pk && feeAmt > 0)
                tb.addOperation(S.Operation.payment({ destination: CC.feeCollector, asset: A2, amount: feeAmt.toFixed(7) }));
              tb.addOperation(S.Operation.payment({ destination: q.depositAddress, asset: A2, amount: net.toFixed(7) }));
              var memo = String(q.depositMemo || '');
              tb.addMemo(/^[0-9]{1,19}$/.test(memo) ? S.Memo.id(memo) : S.Memo.text(memo.slice(0, 28)));
              return signSubmit(tb.setTimeout(180).build(), 'deposit').then(function (res) {
                var hash = res.hash || res.id;
                // 5. tell 1Click (speeds pickup; the deposit is found either way), record, then track to completion
                fetch('/lxapi/oneclick?op=submit', { method: 'POST', headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ txHash: hash, depositAddress: q.depositAddress, memo: memo }) }).catch(function () {});
                var rec = { src: pk, recipient: recipient, srcAmount: srcAmt, srcKey: k, amount: +q.amountOutFormatted, net: dest, hash: hash,
                  ts: Date.now(), bridge: 'NEAR Intents', asset: sym };
                try { window.lxBrAddRecentTx(rec); window.lxBrSaveTx(rec); } catch (_) {}
                return track(q.depositAddress, memo, q, hash);
              });
            });
          });
        }).catch(function (e) { if (swapped && e && typeof e === 'object') e.__lxSwapped = true; throw e; });
      }).then(function (done) {
        window.lxBrProgDone({ route: 'NEAR Intents', asset: sym, amountOut: done.amountOut, dest: dest, destUrl: done.destUrl });
        try { window.lxBrRefreshBalances(); } catch (_) {}
      }).catch(function (e) {
        try { window.lxBrRefreshBalances(); } catch (_) {}
        throw e;
      });

      // poll 1Click every 4s for up to 15 minutes; the deposit is refundable to this wallet if it cannot complete
      function track(addr, memo, q, hash) {
        var t0 = Date.now();
        return new Promise(function (res, rej) {
          (function poll() {
            status(addr, memo).then(function (s) {
              var st = (s && s.status) || '', d = (s && s.swapDetails) || {};
              if (st === 'SUCCESS') {
                var tx = (d.destinationChainTxHashes || [])[0] || {};
                return res({ amountOut: d.amountOutFormatted || q.amountOutFormatted, destUrl: tx.explorerUrl || '' });
              }
              if (st === 'REFUNDED') return rej(new Error('NEAR Intents could not complete this swap and refunded it to your Stellar wallet' + (d.refundedAmountFormatted ? (' (' + d.refundedAmountFormatted + ' ' + transport + ')') : '') + '.'));
              if (st === 'FAILED' || st === 'INCOMPLETE_DEPOSIT') return rej(new Error('NEAR Intents reported the swap as ' + st.replace(/_/g, ' ').toLowerCase() + '. Your deposit ' + hash.slice(0, 10) + '… is refundable to your Stellar wallet.'));
              up(st === 'PROCESSING' ? ('Swapping into ' + sym + ' and delivering on ' + dest + '…') : 'Deposit sent — waiting for NEAR Intents to pick it up…');
              if (Date.now() - t0 > 15 * 60 * 1000) return rej(new Error('Still in progress after 15 minutes. Your deposit ' + hash.slice(0, 10) + '… is safe; check it again shortly.'));
              setTimeout(poll, 4000);
            }).catch(function () { setTimeout(poll, 6000); });
          })();
        });
      }
    }
  };
}

const JS = '(' + runtime.toString() + ')(' + (LZ_LIVE ? 'true' : 'false') + ');';
try { new Function(JS); } catch (e) { console.error('  ! NEAR Intents runtime does not parse: ' + e.message); process.exit(1); }
const SCRIPT = '<script id="lx-nearintents">' + JS + '<' + '/script>';

let n = 0, seen = 0;
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  for (const k of Object.keys(json)) {
    if (!/bridge/.test(k)) continue;
    let h = json[k];
    const before = h;
    h = h.replace(new RegExp('<script id="lx-nearintents">[' + B + 's' + B + 'S]*?<' + B + '/script>', 'g'), '');   // idempotent
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) { json[k] = h; continue; }
    h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    seen++;
    if (h !== before) { json[k] = h; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('NEAR Intents route: ' + seen + ' bridge page key(s), ' + n + ' changed' + (LZ_LIVE ? ' (sendable)' : ' (shown, not sendable)'));
if (!seen) { console.error('  ! no bridge page matched'); process.exit(1); }
