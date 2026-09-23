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
  // Our network names -> 1Click chain keys. Every entry here must also have a validator in LX_ADDR (or be EVM and
  // in LX_EVM_NETS) in _cctp.js, and every one was proved with a LIVE dry quote using a correct address for that
  // chain before being listed. Not listed, and why: XRP (1Click 500s on it in both directions), Abstract and Aleo
  // (both refuse a correctly-formed recipient), HyperCore (would sit beside Hyperliquid as a near-identical row,
  // and sending to the wrong layer strands the funds).
  var NI_CHAIN = { Ethereum: 'eth', Arbitrum: 'arb', Base: 'base', Polygon: 'pol', Optimism: 'op', Avalanche: 'avax', Berachain: 'bera', Monad: 'monad', Plasma: 'plasma',
    'BNB Chain': 'bsc', Gnosis: 'gnosis', Scroll: 'scroll', Hood: 'hood', ADI: 'adi',
    // The sixteen non-EVM chains, added 2026-09-23 once lxBrValidAddr learned their address families. Each one
    // was proved with a LIVE dry quote using a correct address for that chain before it was listed here.
    // APTOS IS DELIBERATELY ABSENT. The design's base chain is Aptos, and the multichain re-skin observer rewrites
    // the text "Aptos" to the connected network's name wherever it appears (LUMOSCORE_DEV.md landmine 4). The row
    // therefore renamed ITSELF to "Stellar" the moment it was selected -- measured 2026-09-23, with Cardano beside
    // it behaving correctly. Escaping it would mean carving an exception out of the engine that renames Aptos
    // across the entire site, which is load-bearing for the multichain design. One destination is not worth that.
    Bitcoin: 'btc', Solana: 'sol', Tron: 'tron', TON: 'ton', Near: 'near', Sui: 'sui',
    Starknet: 'starknet', Cardano: 'cardano', Litecoin: 'ltc', Dogecoin: 'doge', 'Bitcoin Cash': 'bch',
    Zcash: 'zec', Dash: 'dash', Movement: 'movement', Fogo: 'fogo' };
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
    plasma: ['XPL', 'USDT0'],
    // Native first, then majors -- same rule as above, and the same deliberate exclusion of 1Click's micro-caps
    // (bsc alone lists SWEAT, RHEA, EVAA and nrUsdt; gnosis lists GBPe). ADI's chain serves exactly one asset.
    //
    // GNOSIS AND HOOD DELIBERATELY BREAK THE NATIVE-FIRST RULE, because on those two the native coin is the
    // THINNEST asset and the first entry is what the picker defaults to. Measured through our own proxy on
    // 2026-09-23: gnosis xDAI and hood ETH both quote at $100 and return "No liquidity available" at $2,000,
    // while gnosis USDC/USDT/WETH and hood USDG quote fine at both. Leading with the native coin would have made
    // the default choice the one that fails first, on chains most people reach for a stablecoin anyway.
    // hood USDe is absent, not reordered: it returned no liquidity at ANY size tested.
    bsc: ['BNB', 'USDC', 'USDT', 'NEAR', 'ASTER'],
    gnosis: ['USDC', 'USDT', 'WETH', 'xDAI', 'GNO', 'SAFE', 'COW'],
    scroll: ['ETH', 'USDT'],
    hood: ['USDG', 'ETH', 'WETH'],
    adi: ['ADI'],
    // The sixteen non-EVM chains. The LEADING asset is the one that actually quotes, not the one the naming
    // convention would pick: movement leads USDCx because MOVE returned no liquidity at $300 while USDCx priced
    // fine, and ton leads GRAM for the same reason. Same trap as gnosis and hood above -- the first entry is the
    // picker's default, so a thin native coin there makes the default the choice that fails first.
    btc: ['BTC'], sol: ['SOL', 'USDC', 'USDT'], tron: ['TRX', 'USDT'], ton: ['GRAM', 'USDT'],
    near: ['wNEAR', 'USDC'], sui: ['SUI', 'USDC'], starknet: ['STRK'],
    cardano: ['ADA'], ltc: ['LTC'], doge: ['DOGE'], bch: ['BCH'], zec: ['ZEC'], dash: ['DASH'],
    movement: ['USDCx', 'MOVE'], fogo: ['FOGO']
  };
  var NI_NAME = { ETH: 'Ether', WETH: 'Wrapped Ether', USDC: 'USD Coin', USDT: 'Tether USD', USDT0: 'Tether USD0', WBTC: 'Wrapped Bitcoin',
    cbBTC: 'Coinbase Wrapped BTC', DAI: 'Dai', LINK: 'Chainlink', UNI: 'Uniswap', AAVE: 'Aave', ARB: 'Arbitrum', GMX: 'GMX', OP: 'Optimism',
    POL: 'Polygon', AVAX: 'Avalanche', BERA: 'Berachain', MON: 'Monad', XPL: 'Plasma',
    BNB: 'BNB', NEAR: 'NEAR', ASTER: 'Aster', xDAI: 'xDAI', GNO: 'Gnosis', SAFE: 'Safe', COW: 'CoW Protocol',
    USDG: 'Global Dollar', USDe: 'Ethena USDe', ADI: 'ADI',
    BTC: 'Bitcoin', SOL: 'Solana', TRX: 'TRON', GRAM: 'Gram', wNEAR: 'Wrapped NEAR', SUI: 'Sui', APT: 'Aptos',
    STRK: 'Starknet', ADA: 'Cardano', LTC: 'Litecoin', DOGE: 'Dogecoin', BCH: 'Bitcoin Cash', ZEC: 'Zcash',
    DASH: 'Dash', MOVE: 'Movement', USDCx: 'USD Coin', FOGO: 'Fogo' };
  var STABLE = { USDC: 1, USDT: 1, USDT0: 1, DAI: 1, xDAI: 1, USDG: 1, USDe: 1, EURe: 1 };
  var PLACEHOLDER_EVM = '0x1111111111111111111111111111111111111111';   // DRY quotes only (1Click refuses 0x..dEaD); a real send uses the user's validated address

  window.__lxNiSendable = !!NI_SENDABLE;
  // THE DESTINATION LIST THIS ROUTE ADDS, published for lxBrRoutes in _lzusdt0.js. That function used to union
  // CCTP's domains with LayerZero's eids and nothing else, and step 1's Next is gated on the chosen network
  // appearing in it -- so a NEAR-Intents-only destination could be picked from the dropdown and the wizard would
  // simply refuse to advance, with no message. Every chain this route reaches has to be visible there.
  window.__lxNiChains = Object.keys(NI_CHAIN);
  // The NEAR-Intents-only destination rows are hidden until this class exists, exactly as the LayerZero-only rows
  // wait on lx-lz-on. Those five chains have NO other transport, so without the gate a build with the flag off
  // would show rows whose only route is locked -- the selectable-dead-route problem, moved one step earlier in
  // the wizard. One switch turns the route and its destinations on together.
  try { if (NI_SENDABLE) document.documentElement.classList.add('lx-ni-on'); } catch (_) {}
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
  // HOW MANY TOKENS THIS CHAIN ACTUALLY OFFERS, published for _bridgepolish.js so it can decide whether the
  // destination asset is a CONTROL or just a label. Dogecoin, Litecoin, Cardano, Zcash, Dash, XRP, ADI and Fogo
  // each have exactly one asset on 1Click, and they were still given a caret and a search box that could only ever
  // offer the token already shown (RAZA 2026-09-23). Falls back to the curated majors before the live list loads,
  // so the answer is never briefly wrong in the direction of showing a useless control.
  window.__lxNiAssetCount = function (dest) {
    var c = chainOf(dest); if (!c) return 0;
    try { return TOK ? fullList(c).length : (NI_DEST[c] || []).length; } catch (_) { return (NI_DEST[c] || []).length; }
  };
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

  // ---- history read back from the chain -----------------------------------------------------------------------
  // RAZA 2026-09-19: two NEAR Intents transfers made, one listed. Recent transactions lived only in the browser that
  // sent them, written after the deposit's signature came back -- so a transfer made on the phone never reached the
  // desktop, and one whose tab was suspended while a mobile wallet app signed never got written at all, although it
  // landed and delivered. Every deposit goes to ONE 1Click account and is told apart by its memo, so the connected
  // wallet's payments to that account ARE its NEAR Intents history; 1Click's status for each memo says what was
  // delivered, where and to whom. Missing ones are added to the store and the list is repainted. Read-only.
  var NI_DEP = 'GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK';
  var NI_NET = {}; Object.keys(NI_CHAIN).forEach(function (n) { NI_NET[NI_CHAIN[n]] = n; });   // 'arb' -> 'Arbitrum'
  var syncing = false;
  window.lxNiSync = function () {
    var pk = ''; try { pk = localStorage.getItem('lumos.address') || ''; } catch (_) {}
    if (syncing || !/^G[A-Z2-7]{55}$/.test(pk)) return Promise.resolve(0);
    syncing = true;
    var have = {}; try { JSON.parse(localStorage.getItem('lumos.cctp.txs') || '[]').forEach(function (o) { if (o && o.hash) have[o.hash] = 1; }); } catch (_) {}
    return fetch('https://horizon.stellar.org/accounts/' + pk + '/payments?order=desc&limit=100&join=transactions')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var deps = ((d && d._embedded && d._embedded.records) || []).filter(function (p) {
          var tx = p.transaction || {};
          return p.type === 'payment' && p.to === NI_DEP && p.from === pk && tx.successful !== false && !have[p.transaction_hash]
            && tx.memo_type === 'id' && /^[0-9]{1,20}$/.test(String(tx.memo || ''));
        }).slice(0, 12);
        if (!deps.length) return 0;
        return tokens().then(function () {
          return Promise.all(deps.map(function (p) {
            return status(NI_DEP, String(p.transaction.memo)).then(function (s) {
              var q = (s && s.quoteResponse) || {}, qr = q.quoteRequest || {}, sd = (s && s.swapDetails) || {};
              var tk = (TOK || []).filter(function (t) { return t.assetId === qr.destinationAsset; })[0];
              if (!tk || !NI_NET[tk.blockchain]) return null;
              var code = (p.asset_type === 'native' || !p.asset_code) ? 'XLM' : p.asset_code;
              var out = s.status === 'SUCCESS' ? +(sd.amountOutFormatted || 0) : +((q.quote || {}).amountOutFormatted || 0);
              return { src: pk, recipient: qr.recipient || '', srcAmount: String(+p.amount), srcKey: code, amount: out,
                net: NI_NET[tk.blockchain], hash: p.transaction_hash, ts: Date.parse(p.created_at) || Date.now(),
                bridge: 'NEAR Intents', asset: tk.symbol, fromChain: 1 };
            }).catch(function () { return null; });
          }));
        }).then(function (recs) {
          recs = recs.filter(Boolean); if (!recs.length) return 0;
          try {
            var a = JSON.parse(localStorage.getItem('lumos.cctp.txs') || '[]');
            var seen = {}; a.forEach(function (o) { if (o && o.hash) seen[o.hash] = 1; });
            a = a.concat(recs.filter(function (o) { return !seen[o.hash]; }));
            a.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });
            localStorage.setItem('lumos.cctp.txs', JSON.stringify(a.slice(0, 100)));
          } catch (_) { return 0; }
          try { if (window.lxBrRepaintTxs) window.lxBrRepaintTxs(); } catch (_) {}
          try { if (window.lxBrRenderMobileTxs) window.lxBrRenderMobileTxs(); } catch (_) {}
          return recs.length;
        });
      })
      .catch(function () { return 0; })
      .then(function (n) { syncing = false; return n; });
  };
  // once the page has painted its own history; again when a wallet connects or switches (lumos.address changes)
  setTimeout(function () { window.lxNiSync(); }, 1500);
  window.addEventListener('storage', function (e) { if (e && e.key === 'lumos.address') window.lxNiSync(); });

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
              return signSubmit(tb.addMemo(S.Memo.text('lx:ni')).setTimeout(300).build(), 'swap').then(function (res) {
                swapped = true;
                // from the swap's own result first: a balance read straight after it can be stale (2026-09-22, LayerZero)
                if (window.lxSwapGot) return window.lxSwapGot(S, res, pk, function () { return acc().then(function (a) { return bal(a, 'USDC', CC.usdcIssuer); }); }, bal(before, 'USDC', CC.usdcIssuer));
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
              return signSubmit(tb.setTimeout(300).build(), 'deposit').then(function (res) {
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

// The logos actually shipped in assets/tokens/ni (see _nilogos.js), read at BUILD time and baked into the page, so a
// token gets its logo the moment its file exists -- no second list to keep in step by hand.
const NI_FILES = (() => { const o = {}; try { fs.readdirSync(require('path').join(__dirname, '..', 'assets', 'tokens', 'ni')).forEach((f) => { const m = f.match(/^([A-Za-z0-9._-]+).png$/); if (m) o[m[1]] = 1; }); } catch (e) {} return o; })();
function withNiFiles(src) { const out = src.replace(/var NI_LOCAL = {[^}]*};/, 'var NI_LOCAL = ' + JSON.stringify(NI_FILES) + ';'); if (out === src) throw new Error('NI_LOCAL not found'); return out; }
// THE TWO LISTS MUST AGREE, AND THIS IS THE CHECK THAT MAKES THEM.
// functions/lxapi/oneclick.js holds a CHAINS whitelist; a chain in NI_CHAIN but missing there is dropped from the
// token list at the edge, and the failure is SILENT in the worst way -- the row appears, the picker reads "0 ASSETS",
// the destination asset falls back to USDC, and the quote fails as 'unsupported destination asset'. That shipped
// once (the fifteen non-EVM chains, 2026-09-23) because the only thing keeping the lists together was a comment.
// Now the build refuses instead.
(() => {
  const src = fs.readFileSync(__dirname + '/../functions/lxapi/oneclick.js', 'utf8');
  const m = src.match(/const CHAINS = \{([\s\S]*?)\};/);
  if (!m) { console.error('  ! could not read CHAINS from functions/lxapi/oneclick.js'); process.exit(1); }
  const allowed = new Set((m[1].match(/([A-Za-z0-9_]+)\s*:\s*1/g) || []).map((s) => s.split(':')[0].trim()));
  const want = (runtime.toString().match(/var NI_CHAIN = \{([\s\S]*?)\};/) || [, ''])[1];
  const keys = (want.match(/:\s*'([a-z0-9-]+)'/g) || []).map((s) => s.replace(/^:\s*'|'$/g, ''));
  const missing = keys.filter((k) => !allowed.has(k));
  if (missing.length) {
    console.error('  ! NI_CHAIN lists chains the edge proxy will drop: ' + missing.join(', '));
    console.error('    add them to CHAINS in functions/lxapi/oneclick.js, or the picker shows "0 ASSETS" and every quote fails.');
    process.exit(1);
  }
})();

const JS = '(' + withNiFiles(runtime.toString()) + ')(' + (LZ_LIVE ? 'true' : 'false') + ');';
try { new Function(JS); } catch (e) { console.error('  ! NEAR Intents runtime does not parse: ' + e.message); process.exit(1); }
const SCRIPT = '<script id="lx-nearintents">' + JS + '<' + '/script>';

// THE FIVE DESTINATIONS ONLY NEAR INTENTS CAN REACH. Two of them -- BNB Chain and Scroll -- already ship in the
// design's dropdown and are hidden by the CCTP layer's HIDE list; they are un-hidden here rather than re-added, so
// the design keeps owning its own row (the same call the LayerZero layer makes for Sei, Hedera and Mantle). The
// other three are not in the design at all and are built below.
//
// All five are gated behind html.lx-ni-on, which the runtime sets only when NI_SENDABLE. The prefix is needed on
// the un-hide rules to outrank the CCTP layer's own .brd-opt[data-net="…"]{display:none!important}.
const NI_UNHIDE = ['BNB Chain', 'Scroll', 'Solana', 'Sui', 'Starknet', 'Near'];
const NI_ONLY = [['Gnosis', 'GNO', '#133629'], ['Hood', 'HOOD', '#00c805'], ['ADI', 'ADI', '#1b1b1f'],
  ['Bitcoin', 'BTC', '#f7931a'], ['Tron', 'TRX', '#eb0029'], ['TON', 'TON', '#0098ea'],
  ['Cardano', 'ADA', '#0133ad'], ['Litecoin', 'LTC', '#a6a9aa'],
  ['Dogecoin', 'DOGE', '#c2a633'], ['Bitcoin Cash', 'BCH', '#0ac18e'], ['Zcash', 'ZEC', '#f4b728'],
  ['Dash', 'DASH', '#008ce7'], ['Movement', 'MOVE', '#1a1a1a'], ['Fogo', 'FOGO', '#1a1a1a']];
const NI_OPTS = NI_ONLY.map(function (n) {
  return '<button class="brd-opt lx-niopt" type="button" data-net="' + n[0] + '">'
    + '<span class="brd-ic lx-netlm" style="background:' + n[2] + '">' + n[1] + '</span>'
    + '<span class="brd-nm">' + n[0] + '</span></button>';
}).join('');
const NI_CSS = '<style id="lx-nipick-css">'
  // Inverted for the same reason as the LayerZero rules: a positive 'display:flex !important' outranked the
  // design's own network search, which hides a row with an inline display:none.
  + 'html:not(.lx-ni-on) .brd-opt.lx-niopt{display:none !important}'
  + NI_UNHIDE.map(function (n) { return 'html:not(.lx-ni-on) .brd-opt[data-net="' + n + '"]{display:none !important}'; }).join('')
  + '<' + '/style>';

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
    h = h.replace(new RegExp('<script id="lx-nearintents">[' + B + 's' + B + 'S]*?<' + B + '/script>', 'g'), '');   // idempotent
    // Same contract as the CCTP and LayerZero rows: strip with /g, then re-add on World Chain's closing tag, so
    // editing NI_ONLY can never leave a stale row behind. Each layer's strip matches only its own class.
    h = h.replace(new RegExp('<style id="lx-nipick-css">[' + B + 's' + B + 'S]*?<' + B + '/style>', 'g'), '');
    h = h.replace(new RegExp('<button class="brd-opt lx-niopt"[' + B + 's' + B + 'S]*?<' + B + '/button>', 'g'), '');
    if (h.indexOf('</head>') >= 0) h = h.replace('</head>', NI_CSS + '</head>');
    { const anchor = '<span class="brd-nm">World Chain</span></button>';
      const ai = h.indexOf(anchor);
      if (ai >= 0) { h = h.slice(0, ai + anchor.length) + NI_OPTS + h.slice(ai + anchor.length); dd++; } }
    const bi = h.lastIndexOf('</body>');
    if (bi < 0) { json[k] = h; continue; }
    h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    seen++;
    if (h !== before) { json[k] = h; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('NEAR Intents route: ' + seen + ' bridge page key(s), ' + n + ' changed, ' + dd + ' dropdown(s) got the ' + NI_ONLY.length + ' NI-only rows' + (LZ_LIVE ? ' (sendable)' : ' (shown, not sendable)'));
if (!seen) { console.error('  ! no bridge page matched'); process.exit(1); }
