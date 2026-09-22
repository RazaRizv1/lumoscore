// LayerZero / USDT0 cross-chain route: config + LIVE QUOTING. Read-only -- there is no write path in this file.
//
// RAZA 2026-09-17: "lets also use Layer Zero". LayerZero cannot carry Circle USDC (USDC's omnichain mechanism IS
// CCTP, and a LayerZero route would mean an OFT wrapper, which contradicts this page's own "never wrapped"). What
// LayerZero gives Stellar is USDT0, live since 2026-09-02. So the two routes are transports, not inputs: CCTP moves
// USDC, LayerZero moves USDT0, and either can be reached from any curated asset by swapping first.
//
// EVERY ADDRESS AND NUMBER BELOW WAS READ OFF MAINNET, not copied from a blog post:
//   * the OFT's ABI came out of the deployed WASM's contractspecv0 section (the docs do not state it),
//   * all twelve destinations were confirmed by calling peer(eid) on the live contract,
//   * the endpoint contract is not in USDT0's published deployment list -- the contract named it itself.
//
// TWO TRAPS, BOTH PAID FOR IN FAILED CALLS:
//
//   1. Soroban's quote_send takes a LEADING `from` that the EVM signature does not. Omitting it fails as
//      HostError: Error(Object, InvalidInput), which names nothing useful.
//   2. nativeToScVal encodes a struct key as an ScVal STRING unless that key appears in the type map, and Soroban
//      wants a SYMBOL. A partial type map therefore produces a struct that looks right and is rejected with the same
//      unhelpful InvalidInput. LZ_TYPES below names every field for exactly that reason -- the encoding it produces
//      was diffed byte-for-byte against the contract spec's own encoder before this file was written.
//
// The vendored stellar-sdk (13.3.0) CANNOT parse this contract's spec -- it throws "unknown ScSpecEntryKind member
// for value 5", an entry kind newer than the bundle. That blocks spec-driven tooling only, never calling, which is
// why the arguments here are built by hand and why the paragraph above matters.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);
const { LZ_LIVE } = require(__dirname + '/_lzflag.js');

const ID = 'lx-lz-js';

// Stellar's own LayerZero endpoint id, confirmed twice: USDT0's deployment page and LayerZero's metadata API.
const SRC_EID = 30600;

const CFG = {
  srcEid: SRC_EID,
  oft: 'CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6',
  token: 'CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF',
  endpoint: 'CCQLLRE5JBAWYCW3KTWOIWLMFDUOKROQVZNSALQMGOSXNW3ERUOWTZGK',
  issuer: 'GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q',
  code: 'USDT0',
  decimals: 7,
  // TIMING IS MEASURED, NOT ADVERTISED. A real Stellar->Polygon USDT0 message (source tx
  // da0fafd987515517…, 2026-09-16 19:03:11Z) took 1,654s end to end, and it breaks down as:
  //   +1600s  readiness   -- the confirmation wait
  //   +  15s  DVN verify  -- 3 required DVNs (Canary, LayerZero Labs, USDT0)
  //   +  39s  executor    -- delivery on the destination
  // That 1,600s is not luck: the pathway's outboundConfig reports confirmations: 320, and 320 Stellar
  // ledgers x 5s is exactly 1,600s. So the wait is deterministic and can be quoted honestly rather than
  // guessed at -- which matters, because ~28 minutes is far slower than people assume LayerZero to be.
  //
  // RE-MEASURED 2026-09-19 over EVERY USDT0 send out of Stellar LayerZero Scan lists (53, 3-18 Sep, to Arbitrum,
  // Polygon, Ethereum, Optimism, MegaETH, Hyperliquid): min 27.0, median 30.5, p90 31.1, max 67.9 minutes. The one
  // message above was the fast end. The ledger wait is still 320 x 5.0s = 26.7 min; the rest -- DVN verification and
  // execution -- runs ~3.8 min typically, not 54s. verifySeconds is set so the estimate is the MEDIAN, ~30 minutes.
  // Measure again: GET scan.layerzero-api.com/v1/messages/oapp/30600/<sender bytes32>?limit=100, keep srcEid 30600.
  confirmations: 320,
  ledgerSeconds: 5,
  verifySeconds: 200,     // 1,600 + 200 = 1,800s = 30 min: the median, and the same figure the FAQ states
  // Every one of these answered peer(eid) on the live OFT, so each is a route that actually exists rather than a
  // chain LayerZero supports in general.
  eids: {
    Ethereum: 30101, Arbitrum: 30110, Optimism: 30111, Polygon: 30109,
    Berachain: 30362, Ink: 30339, Hyperliquid: 30367, Monad: 30390,
    Flare: 30295, Sei: 30280, MegaETH: 30398, Plasma: 30383,
  },
};

// The picker is built from the bridge's OWN components -- .br-side is the bordered grid panel the Source address and
// asset rows already sit in, and .hd is its uppercase label. Only the option cards and the selected state are new,
// and they are built from the same tokens the rest of the page uses, so nothing here introduces a second visual
// language. The panel is markup at BUILD time rather than script-built, because a script-built block escapes every
// copy and SEO pass this repo runs.
const CSS = '<style id="lx-lzpick-css">'
  // MEASURED AGAINST THE PANELS IT SITS UNDER, not eyeballed. RAZA 2026-09-17: "this bridge route box looks shit.
  // its not symetrical or neat, neither suits our theme". It was inheriting .br-side's max-width of 640px while
  // .br-io above it is 860px, so the panel sat 220px narrower and 105px to the left of every other box on the step.
  // The card interior now uses the same values the .br-wallet boxes beside it compute to: var(--bg) on var(--border)
  // at 11px radius, 64px minimum, rather than a second set of numbers that merely looked close.
  // BESIDE THE FORM, NOT UNDER IT (RAZA 2026-09-17: "cant you place it on side in a neat way"). The step has 1230px
  // and .br-io caps at 860, so the 370px left over is a real column rather than a squeeze. The pair is centred as a
  // unit, which does shift the form ~185px left of where it sits today -- unavoidable once something stands beside
  // it, and the alternative (form centred, route hanging off the right) is worse.
  //
  // Below 1240px there is no longer room for two, so it falls back to exactly today's stacked layout.
  + '.lx-brwrap{display:grid;grid-template-columns:860px minmax(300px,1fr);justify-content:center;'
  + 'align-items:start;gap:18px;width:100%}'
  + '.lx-brwrap > .br-io{margin-left:0 !important;margin-right:0 !important;min-width:0}'
  + '.lx-brwrap > .lx-brroute{max-width:none !important;margin:0 !important;min-width:0}'
  // One card above the other in a narrow column reads better than two cramped ones side by side. grid-auto-rows:1fr
  // makes the two equal height: their notes differ in length ("you pay its gas" vs "nothing to claim"), so without
  // it one card stood 18px taller than the other and the stack read as lopsided.
  + '.lx-brwrap > .lx-brroute .lx-brr-opts{grid-template-columns:1fr;grid-auto-rows:1fr}'
  + '@media (max-width:1240px){'
  + '.lx-brwrap{display:block}'
  + '.lx-brwrap > .br-io{margin-left:auto !important;margin-right:auto !important}'
  + '.lx-brwrap > .lx-brroute{max-width:860px !important;margin:16px auto 0 !important}'
  + '.lx-brwrap > .lx-brroute .lx-brr-opts{grid-template-columns:1fr 1fr}'
  + '}'
  + '@media (max-width:720px){.lx-brwrap > .lx-brroute .lx-brr-opts{grid-template-columns:1fr}}'
  + '.lx-brroute{display:block !important;max-width:860px !important;margin-left:auto !important;margin-right:auto !important}'
  + '.lx-brroute .hd{grid-column:auto;grid-row:auto;margin-bottom:12px}'
  // A lone route filled half the row and left the other half empty. :only-child makes it span instead, so the panel
  // is symmetrical whether a destination has one route or two -- no JS, no second layout to keep in step.
  + '.lx-brr-opts{display:grid;grid-template-columns:1fr 1fr;gap:13px;align-items:stretch}'
  + '.lx-brr-opts > .lx-brr:only-child{grid-column:1 / -1}'
  + '@media (max-width:720px){.lx-brr-opts{grid-template-columns:1fr}}'
  + '.lx-brr{text-align:left;width:100%;box-sizing:border-box;display:flex;flex-direction:column;'
  + 'min-height:64px;padding:13px 15px;border-radius:11px;'
  + 'border:1px solid var(--border);background:var(--bg);color:var(--text);font:inherit;cursor:pointer;'
  + 'transition:border-color .14s ease,background .14s ease}'
  + '.lx-brr:hover{border-color:var(--border-strong,#34343c)}'
  + '.lx-brr[aria-pressed="true"]{border-color:var(--accent,#ea6a2c);background:var(--accent-pale,rgba(234,106,44,.10))}'
  + '.lx-brr[disabled]{cursor:default;opacity:.55}'
  + '.lx-brr[disabled]:hover{border-color:var(--border)}'
  + '.lx-brr-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}'
  // ON THE SITE'S OWN SCALE (RAZA 2026-09-17: "the next inside bridge route doesn't match our font and font size").
  // Measured rather than guessed: the design's primary text computes to 16.5px/600 Hanken and its secondary to
  // 13.8px/400, because _typescale.js raised everything ~10% -- and injected CSS like this never went through that
  // pass, so every line here was a size or two small against its neighbours. These are now the design's numbers.
  + '.lx-brr-nm{font:600 16.5px/1.2 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:-.1254px;color:var(--text)}'
  + '.lx-brr-as{font:700 12px/1.2 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;'
  + 'color:var(--text-soft);white-space:nowrap}'
  // Rows share one baseline grid so the two cards line up with each other, which is what "symmetrical" means here:
  // the label column is fixed and the value column takes the rest, so Arrives sits under Bridge fee in both cards.
  // Capped, not full-bleed. When a destination has only one route the card spans the whole 860px panel, and an
  // uncapped row threw the label to the far left and its value ~800px away at the far right, which reads as two
  // unrelated things rather than a pair. The cap keeps them visually joined at any card width.
  + '.lx-brr-l{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:baseline;max-width:330px;'
  + 'font:400 13.8px/1.5 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:-.1254px;color:var(--text-soft)}'
  + '.lx-brr-l + .lx-brr-l{margin-top:4px}'
  + '.lx-brr-l b{justify-self:end;text-align:right;color:var(--text);'
  + 'font:600 14px/1.5 "JetBrains Mono",monospace;letter-spacing:normal}'
  + '.lx-brr-note{margin-top:auto;padding-top:11px;font:400 12.5px/1.45 "Hanken Grotesk",system-ui,sans-serif;'
  + 'letter-spacing:-.1254px;color:var(--text-muted,#75757f)}'
  // The LayerZero-only destinations stay out of the dropdown until the route can actually carry a transfer. The
  // Sei rule needs the html prefix to outrank the CCTP layer's own .brd-opt[data-net="Sei"]{display:none!important}.
  + '.brd-opt.lx-lzopt{display:none !important}'
  + 'html.lx-lz-on .brd-opt.lx-lzopt{display:flex !important}'
  + 'html.lx-lz-on .brd-opt[data-net="Sei"]{display:flex !important}'
  // THE CARD IS THE DECISION, so it is built to be looked at: a brand mark, the name at a real size, what the
  // route is in one line, and a tag naming why you would pick it.
  + '.lx-brr-top{display:grid !important;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;margin-bottom:13px}'
  + '.lx-brr-mark{width:30px;height:30px;flex:0 0 30px;border-radius:50%;overflow:hidden;display:block}'
  + '.lx-brr-mark svg,.lx-brr-mark img{width:100%;height:100%;display:block;object-fit:contain}'
  + '.lx-brr-hd{display:flex;flex-direction:column;gap:2px;min-width:0}'
  + '.lx-brr-sub{font:400 12px/1.3 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-soft);'
  + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.lx-brr-tag{font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em;'
  + 'color:var(--accent,#ea6a2c);background:var(--accent-pale,rgba(234,106,44,.10));'
  + 'border:1px solid var(--accent-soft,rgba(234,106,44,.22));border-radius:999px;padding:5px 9px;white-space:nowrap}'
  + '.lx-brr[aria-pressed="true"] .lx-brr-tag{background:var(--accent,#ea6a2c);color:#fff;border-color:transparent}'
  + '.lx-brr-soon{display:inline-block;margin-top:8px;font:700 10px/1 "Hanken Grotesk",system-ui,sans-serif;'
  + 'text-transform:uppercase;letter-spacing:.06em;color:var(--accent,#ea6a2c);border:1px solid var(--accent-soft,rgba(234,106,44,.34));'
  + 'border-radius:999px;padding:4px 8px}'
  + '<' + '/style>';

// THE EIGHT DESTINATIONS ONLY LAYERZERO CAN REACH. Seven are not in the design's dropdown at all (it ships 18
// options: CCTP's 8 plus 10 the CCTP layer hides by CSS); Sei is there but hidden for exactly the reason that no
// longer holds -- it was hidden BECAUSE CCTP cannot reach it, and LayerZero can.
//
// All eight are gated behind html.lx-lz-on, which the runtime sets only when LZ_SENDABLE is true. That keeps the
// whole feature on ONE switch: until it flips, the route card, these destinations and the copy all stay off
// together. Offering a destination that cannot yet be bridged would be the same misrouting risk as a selectable
// disabled route, moved one step earlier in the wizard.
//
// The badge colours are letter-mark placeholders in the design's own .lx-netlm style; the logo engine replaces
// them wherever an actual network logo exists, exactly as it does for the existing options.
const LZ_ONLY = [
  ['Berachain', 'BERA', '#814625'], ['Ink', 'INK', '#7132f5'], ['Hyperliquid', 'HYPE', '#0f3d34'],
  ['Monad', 'MON', '#836ef9'], ['Flare', 'FLR', '#e62058'], ['MegaETH', 'MEGA', '#2b2b31'],
  ['Plasma', 'XPL', '#0f7b6c'],
];
const LZ_OPTS = LZ_ONLY.map(function (n) {
  return '<button class="brd-opt lx-lzopt" type="button" data-net="' + n[0] + '" data-lz-only>'
    + '<span class="brd-ic lx-netlm" style="background:' + n[2] + '">' + n[1] + '</span>'
    + '<span class="brd-nm">' + n[0] + '</span></button>';
}).join('');

const MARKUP = '<div class="br-side lx-brroute" data-lxroute hidden>'
  // The heading is CSS content, not a text node. With real text the panel's whole textContent was 'Route' -- five
  // characters -- until the first quote arrived, and the logo healer repaints any 1-5 character span/div that has a
  // radius (this card has 18px) as a token badge: it stamped data-logo='APT' on the panel and cleared it, taking
  // the cards' host and the stats host with it. Pseudo-element content is not textContent, so the healer sees an
  // empty panel and passes it by.
  + '<div class="hd" aria-label="Route"></div>'
  + '<div class="lx-brr-opts" data-lxroute-opts></div>'
  + '<div class="lx-brr-stats" data-lxroute-stats></div>'
  + '</div>';

const BODY = '(function(){'
  + 'try{ window.__lxLZ=' + JSON.stringify(CFG) + '; }catch(_){ }'

  // The CCTP layer has its own loader, but it lives inside that file's IIFE and is NOT on window -- reaching for it
  // fails with "Stellar SDK not loaded" on a page where the SDK is merely lazy. So load it the same way it does,
  // keyed on the same window.StellarSdk, which means whichever layer asks first wins and the file is fetched once.
  + 'var _lzSdkP=null;'
  + 'function lzSdk(){'
  + ' if(window.StellarSdk) return Promise.resolve(window.StellarSdk);'
  + ' if(_lzSdkP) return _lzSdkP;'
  + ' _lzSdkP=new Promise(function(res,rej){'
  + '  var s=document.createElement("script");'
  + '  s.src="/assets/vendor/stellar-sdk-13.3.0.min.js";'
  + '  s.onload=function(){ window.StellarSdk?res(window.StellarSdk):rej(new Error("Stellar SDK failed to load")); };'
  + '  s.onerror=function(){ rej(new Error("Stellar SDK failed to load")); };'
  + '  document.head.appendChild(s);'
  + ' });'
  + ' return _lzSdkP; }'

  // Soroban wants SYMBOL keys. Naming every field is the whole point -- see the header.
  + 'var LZ_TYPES={amount_ld:["symbol","i128"],compose_msg:["symbol","bytes"],dst_eid:["symbol","u32"],'
  + 'extra_options:["symbol","bytes"],min_amount_ld:["symbol","i128"],oft_cmd:["symbol","bytes"],to:["symbol","bytes"]};'

  // An EVM address is left-padded to the 32 bytes LayerZero addresses with.
  + 'function lzTo32(S,addr){ var h=String(addr||"").replace(/^0x/,"");'
  + ' if(!/^[0-9a-fA-F]{40}$/.test(h)) h="0000000000000000000000000000000000000000";'
  + ' var b=new Uint8Array(32); for(var i=0;i<20;i++) b[12+i]=parseInt(h.substr(i*2,2),16); return b; }'

  + 'function lzUnits(S,human){ var d=(window.__lxLZ||{}).decimals||7;'
  + ' var n=String(human==null?0:human).replace(/,/g,""); var p=n.split("."); var w=p[0]||"0", f=(p[1]||"").slice(0,d);'
  + ' while(f.length<d) f+="0"; var s=(w+f).replace(/^0+(?=\\d)/,""); return BigInt(s||"0"); }'

  + 'function lzParam(S,eid,toAddr,amountHuman,minHuman){'
  + ' return S.nativeToScVal({amount_ld:lzUnits(S,amountHuman),compose_msg:new Uint8Array(0),dst_eid:eid,'
  + ' extra_options:new Uint8Array(0),min_amount_ld:lzUnits(S,minHuman||0),oft_cmd:new Uint8Array(0),'
  + ' to:lzTo32(S,toAddr)},{type:LZ_TYPES}); }'

  // ---- reaching Soroban RPC --------------------------------------------------------------------------------
  // "FAILED TO FETCH" (RAZA 2026-09-19, LayerZero card on Polygon). mainnet.sorobanrpc.com is a free public endpoint
  // with rate limits; a refused or dropped request surfaces in the browser as a bare TypeError with that text, which
  // the card printed as-is. Both endpoints below were checked the same day: they answer and send CORS for our origin.
  // One attempt each, 12s apiece, in order -- the first real JSON answer wins.
  + 'var LZ_RPCS=[((window.__lxCCTP||{}).rpc)||"https://mainnet.sorobanrpc.com","https://soroban-rpc.mainnet.stellar.gateway.fm"];'
  + 'function lzPost(body){'
  + ' var list=LZ_RPCS.filter(function(u,i,a){ return u&&a.indexOf(u)===i; }), i=0;'
  + ' function next(err){ if(i>=list.length) return Promise.reject(err||new Error("Failed to fetch"));'
  + '  var u=list[i++], ctl=(typeof AbortController!=="undefined")?new AbortController():null, tm=ctl?setTimeout(function(){ ctl.abort(); },12000):null;'
  + '  return fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:body,signal:ctl?ctl.signal:undefined})'
  + '   .then(function(r){ if(tm) clearTimeout(tm); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })'
  + '   .catch(function(e){ if(tm) clearTimeout(tm); return next(e); }); }'
  + ' return next(); }'
  // A network failure, as opposed to the contract answering "no": worth a retry, never worth showing raw.
  + 'function lzNetErr(e){ var m=String((e&&e.message)||e||""); return /Failed to fetch|NetworkError|Load failed|abort|HTTP (429|5\\d\\d)/i.test(m); }'

  // Simulation only. Nothing here signs and nothing here submits.
  + 'function lzSim(S,fn,args,fromG){'
  + ' var C=window.__lxLZ, rpc=((window.__lxCCTP||{}).rpc)||"https://mainnet.sorobanrpc.com";'
  + ' var pass=((window.__lxCCTP||{}).passphrase)||"Public Global Stellar Network ; September 2015";'
  + ' var hz=((window.__lxCCTP||{}).horizon)||"https://horizon.stellar.org";'
  + ' return fetch(hz+"/accounts/"+fromG).then(function(r){ if(!r.ok) throw new Error("Account not found on Stellar"); return r.json(); })'
  + ' .then(function(a){'
  + '  var tx=new S.TransactionBuilder(new S.Account(fromG,a.sequence),{fee:"2000000",networkPassphrase:pass})'
  + '   .addOperation(new S.Contract(C.oft).call.apply(new S.Contract(C.oft),[fn].concat(args))).setTimeout(300).build();'
  + '  return lzPost(JSON.stringify({jsonrpc:"2.0",id:1,method:"simulateTransaction",params:{transaction:tx.toXDR()}}));'
  + ' }).then(function(j){'
  + '  var res=(j&&j.result)||{};'
  + '  if(res.error) throw new Error(String(res.error).split("\\n")[0]);'
  + '  var rv=res.results&&res.results[0]&&res.results[0].xdr;'
  + '  if(!rv) throw new Error("No value returned by "+fn);'
  + '  return S.scValToNative(S.xdr.ScVal.fromXDR(rv,"base64"));'
  + ' }); }'

  // Whose account the quote is asked as. The figure does not depend on their balance, but simulation needs a real
  // account for the sequence number, so an unconnected visitor still gets a true quote via the issuer.
  + 'function lzFrom(){ try{ var a=(window.lxCctpConnectedAddr&&window.lxCctpConnectedAddr())||""; if(a)return a; }catch(_){ }'
  + ' return (window.__lxLZ||{}).issuer; }'

  // The LayerZero messaging fee, in XLM. This is the whole cost of the route besides LumosCore's own rate --
  // measured 2026-09-17: USDT0 itself takes nothing (quote_oft returns an empty fee list and a 1:1 receipt).
  + 'function lxLzQuote(dest,amountHuman,recipient){'
  + ' var C=window.__lxLZ, eid=(typeof dest==="number")?dest:(C.eids||{})[dest];'
  + ' if(!eid) return Promise.reject(new Error("No LayerZero route to "+dest));'
  + ' var from=lzFrom();'
  + ' return lzSdk().then(function(S){'
  + '  return lzSim(S,"quote_send",[new S.Address(from).toScVal(),lzParam(S,eid,recipient,amountHuman,0),S.xdr.ScVal.scvBool(false)],from)'
  + '  .then(function(v){ var nf=(v&&v.native_fee!=null)?v.native_fee:(Array.isArray(v)?v[0]:null);'
  + '   if(nf==null) throw new Error("Unexpected quote shape");'
  + '   return { eid:eid, feeXlm:Number(nf)/1e7, feeStroops:String(nf) }; });'
  + ' }); }'

  // What actually lands, and how much the on-chain limiter will still accept. Read rather than assumed: the fee
  // machinery exists in the contract and could be switched on later.
  + 'function lxLzQuoteOft(dest,amountHuman,recipient){'
  + ' var C=window.__lxLZ, eid=(typeof dest==="number")?dest:(C.eids||{})[dest];'
  + ' if(!eid) return Promise.reject(new Error("No LayerZero route to "+dest));'
  + ' var from=lzFrom(), d=C.decimals||7;'
  + ' return lzSdk().then(function(S){'
  + '  return lzSim(S,"quote_oft",[new S.Address(from).toScVal(),lzParam(S,eid,recipient,amountHuman,0)],from)'
  + '  .then(function(v){'
  + '   var lim=Array.isArray(v)?v[0]:v.limit, fees=Array.isArray(v)?v[1]:v.oft_fee_details, rec=Array.isArray(v)?v[2]:v.receipt;'
  + '   function h(x){ return x==null?null:Number(x)/Math.pow(10,d); }'
  + '   return { received:h(rec&&rec.amount_received_ld), sent:h(rec&&rec.amount_sent_ld),'
  + '    maxAmount:h(lim&&lim.max_amount_ld), minAmount:h(lim&&lim.min_amount_ld),'
  + '    fees:(fees||[]).map(function(f){ return {amount:h(f.fee_amount_ld),description:f.description}; }) }; });'
  + ' }); }'

  // Is the route open at all? A paused OFT rejects send, receive and both quotes.
  + 'function lxLzPaused(){ var from=lzFrom();'
  + ' return lzSdk().then(function(S){ return lzSim(S,"is_paused",[],from); }).catch(function(){ return null; }); }'

  // Every destination this site can reach, and by which transport. A chain on both is a CHOICE, not a tie to break
  // automatically: the two deliver different assets (CCTP -> USDC, LayerZero -> USDT0).
  + 'function lxBrRoutes(){'
  + ' var cc=((window.__lxCCTP||{}).domains)||{}, lz=((window.__lxLZ||{}).eids)||{};'
  + ' var names={}, out=[];'
  + ' Object.keys(cc).forEach(function(k){ names[k]=1; }); Object.keys(lz).forEach(function(k){ names[k]=1; });'
  + ' Object.keys(names).sort().forEach(function(k){'
  + '  out.push({ name:k, cctp:(cc[k]!=null), lz:(lz[k]!=null), domain:cc[k], eid:lz[k],'
  + '   asset:(cc[k]!=null&&lz[k]==null)?"USDC":((lz[k]!=null&&cc[k]==null)?"USDT0":"USDC or USDT0") });'
  + ' });'
  + ' return out; }'

  // BOTH ROUTES, SIDE BY SIDE, FOR ONE DESTINATION (RAZA 2026-09-17: "lets give user the choice. also we'll mention
  // estimated trx cost and time for both"). Deliberately NOT an automatic cheapest-wins pick: the two transports
  // deliver DIFFERENT assets, so the cheaper one can be the wrong one for someone who wants USDC specifically.
  //
  // The two routes are slow and fast in opposite places, which is the thing the user is actually choosing between:
  //
  //   CCTP       attestable in ~5s, because the confirmations Circle counts are on the SOURCE chain and Stellar
  //              needs exactly 1. But it is only half a transfer -- the user then sends receiveMessage themselves
  //              and pays that chain's gas, which on Ethereum is the dominant cost of the whole operation.
  //   LayerZero  ~28 minutes, fixed by the 320-confirmation wait above, but nothing is left to do: the executor
  //              delivers and the XLM messaging fee already paid for it.
  //
  // So neither number alone decides it, and the honest presentation is both, with the claim step named.
  + 'function lzEta(){ var C=window.__lxLZ||{}; return (C.confirmations||320)*(C.ledgerSeconds||5)+(C.verifySeconds||200); }'
  + 'function lzHuman(sec){ if(sec<90) return "~"+Math.max(1,Math.round(sec))+" seconds";'
  + ' var m=Math.round(sec/60); return "~"+m+" minute"+(m===1?"":"s"); }'
  // A ticker is not an identity on Stellar, so the source asset's issuer comes from LX_ASSETS, never from a copy.
  + 'function lzSpecFor(key){ if(!key||key==="XLM") return (key==="XLM")?{native:true}:null;'
  + ' var a=(window.LX_ASSETS||{})[key]; var sp=a&&a.spec;'
  + ' if(sp==="USDC") return {code:"USDC",issuer:(window.__lxCCTP||{}).usdcIssuer};'
  + ' return sp||null; }'
  // CAN THE SOURCE ASSET EVEN REACH THE TRANSPORT? A route whose swap leg has no path is not available, however
  // cheap its messaging fee looks. Checked per route because the two transports have very different depth:
  // USDC has been traded on Stellar for years, USDT0 only since 2026-09-02 and its book is still thin.
  // A PATH EXISTING IS NOT THE SAME AS A PATH BEING SAFE. Measured on mainnet 2026-09-17: Horizon's strict-send
  // pathfinder happily answers 10,000,000 USDC -> USDT0 with 30.95 USDT0 out. Ten million dollars in, thirty-one
  // dollars back, and a route marked "available" the whole way. The young USDT0 book simply has no depth, and the
  // pathfinder reports the best it can do rather than refusing.
  //
  // So the guard is on VALUE, not existence, and it needs no price oracle: BOTH transports are dollar stablecoins,
  // so their outputs for the same input are directly comparable. If one transport returns dramatically less than
  // the other for the same source amount, that transport has run out of book and must not be offered.
  + 'var LZ_BAD=0.5;'                          // under half the other transport's output = the book is gone
  + 'var LZ_IMPACT_WARN=0.01, LZ_IMPACT_BLOCK=0.05;'   // shown in amber above 1%; refused above 5%
  + 'function lzPathOut(sourceKey,transport,amt){'
  + ' if(!sourceKey||sourceKey===transport) return Promise.resolve({ok:true,out:(amt>0?amt:0),same:true});'
  + ' var CC=window.__lxCCTP||{}, spec=lzSpecFor(sourceKey);'
  + ' if(!spec||!window.lxStrictPath) return Promise.resolve({ok:true,out:null});' // unknown asset: do not claim a failure
  + ' var dest=(transport==="USDC")?{code:"USDC",issuer:CC.usdcIssuer}:{code:"USDT0",issuer:(window.__lxLZ||{}).issuer};'
  // PRICE IMPACT, not just existence. 50 USDC -> USDT0 returned 48.15 (3.5% gone) and 100 USDC -> 38.09 (62% gone)
  // on 2026-09-19: ~26 USDT0 sits near $1, the next offers are at $1.34 and $10. The old check only compared the two
  // transports against each other, so a LayerZero-only chain (Plasma) had nothing to compare with and was never
  // judged at all. Now each leg is judged on its own: the rate at the user's size against the rate at 1% of it.
  // Dollar stablecoins in need no second quote -- their reference is $1.
  + ' var a=(amt>0?amt:1), ref=a/100, par=(sourceKey==="USDC"||sourceKey==="USDT0");'
  + ' return Promise.all([ window.lxStrictPath(CC,spec,a.toFixed(7),dest),'
  + '   par?Promise.resolve(null):window.lxStrictPath(CC,spec,ref.toFixed(7),dest).catch(function(){ return null; }) ])'
  + '  .then(function(pq){ var p=pq[0], q=pq[1], unit=par?1:((q&&+q.out>0)?(+q.out/ref):0);'
  + '   var imp=(amt>0&&unit>0)?Math.max(0,1-(+p.out/a)/unit):null;'
  + '   var r={ok:true,out:p.out,impact:imp};'
  + '   if(imp!=null&&imp>LZ_IMPACT_BLOCK){ r.ok=false; r.reason="Not enough "+transport+" liquidity on Stellar for this amount — the swap would lose "+Math.round(imp*100)+"%. Try a smaller amount."; }'
  + '   return r; })'
  + '  .catch(function(){ return {ok:false,out:null,reason:"No "+sourceKey+"\\u2192"+transport+" route for this amount."}; }); }'
  // Compares the two and closes whichever one the book has abandoned. Only decides when BOTH answered, because a
  // single unopposed number says nothing about whether it is a good one.
  + 'function lzGrade(a,b){'
  + ' if(!a.ok||!b.ok||a.out==null||b.out==null||!(a.out>0)||!(b.out>0)) return;'
  + ' if(a.out < b.out*LZ_BAD){ a.ok=false; a.reason="Not enough liquidity for this amount \\u2014 this route would lose most of it."; }'
  + ' if(b.out < a.out*LZ_BAD){ b.ok=false; b.reason="Not enough liquidity for this amount \\u2014 this route would lose most of it."; } }'

  + 'function lxBrCompare(dest,amountHuman,recipient,sourceKey){'
  + ' var routes=lxBrRoutes().filter(function(r){ return r.name===dest; })[0];'
  + ' if(!routes) return Promise.resolve([]);'
  + ' var rate=(window.__lxFeeRate||((window.__lxCCTP||{}).feeRate)||0.002);'
  + ' var amt=parseFloat(String(amountHuman||0).replace(/,/g,""))||0;'
  + ' var out=[];'
  // Both legs are priced before either is judged, so lzGrade has two numbers to compare.
  + ' return Promise.all(['
  + '  routes.cctp?lzPathOut(sourceKey,"USDC",amt):Promise.resolve(null),'
  + '  routes.lz?lzPathOut(sourceKey,"USDT0",amt):Promise.resolve(null)'
  + ' ]).then(function(pair){'
  + '  var cp=pair[0], lp=pair[1];'
  + '  if(cp&&lp) lzGrade(cp,lp);'
  + '  if(routes.cctp){'
  + '   out.push({ route:"CCTP", asset:"USDC", available:(cp?cp.ok:true), error:(cp&&!cp.ok)?cp.reason:null,'
  + '    platformFee:+(amt*rate).toFixed(7), networkFeeXlm:0, swapOut:(cp&&cp.out!=null&&!cp.same)?cp.out:null,'
  + '    recv:(amt>0?+(((cp&&cp.out!=null)?cp.out:amt)*(1-rate)).toFixed(6):0), impact:(cp&&cp.impact!=null)?cp.impact:null,'
  + '    etaSeconds:5, etaText:"~5 seconds to claimable",'
  + '    needsClaim:true, claimNote:"You send the claim on "+dest+" and pay its gas." });'
  + '  }'
  + '  if(!routes.lz) return out;'
  + '  return Promise.resolve(lp).then(function(lp){'
  + '   if(!lp.ok){ out.push({ route:"LayerZero", asset:"USDT0", available:false, error:lp.reason,'
  + '    etaSeconds:lzEta(), etaText:lzHuman(lzEta())+", delivered automatically", needsClaim:false });'
  + '    return out; }'
  + '   return lxLzQuote(dest,amt||1,recipient).then(function(q){'
  + '    out.push({ route:"LayerZero", asset:"USDT0", available:true,'
  + '     platformFee:+(amt*rate).toFixed(7), networkFeeXlm:q.feeXlm,'
  + '     recv:(amt>0&&lp.out!=null?+(lp.out*(1-rate)).toFixed(6):0), impact:(lp.impact!=null)?lp.impact:null,'
  + '     etaSeconds:lzEta(), etaText:lzHuman(lzEta())+", delivered automatically",'
  + '     needsClaim:false, claimNote:"Delivered to your address automatically \\u2014 the XLM messaging fee pays for delivery." });'
  + '    return out;'
  + '   }).catch(function(e){'
  // STELLAR UNREACHABLE is not the route failing. With a fee already quoted for this destination (they move slowly),
  // show the route with that fee -- the send itself always re-quotes live before signing, so a stale figure can never
  // be what is paid. Without one, say what happened in words and try again shortly (lzRetry), never "Failed to fetch".
  + '    var cf=(typeof _lzLast!=="undefined")?_lzLast["fee|"+dest]:0;'
  + '    if(lzNetErr(e)&&cf>0){ out.push({ route:"LayerZero", asset:"USDT0", available:true,'
  + '     platformFee:+(amt*rate).toFixed(7), networkFeeXlm:cf,'
  + '     recv:(amt>0&&lp.out!=null?+(lp.out*(1-rate)).toFixed(6):0), impact:(lp.impact!=null)?lp.impact:null,'
  + '     etaSeconds:lzEta(), etaText:lzHuman(lzEta())+", delivered automatically",'
  + '     needsClaim:false, claimNote:"Delivered to your address automatically \\u2014 the XLM messaging fee pays for delivery." });'
  + '     return out; }'
  + '    if(lzNetErr(e)){ try{ lzRetry(); }catch(_){ } }'
  // A route that cannot be quoted is shown as unavailable rather than silently dropped: the user should be able to
  // see that LayerZero exists for this chain and is not answering, instead of wondering where the choice went.
  + '    out.push({ route:"LayerZero", asset:"USDT0", available:false, error:lzNetErr(e)?"Couldn\\u2019t reach Stellar to price this route \\u2014 retrying\\u2026":((e&&e.message)||"Quote unavailable"),'
  + '     etaSeconds:lzEta(), etaText:lzHuman(lzEta())+", delivered automatically", needsClaim:false });'
  + '    return out;'
  + '   });'                                   // closes lxLzQuote(...).catch
  + '  });'                                    // closes lzPathOk(USDT0).then
  + ' }); }'                                   // closes cctpP.then, then lxBrCompare
  // THE THIRD ROUTE. NEAR Intents (_nearintents.js) prices itself -- a dry 1Click quote for the token the user picked --
  // and is appended when this destination is one it serves. Wrapped rather than woven in so the two stablecoin routes
  // above are untouched; a NEAR failure can only ever cost its own row, never theirs.
  + 'var _lzCmpBase=lxBrCompare;'
  + 'lxBrCompare=function(dest,amountHuman,recipient,sourceKey){'
  + ' return _lzCmpBase(dest,amountHuman,recipient,sourceKey).then(function(out){'
  + '  if(!window.lxNiRow) return out;'
  + '  return Promise.resolve(window.lxNiRow(dest,amountHuman,sourceKey,recipient)).then(function(r){ return r?out.concat([r]):out; }).catch(function(){ return out; });'
  + ' }); };'

  // ---- the send engine --------------------------------------------------------------------------------------
  // Validated before any signature existed: the real transaction was built and run through simulateTransaction
  // (a read-only dry run) against mainnet. It was accepted all the way into the token transfer and refused there
  // with Error(Contract, #10) -- BalanceError from the Stellar Asset Contract, because the test wallet's USDT0 was
  // entirely committed to an open sell offer. The OFT declares its OWN errors as 3000-3099, so a small number like
  // #10 is always a contract further down the call chain, never this one.
  //
  // Read that distinction before ever touching the encoding again:
  //   InvalidInput / UnexpectedType / MissingValue  -> the ARGUMENTS are wrong
  //   Contract, #n                                  -> arguments accepted, the contract refused on STATE
  //
  // No approve step, unlike CCTP: `from` authorizes the call directly through Soroban auth, so the OFT's internal
  // token transfer is covered by the same authorization. The simulation reaching the balance check proves it --
  // an allowance problem would have stopped it earlier.
  + 'function lzErr(e){ var m=String((e&&e.message)||e||"");'
  + ' if(/Contract, #10\\b/.test(m)) return "Not enough spendable balance \\u2014 either USDT0 (some may be committed to an open sell offer) or XLM for the messaging fee.";'
  + ' if(/Contract, #300[0-9]|Contract, #30[1-9][0-9]/.test(m)) return "The USDT0 bridge rejected this transfer: "+m;'
  + ' if(/InvalidInput|UnexpectedType|MissingValue/.test(m)) return "Internal error building the transfer.";'
  + ' return m||"Transfer failed"; }'

  // Same build -> simulate -> assemble -> sign -> submit -> poll shape the CCTP burn uses, and the SAME signer,
  // so all three wallet transports behave identically on both routes.
  + 'function lxLzSend(dest,amountHuman,recipient,onStatus){'
  + ' onStatus=onStatus||function(){};'
  + ' if(!LZ_SENDABLE) return Promise.reject(new Error("The LayerZero route is not enabled yet."));'
  + ' var C=window.__lxLZ, eid=(typeof dest==="number")?dest:(C.eids||{})[dest];'
  + ' if(!eid) return Promise.reject(new Error("No LayerZero route to "+dest));'
  + ' if(!window.lxCctpSigner||!window.lxCctpSdk) return Promise.reject(new Error("Wallet layer not ready."));'
  + ' var pass=((window.__lxCCTP||{}).passphrase)||"Public Global Stellar Network ; September 2015";'
  + ' var rpc=((window.__lxCCTP||{}).rpc)||"https://mainnet.sorobanrpc.com";'
  + ' return window.lxCctpSdk().then(function(S){'
  + '  var server=new S.rpc.Server(rpc), pk;'
  + '  return window.lxCctpSigner().then(function(f){'
  + '   function rpcCall(m,p){ return fetch(rpc,{method:"POST",headers:{"Content-Type":"application/json"},'
  + '    body:JSON.stringify({jsonrpc:"2.0",id:1,method:m,params:p})}).then(function(r){ return r.json(); }); }'
  + '   function buildSim(op){ return server.getAccount(pk).then(function(acct){'
  // Inclusion bid 0.01 XLM (100,000 stroops), not 1 XLM. The network charges the going rate, not the bid -- but the
  // account must HOLD the whole bid, so 1 XLM made a wallet with enough for the transfer fail for want of a fee it
  // would never actually pay. 0.01 XLM is 1,000x the minimum; the resource fee is added on top by assembleTransaction.
  + '    var tx=new S.TransactionBuilder(acct,{fee:"100000",networkPassphrase:pass}).addOperation(op).setTimeout(300).build();'
  + '    return server.simulateTransaction(tx).then(function(sim){ if(sim.error) throw new Error(lzErr(sim.error));'
  + '     return S.rpc.assembleTransaction(tx,sim).build(); }); }); }'
  + '   function signSubmit(prepared,label){'
  + '    onStatus("Waiting for signature ("+label+")\\u2026");'
  + '    var go=function(){ return Promise.resolve(f.signTransaction(prepared.toXDR(),{networkPassphrase:pass,network:"PUBLIC",address:pk})); };'
  + '    return (window.lxCctpGateSign?window.lxCctpGateSign(label,go):go()).then(function(sig){'
  + '     var xdr=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig;'
  + '     if((sig&&sig.error)||typeof xdr!=="string") throw new Error("Signing cancelled.");'
  + '     onStatus("Submitting "+label+"\\u2026");'
  + '     return rpcCall("sendTransaction",{transaction:xdr}).then(function(res){'
  + '      if(res.error) throw new Error(label+" submit error: "+JSON.stringify(res.error).slice(0,160));'
  + '      var r=res.result||{};'
  + '      if(r.status==="ERROR") throw new Error(label+" rejected: "+JSON.stringify(r.errorResultXdr||r).slice(0,160));'
  + '      var hash=r.hash; if(!hash) throw new Error(label+" submit failed.");'
  + '      function poll(t){ return rpcCall("getTransaction",{hash:hash}).then(function(g){'
  + '       var st=(g.result&&g.result.status)||"NOT_FOUND";'
  + '       if(st==="SUCCESS") return hash;'
  + '       if(st==="FAILED") throw new Error(label+" failed on-chain ("+hash+")");'
  + '       if(t>40) throw new Error(label+" timed out ("+hash+")");'
  + '       return new Promise(function(rr){ setTimeout(rr,2000); }).then(function(){ return poll(t+1); }); }); }'
  + '      return poll(0); }); }); }'
  + '   return Promise.resolve(f.requestAccess?f.requestAccess():null).then(function(){'
  + '    return f.getAddress?f.getAddress():(f.getPublicKey?f.getPublicKey():null); }).then(function(a){'
  + '    pk=(a&&a.address)||a; if(!pk) throw new Error("Could not read your wallet address.");'
  // The fee is the contract's own answer, never a guess: a send carrying less than quote_send asks for is rejected.
  + '    onStatus("Quoting the messaging fee\\u2026");'
  // THE MINIMUM THAT MUST ARRIVE. It was 0: harmless while USDT0 charges nothing (quote_oft reports no fee today), but
  // if Tether switched its fee_bps on, a transfer would still settle with less arriving and nothing would refuse it.
  // The OFT only drops dust below its 6 shared decimals, so anything under the amount floored to 6dp is refused.
  + '    var minH=Math.floor((parseFloat(String(amountHuman))||0)*1e6)/1e6;'
  + '    var sp=lzParam(S,eid,recipient,amountHuman,minH);'
  + '    return lzSim(S,"quote_send",[new S.Address(pk).toScVal(),sp,S.xdr.ScVal.scvBool(false)],pk).then(function(q){'
  + '     var nf=(q&&q.native_fee!=null)?q.native_fee:(Array.isArray(q)?q[0]:null);'
  + '     if(nf==null) throw new Error("Could not price this transfer.");'
  + '     onStatus("Building transfer\\u2026");'
  + '     var feeScv=S.nativeToScVal({native_fee:BigInt(String(nf)),zro_fee:BigInt(0)},'
  + '      {type:{native_fee:["symbol","i128"],zro_fee:["symbol","i128"]}});'
  + '     var op=new S.Contract(C.oft).call("send",new S.Address(pk).toScVal(),sp,feeScv,new S.Address(pk).toScVal());'
  + '     return buildSim(op).then(function(p){ return signSubmit(p,"transfer"); }).then(function(hash){'
  + '      onStatus("Sent \\u2713");'
  + '      return { hash:hash, eid:eid, dest:dest, amount:amountHuman, recipient:recipient,'
  + '       feeXlm:Number(nf)/1e7, asset:"USDT0", route:"LayerZero", etaSeconds:lzEta() };'
  // Five closers, not four: hash -> q -> a -> f -> S, then the function itself. Getting this wrong emits a file
  // that fails to parse, which takes the WHOLE layer down silently -- every lx* function simply never exists.
  + '     }); }); }); }); }); }'

  // ---- source asset -> USDT0, then send ----------------------------------------------------------------------
  // Any curated asset can be the source (RAZA 2026-09-17: "It can be any curated LumosCore asset as the source
  // asset... we can convert it to the destination asset"). USDC and USDT0 are the TRANSPORT, not the input.
  //
  // Shape copied from the CCTP path deliberately, including its two hard-won rules:
  //   * THE PLATFORM FEE IS DEFERRED until after the transfer succeeds. Charging first means a transfer that
  //     fails validation leaves the user billed for nothing. A missed fee signature is remembered in
  //     lxFeeOwed and added to their next bridge, so it costs a delay rather than the fee.
  //   * A FEE PAID TO YOURSELF IS NOT A FEE. When the connected wallet IS the collector, skip it: otherwise it
  //     burns a network fee moving money nowhere and writes a revenue row that is not revenue.
  //
  // The swap and the send cannot share a transaction -- a Soroban op may not sit with classic ops -- so this is
  // two signatures for a non-USDT0 source, exactly as the CCTP route is.
  + 'function lxLzBridgeFull(dest,sourceAmountHuman,recipient,sourceSpec,onStatus){'
  + ' onStatus=onStatus||function(){};'
  + ' if(!LZ_SENDABLE) return Promise.reject(new Error("The LayerZero route is not enabled yet."));'
  + ' var C=window.__lxLZ, CC=window.__lxCCTP||{};'
  + ' var feeRate=(window.__lxFeeRate||CC.feeRate||0.002);'
  + ' var srcAmt=parseFloat(String(sourceAmountHuman).replace(/,/g,""));'
  + ' if(!(srcAmt>0)) return Promise.reject(new Error("Enter a valid amount"));'
  + ' var isT0=(!sourceSpec||sourceSpec==="USDT0"||sourceSpec.code==="USDT0");'
  + ' var T0={code:"USDT0",issuer:C.issuer};'
  + ' return window.lxCctpSdk().then(function(S){ return window.lxCctpSigner().then(function(f){'
  + '  var pk, deferredFee=null;'
  + '  function acc(){ return fetch(CC.horizon+"/accounts/"+pk).then(function(r){ return r.json(); }); }'
  + '  function t0Bal(){ return acc().then(function(a){'
  + '   var b=(a.balances||[]).filter(function(x){ return x.asset_code==="USDT0"&&x.asset_issuer===C.issuer; })[0];'
  // What is SPENDABLE, not what is held: an open sell offer reserves its amount and the ledger refuses to move it.
  // Getting this wrong is what produced Error(Contract, #10) during testing.
  + '   return b?Math.max(0,(+b.balance||0)-(+b.selling_liabilities||0)):0; }); }'
  + '  function submitClassic(xdr){ return fetch(CC.horizon+"/transactions",{method:"POST",'
  + '   headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(xdr)})'
  + '   .then(function(r){ return r.json(); }).then(function(res){ if(res.successful||res.hash) return res;'
  + '    var rc=res.extras&&res.extras.result_codes; throw new Error("Swap failed: "+(rc?JSON.stringify(rc):"unknown")); }); }'
  + '  function signClassic(tb,label){ onStatus("Waiting for signature ("+label+")\\u2026");'
  + '   var go=function(){ return Promise.resolve(f.signTransaction(tb.toXDR(),{networkPassphrase:CC.passphrase,network:"PUBLIC",address:pk})); };'
  + '   return (window.lxCctpGateSign?window.lxCctpGateSign(label,go):go()).then(function(sig){'
  + '    var xdr=(sig&&(sig.signedTxXdr||sig.signedXDR))||sig;'
  + '    if((sig&&sig.error)||typeof xdr!=="string") throw new Error("Signing cancelled.");'
  + '    onStatus("Submitting "+label+"\\u2026"); return submitClassic(xdr); }); }'
  + '  return Promise.resolve(f.requestAccess?f.requestAccess():null).then(function(){'
  + '   return f.getAddress?f.getAddress():(f.getPublicKey?f.getPublicKey():null); }).then(function(a){'
  + '   pk=(a&&a.address)||a; if(!pk) throw new Error("Could not read your wallet address.");'
  + '   var feeAmt=+(srcAmt*feeRate).toFixed(7);'
  + '   if(isT0){'
  + '    var netT0=+(srcAmt-feeAmt).toFixed(7);'
  + '    deferredFee=function(){ if(CC.feeCollector===pk) return Promise.resolve();'
  + '     var owed=+(feeAmt+((window.lxFeeOwed&&window.lxFeeOwed(pk))||0)).toFixed(7);'
  + '     if(!(owed>0)) return Promise.resolve();'
  // THE COLLECTOR MAY NOT HOLD USDT0. It had no USDT0 trustline on 2026-09-19, so the first real fee payment (RAZA's
  // first LayerZero send, 0.00012 USDT0) failed with op_no_trust -- and would have failed on every USDT0-sourced bridge.
  // Checked per payment: with a trustline, pay USDT0; without one, send USDT0 and deliver XLM in one path payment,
  // bounded to 97% of a live quote. Once the collector adds the trustline this switches back by itself.
  + '     return Promise.all([acc(), fetch(CC.horizon+"/accounts/"+CC.feeCollector).then(function(r){ return r.json(); }).catch(function(){ return null; })]).then(function(pp){'
  + '      var ad=pp[0], col=pp[1];'
  + '      var colT0=!!(col&&(col.balances||[]).some(function(b){ return b.asset_code==="USDT0"&&b.asset_issuer===C.issuer; }));'
  + '      var opP=colT0 ? Promise.resolve(S.Operation.payment({destination:CC.feeCollector,asset:new S.Asset("USDT0",C.issuer),amount:owed.toFixed(7)}))'
  + '       : window.lxStrictPath(CC,T0,owed.toFixed(7),{native:true}).then(function(pf){'
  + '          return S.Operation.pathPaymentStrictSend({sendAsset:new S.Asset("USDT0",C.issuer),sendAmount:owed.toFixed(7),'
  + '           destination:CC.feeCollector,destAsset:S.Asset.native(),destMin:(Math.max(pf.out*0.97,0.0000001)).toFixed(7),path:window.lxToAssets(S,pf.path)}); });'
  + '      return opP.then(function(feeOp){'
  + '      var tb=new S.TransactionBuilder(new S.Account(pk,ad.sequence),{fee:"1000",networkPassphrase:CC.passphrase})'
  + '       .addOperation(feeOp)'
  + '       .addMemo(S.Memo.text("lx:lz")).setTimeout(300).build();'
  + '      return signClassic(tb,"fee").then(function(r){ if(window.lxFeeOwedSet) window.lxFeeOwedSet(pk,0); return r; }); }); }); };'   // closes signClassic, opP.then, Promise.all.then, deferredFee
  + '    return t0Bal().then(function(sp){'
  + '     if(sp+1e-7<netT0) throw new Error("Only "+sp.toFixed(7)+" USDT0 is spendable \\u2014 the rest is committed to an open sell offer.");'
  + '     return netT0; });'
  + '   }'
  // A different source asset: swap it into USDT0 first, taking the platform fee out of the same transaction.
  + '   var swapAmt=+(srcAmt*(1-feeRate)).toFixed(7);'
  + '   onStatus("Finding a "+(sourceSpec.code||"XLM")+"\\u2192USDT0 route\\u2026");'
  + '   return window.lxStrictPath(CC,sourceSpec,swapAmt.toFixed(7),T0).then(function(pSwap){'
  + '    var feePathP=(sourceSpec.native||CC.feeCollector===pk)?Promise.resolve(null)'
  + '     :window.lxStrictPath(CC,sourceSpec,feeAmt.toFixed(7),{native:true});'
  + '    return feePathP.then(function(pFee){ return t0Bal().then(function(before){ return acc().then(function(ad){'
  + '     var src=window.lxAssetOf(S,sourceSpec);'
  + '     var tb=new S.TransactionBuilder(new S.Account(pk,ad.sequence),{fee:"3000",networkPassphrase:CC.passphrase});'
  // Without a USDT0 trustline the path payment cannot deliver, so open it in the SAME transaction.
  + '     var hasT0=(ad.balances||[]).some(function(b){ return b.asset_code==="USDT0"&&b.asset_issuer===C.issuer; });'
  + '     if(!hasT0) tb.addOperation(S.Operation.changeTrust({asset:new S.Asset("USDT0",C.issuer)}));'
  + '     tb.addOperation(S.Operation.pathPaymentStrictSend({sendAsset:src,sendAmount:swapAmt.toFixed(7),'
  + '      destination:pk,destAsset:new S.Asset("USDT0",C.issuer),destMin:(pSwap.out*0.97).toFixed(7),'
  + '      path:window.lxToAssets(S,pSwap.path)}));'
  + '     if(CC.feeCollector!==pk&&feeAmt>0){'
  + '      tb.addOperation(sourceSpec.native'
  + '       ?S.Operation.payment({destination:CC.feeCollector,asset:S.Asset.native(),amount:feeAmt.toFixed(7)})'
  + '       :S.Operation.pathPaymentStrictSend({sendAsset:src,sendAmount:feeAmt.toFixed(7),destination:CC.feeCollector,'
  + '         destAsset:S.Asset.native(),destMin:(pFee.out*0.97).toFixed(7),path:window.lxToAssets(S,pFee.path)}));'
  + '     }'
  + '     onStatus("Swapping "+(sourceSpec.code||"XLM")+"\\u2192USDT0\\u2026");'
  + '     return signClassic(tb.addMemo(S.Memo.text("lx:lz")).setTimeout(300).build(),"swap").then(function(res){'
  // What ACTUALLY arrived, not what the quote predicted: the send must carry a real number or it fails on balance.
  // Read from the swap's own result first -- the balance alone read stale on production (2026-09-22) and called a
  // completed swap a failure. window.lxSwapGot (in _cctp.js) is shared by all three routes.
  + '      if(window.lxSwapGot) return window.lxSwapGot(S,res,pk,t0Bal,before);'
  + '      return t0Bal().then(function(after){ var got=+(after-before).toFixed(7);'
  + '       if(!(got>0)) throw new Error("The swap did not deliver any USDT0.");'
  + '       return got; }); });'
  + '    }); }); }); });'
  + '  }).then(function(netT0){'
  + '   return lxLzSend(dest,netT0,recipient,onStatus).catch(function(e){ if(!isT0){ try{ e.__lxSwapped=true; }catch(_){ } } throw e; }).then(function(res){'
  + '    res.sourceAmount=srcAmt; res.sourceKey=(isT0?"USDT0":(sourceSpec.code||"XLM")); res.net=netT0;'
  // Record it the same way CCTP does, so it appears in Recent transactions and survives a closed tab. A failure
  // to record must never look like a failure to transfer -- the money has already moved by this point.
  + '    try{ if(window.lxBrAddRecentTx) window.lxBrAddRecentTx({ src:pk, recipient:recipient, srcAmount:srcAmt,'
  + '     srcKey:res.sourceKey, amount:netT0, net:dest, hash:res.hash, ts:Date.now(), bridge:"LayerZero" }); }catch(_){ }'
  + '    try{ if(window.lxBrSaveTx) window.lxBrSaveTx({ src:pk, recipient:recipient, srcAmount:srcAmt,'
  + '     srcKey:res.sourceKey, amount:netT0, net:dest, hash:res.hash, ts:Date.now(), bridge:"LayerZero" }); }catch(_){ }'
  + '    if(deferredFee){ return deferredFee().then(function(){ return res; })'
  + '     .catch(function(){ try{ if(window.lxFeeOwedAdd) window.lxFeeOwedAdd(pk,+(srcAmt*feeRate).toFixed(7)); }catch(_){ } return res; }); }'
  + '    return res; }); }); }); }); }'

  // ---- the panel itself -------------------------------------------------------------------------------------
  // The destination lives in step 1's trigger text, which is how the CCTP layer reads it too. That function is
  // inside its IIFE and not on window, so the one-line selector is repeated here rather than depended on.
  + 'function lzDest(){ var t=document.querySelector(\'.br-step[data-step="1"] .brd-trigger .nm\'); return t?(t.textContent||"").trim():""; }'
  // THE INPUT FIRST, then the figure. A selector LIST returns the first match in DOCUMENT order, and the .v div wraps
  // the input -- so the list form always returned the div, whose text is empty, and every quote (and the USDT0
  // liquidity guard) ran on an amount of 0 whatever was typed. Found 2026-09-19 when "You will receive" stayed at 0.
  + 'function lzAmt(){ var el=document.querySelector(\'.br-step[data-step="2"] .br-io > .br-side:first-child .br-amt input\')||document.querySelector(\'.br-step[data-step="2"] .br-amt .v\');'
  + ' var v=el?(el.value!=null?el.value:el.textContent):""; return parseFloat(String(v||"").replace(/[^0-9.]/g,""))||0; }'
  + 'function lzRecip(){ var el=document.querySelector(\'.br-step[data-step="2"] .br-addr-in\'); return el?(el.value||"").trim():""; }'
  + 'function lzXlmUsd(){ try{ var v=parseFloat(localStorage.getItem("lumos.xlmUsd")||""); return isFinite(v)&&v>0?v:0; }catch(_){ return 0; } }'
  + 'function lzMoney(n){ return (n>=1?n.toFixed(2):n.toFixed(4)); }'

  // SELECTING A ROUTE MUST NOT BE ABLE TO MISROUTE MONEY. The send engine only implements CCTP today, so LayerZero
  // is rendered with its real cost and time -- which is the point of the panel -- but cannot be chosen until the
  // engine exists. When it lands, the disabled flag and the badge come off together and nothing else changes.
  // ONE SWITCH for the whole feature: the route card's selectability, the eight LayerZero-only destinations and
  // (once written) the copy all hang off this. Flip it only after a real transfer has round-tripped a signature.
  + 'var LZ_SENDABLE=' + (LZ_LIVE ? 'true' : 'false') + ';'
  // read by the Review gate and Confirm in _cctp.js: LayerZero may be sent only when this build has it switched on
  + 'window.__lxLzSendable=LZ_SENDABLE;'
  + 'try{ if(LZ_SENDABLE) document.documentElement.classList.add("lx-lz-on"); }catch(_){ }'
  // EACH ROUTE GETS AN IDENTITY (RAZA 2026-09-18: "make the CCTP and LayerZero more prominent and attractive.
  // this looks so dull"). They were two rows of grey text distinguishable only by the word at the top left, on a
  // screen where the user is being asked to CHOOSE between them -- the one decision on this step, presented as the
  // least interesting thing on it.
  //
  // So each route now carries a brand mark, a one-line description of what it actually is, and a tag naming the
  // reason you would pick it. The tags are the measured facts, not marketing: CCTP is Fastest because Stellar needs
  // one confirmation (~5s), and LayerZero is "No claim" because its executor delivers and the messaging fee has
  // already paid for it. Between them that is the whole trade-off, said in two words each.
  //
  // Marks are inline SVG rather than fetched images: two more network requests on a page that already makes
  // several, for 24px of art, and a 404 would leave a hole exactly where the eye is meant to land.
  + 'var LZ_MARK={'
  // Circle's own mark (RAZA 2026-09-19: "For CCTP you gotta use this logo"), taken from build.avax.network and
  // SELF-HOSTED rather than hotlinked -- a hotlink makes every visitor's browser call a third party and loses the
  // logo whenever that host moves it. The source is 1509x1498 / 150 KB for a 30px icon, so it was resized to
  // 96x96 (3x, sharp on retina) at 8.7 KB. It lives in assets/tokens/, the one asset folder tracked in git, so a
  // rebuild from a fresh clone cannot quietly drop it.
  // Eager, not lazy: this sits above the fold on every render, so lazy only buys a blank circle where the mark
  // should be for the first frame -- the flash the capture showed. At 8.7 KB there is nothing to save.
  + 'CCTP:\'<img src="/assets/tokens/circle.png" alt="" width="30" height="30" decoding="async">\','
  // LayerZero's real mark (RAZA 2026-09-19: "Even LayerZero logo is incorrect"). The inline "Z" was a guess at a
  // logo that is not a Z at all. This is the protocol's own icon from DefiLlama's set, checked by eye, 96x96, self-hosted.
  + 'LayerZero:\'<img src="/assets/tokens/layerzero.png" alt="" width="30" height="30" decoding="async">\','
  // NEAR Intents: the NEAR mark, self-hosted like the others (assets/tokens/ni, fetched by _nilogos.js)
  + '"NEAR Intents":\'<img src="/assets/tokens/ni/NEAR.png" alt="" width="30" height="30" decoding="async">\'};'
  + 'var LZ_SUB={CCTP:"Circle\\u2019s own burn-and-mint",LayerZero:"Tether\\u2019s omnichain dollar","NEAR Intents":"ETH, POL or another major token, delivered"};'
  // "No claim" read as "you have no claim to it" -- RAZA: "what do you mean by no claim?". What it meant is that the
  // transfer arrives by itself, so the tag now says that.
  + 'var LZ_TAG={CCTP:"Fastest",LayerZero:"Auto-delivered","NEAR Intents":"Multi-asset"};'
  // A route this build has not switched on: shown with its real figures, but not selectable ("Not yet available").
  + 'function lzLocked(r){ return (r.route==="LayerZero"&&!LZ_SENDABLE)||(r.route==="NEAR Intents"&&!window.__lxNiSendable); }'

  + 'function lzCard(r,sel){'
  + ' var u=lzXlmUsd();'
  // THE FEE IS NEVER "FREE" (RAZA 2026-09-19: "Saying that the bridge fee is 0% might be confusing because we do
  // charge 0.2% fees or 0.1%"). "Free" described only Circle's side of CCTP and hid LumosCore's own cut, which every
  // bridge pays. The row now states the platform rate first -- read live from __lxFeeRate so the 250K-LUMOS tier
  // shows 0.1% -- and adds LayerZero's XLM messaging fee on top where there is one.
  + ' var rate=(window.__lxFeeRate||((window.__lxCCTP||{}).feeRate)||0.002);'
  + ' var pct=+(rate*100).toFixed(2)+"%";'
  + ' var cost = r.networkFeeXlm>0'
  + '  ? (pct+" + "+lzMoney(r.networkFeeXlm)+" XLM")'
  + '  : pct;'
  + ' var dis=lzLocked(r)||r.available===false;'
  + ' var h=\'<button type="button" class="lx-brr" data-route="\'+r.route+\'"\'+(dis?" disabled":"")+\' aria-pressed="\'+(sel?"true":"false")+\'">\';'
  + ' h+=\'<div class="lx-brr-top">\';'
  + ' h+=\'<span class="lx-brr-mark">\'+(LZ_MARK[r.route]||"")+\'</span>\';'
  + ' h+=\'<span class="lx-brr-hd"><span class="lx-brr-nm">\'+r.route+\'</span>\';'
  + ' h+=\'<span class="lx-brr-sub">\'+(LZ_SUB[r.route]||"")+\'</span></span>\';'
  + ' if(r.available!==false&&(r.tag||LZ_TAG[r.route])) h+=\'<span class="lx-brr-tag">\'+(r.tag||LZ_TAG[r.route])+\'</span>\';'
  + ' h+=\'</div>\';'
  // AN UNAVAILABLE ROUTE STATES WHY AND NOTHING ELSE. It used to print "Bridge fee  None" above "Quote unavailable
  // right now", which is a figure next to an admission that there is no figure -- and "None" reads as free, the
  // opposite of the truth. A route that cannot be priced shows its reason in place of the numbers.
  + ' if(r.available===false){'
  + '  h+=\'<div class="lx-brr-note" style="margin-top:0;padding-top:0">\'+(r.error||"Quote unavailable right now.")+\'</div>\';'
  + '  return h+"<"+"/button>";'
  + ' }'
  // RAZA's reference design splits the route into two things: a card that says what the route IS (and is what you
  // click), and one set of figures underneath for whichever route is chosen. So the card stops at identity, and the
  // numbers moved to lzStats below -- one list, always describing the selected route, instead of two lists side by
  // side that the eye had to compare row by row.
  + ' if(lzLocked(r)&&r.available!==false) h+=\'<span class="lx-brr-soon">Not yet available</span>\';'
  + ' return h+"<"+"/button>"; }'

  // The figures for the chosen route, each with an icon, as in the mock. The fee is the REAL rate: the mock says
  // "Free", but LumosCore takes 0.2% (0.1% for 250K+ LUMOS holders) on every bridge, and RAZA asked for that to be
  // stated rather than hidden behind Circle's zero.
  + 'var LZ_SICON={'
  + 'recv:\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>\','
  + 'fee:\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>\','
  + 'time:\'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>\'};'
  + 'var LZ_SWAPIC=\'<svg viewBox="0 0 24 24"><path style="fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round" d="M4 7h13l-3-3M20 17H7l3 3"/></svg>\';'
  + 'function lzStats(r){'
  + ' if(!r) return "";'
  + ' var rate=(window.__lxFeeRate||((window.__lxCCTP||{}).feeRate)||0.002);'
  + ' var pct=+(rate*100).toFixed(2)+"%";'
  + ' var fee=r.networkFeeXlm>0?(pct+" + "+lzMoney(r.networkFeeXlm)+" XLM"):pct;'
  // NEAR Intents keeps its own cut (0.25% keyless, 0.20% with a key, 0.01% on stablecoin pairs): state it beside ours
  + ' if(r.niFeeBps!=null) fee=pct+" + "+(+(r.niFeeBps/100).toFixed(2))+"% NEAR";'
  + ' function row(ic,k,v){ return \'<div class="lx-brs-row"><span class="lx-brs-ic">\'+LZ_SICON[ic]+\'</span><span class="lx-brs-k">\'+k+\'</span><span class="lx-brs-v">\'+v+\'</span></div>\'; }'
  + ' var h=row("recv","Receive",r.asset)+row("fee","Bridge fee",fee)+row("time","Estimated time",(r.etaText||"").replace(/,.*$/,""));'
  // The "Swap price impact" row is gone (RAZA 2026-09-19: remove it). The GUARD it came with is not: a swap that would
  // lose more than LZ_IMPACT_BLOCK is still refused in lzPathOut, with the loss stated on the route card. What the
  // swap costs below that is already inside "You will receive", which is quoted from the live path.
  + ' if(r.claimNote) h+=\'<div class="lx-brs-note">\'+r.claimNote+\'</div>\';'
  + ' return h; }'
  + 'var _lzRows=[];'
  + 'function lzPaintStats(){'
  + ' var host=document.querySelector("[data-lxroute-stats]"); if(!host)return;'
  + ' var r=_lzRows.filter(function(x){ return x.route===window.__lxBrRoute; })[0];'
  + ' host.innerHTML=lzStats(r); host.hidden=!r;'
  // The destination side of step 2 shows the asset that ARRIVES, and that depends on the route: CCTP delivers USDC,
  // LayerZero delivers USDT0. It used to say USDC whatever was chosen. Published on the root element so the step-2
  // layer can follow it with CSS and one observer, without either layer reaching into the other.
  + ' var de=document.documentElement;'
  + ' window.__lxBrRouteGate={rendered:_lzRows.length>0, route:(r?r.route:null),'
  + '  cctp:_lzRows.some(function(x){ return x.route==="CCTP"&&x.available!==false; }),'
  + '  why:(!r&&_lzRows.length)?(_lzRows.map(function(x){ return x.error; }).filter(Boolean)[0]||""):"",'
  + '  blocked:(r&&r.available===false)?(r.error||(r.route+" can\\u2019t send this amount right now \\u2014 choose another route.")):""};'
  + ' try{ if(window.lxBrValidateStep2) window.lxBrValidateStep2(); }catch(_){ }'
  // route / logo / name too: NEAR Intents delivers whichever token was picked, so the face on the To side comes from the row
  + ' if(r){ de.setAttribute("data-lxroute-asset",r.asset); de.setAttribute("data-lxroute-recv",r.recv==null?"":String(r.recv));'
  + '  de.setAttribute("data-lxroute",r.route); if(r.assetLogo) de.setAttribute("data-lxroute-logo",r.assetLogo); else de.removeAttribute("data-lxroute-logo");'
  + '  if(r.assetName) de.setAttribute("data-lxroute-name",r.assetName); else de.removeAttribute("data-lxroute-name"); }'
  + ' else { ["data-lxroute-asset","data-lxroute-recv","data-lxroute","data-lxroute-logo","data-lxroute-name"].forEach(function(a){ de.removeAttribute(a); }); } }'

  // ---- which route is chosen --------------------------------------------------------------------------------
  // RAZA 2026-09-19: "it keeps auto selects LayerZero as the recommended bridge. Make sure that the recommended bridge
  // is where the user saves money or time." The old rule kept whatever was chosen last, so arriving from a
  // LayerZero-only chain (Ink) at one with both (Arbitrum) stayed on LayerZero.
  // Now: a route the user CLICKED is remembered for that destination only. Otherwise the route that leaves the most
  // value after every fee we can price (what arrives, minus the XLM messaging fee in dollars); within 0.1% of each
  // other the tie goes to CCTP, which is also ~5 seconds against ~30 minutes -- it saves time when it cannot save
  // money. (CCTP's claim gas on the destination is not priced here, so it is never counted in CCTP's favour.)
  + 'window.__lxBrRouteFor=window.__lxBrRouteFor||{};'
  + 'function lzOk(r){ return r&&r.available!==false&&!lzLocked(r); }'
  + 'function lzChoose(dest,rows){'
  + ' var mine=window.__lxBrRouteFor[dest];'
  // A route the user CLICKED stays chosen even while it cannot send (RAZA 2026-09-19: picked NEAR Intents, typed an
  // amount, and it "automatically changes to CCTP" -- Polygon USDT had a $1,000 minimum). Silently swapping it for
  // another route changed what would arrive; now it stays, its card says why, and the route gate blocks Review with
  // that reason (lzPaintStats: blocked).
  + ' var m=rows.filter(function(r){ return r.route===mine&&!lzLocked(r); })[0]; if(m) return m;'
  // NEAR Intents is never picked automatically: it delivers a DIFFERENT token (ETH, POL...), so it is only chosen by
  // the user. The stablecoin routes compete on value as before.
  + ' var c=rows.filter(lzOk).filter(function(r){ return r.route!=="NEAR Intents"; }); if(!c.length) return null;'
  + ' var u=lzXlmUsd(); function net(r){ return (+r.recv||0)-(+r.networkFeeXlm||0)*u; }'
  + ' var best=c.filter(function(r){ return r.route==="CCTP"; })[0]||c[0];'
  + ' if(best.route==="CCTP"&&best.recv==null) return best;'   // CCTP not priced yet: nothing can show LayerZero is better
  + ' c.forEach(function(r){ if(r!==best&&net(r)>net(best)*1.001&&net(r)>0) best=r; });'
  + ' return best; }'

  // ---- drawing the panel for a destination BEFORE its quotes arrive ----------------------------------------
  // THE FLASH (RAZA 2026-09-19): switching destination left the previous destination's routes, figures and arriving
  // asset on screen until the new quotes returned -- USDC where USDT0 was coming, LayerZero on a CCTP-only chain.
  // What a destination SUPPORTS is known synchronously from lxBrRoutes(), and what the swap into each transport
  // yields depends on the source and amount, not the destination -- so the last quote for the same source+amount is
  // reused. The panel is redrawn from that the moment the destination is picked, before anything is painted; the live
  // quote then only refines the numbers.
  + 'var _lzLast={};'                              // route|src|amount -> {recv, impact}; networkFeeXlm per route|dest
  + 'function lzKey(route){ return route+"|"+((window.__lxBr||{}).srcKey||"USDC")+"|"+lzAmt(); }'
  + 'function lzSkeleton(dest){'
  + ' var rt=lxBrRoutes().filter(function(r){ return r.name===dest; })[0]; if(!rt) return [];'
  + ' var rows=[];'
  + ' function prev(route){ return _lzLast[lzKey(route)]||{}; }'
  // Unknown stays UNKNOWN (null), never 0: a 0 made CCTP look worthless and LayerZero won the pick for a frame (Ink ->
  // Arbitrum). USDC in, USDC out needs no quote at all -- amount less our fee is exact.
  + ' var src=((window.__lxBr||{}).srcKey||"USDC"), amt=lzAmt(), rate=(window.__lxFeeRate||((window.__lxCCTP||{}).feeRate)||0.002);'
  + ' function known(v){ return v!=null?v:null; }'
  + ' if(rt.cctp){ var a=prev("CCTP"); rows.push({ route:"CCTP", asset:"USDC", available:true, recv:(src==="USDC"&&amt>0)?+(amt*(1-rate)).toFixed(6):known(a.recv), impact:a.impact, networkFeeXlm:0,'
  + '  etaSeconds:5, etaText:"~5 seconds to claimable", needsClaim:true, claimNote:"You send the claim on "+dest+" and pay its gas." }); }'
  + ' if(rt.lz){ var b=prev("LayerZero"); rows.push({ route:"LayerZero", asset:"USDT0", available:true, recv:(src==="USDT0"&&amt>0)?+(amt*(1-rate)).toFixed(6):known(b.recv), impact:b.impact,'
  + '  networkFeeXlm:(_lzLast["fee|"+dest]||0), etaSeconds:lzEta(), etaText:lzHuman(lzEta())+", delivered automatically", needsClaim:false,'
  + '  claimNote:"Delivered to your address automatically \\u2014 the XLM messaging fee pays for delivery." }); }'
  + ' try{ var ni=window.lxNiSkeleton&&window.lxNiSkeleton(dest); if(ni) rows.push(ni); }catch(_){ }'   // same no-flash rule
  + ' return rows; }'
  + 'function lzDraw(dest,rows){'
  + ' var panel=document.querySelector("[data-lxroute]"); if(!panel) return; var host=panel.querySelector("[data-lxroute-opts]"); if(!host) return;'
  + ' if(!rows.length){ panel.hidden=true; _lzRows=[]; lzPaintStats(); return; }'
  + ' var pick=lzChoose(dest,rows); window.__lxBrRoute=pick?pick.route:null;'
  // rebuilt only when something in them changed: every rebuild throws away the node a finger may be on
  + ' var _h=rows.map(function(r){ return lzCard(r, pick&&r.route===pick.route); }).join("");'
  + ' if(host.__lzh!==_h){ host.innerHTML=_h; host.__lzh=_h; }'
  + ' _lzRows=rows; lzPaintStats(); panel.hidden=false; }'
  + 'function lzProvisional(dest){ try{ if(dest) lzDraw(dest, lzSkeleton(dest)); }catch(_){ } }'

  // A quote lost to the network is asked again: 4s, 8s, 16s, then left alone until the next change of destination or
  // amount (which re-quotes anyway). Reset on every successful LayerZero quote.
  + 'var _lzRetries=0, _lzRetryT=null;'
  + 'function lzRetry(){ if(_lzRetryT||_lzRetries>=3) return; var d=4000*Math.pow(2,_lzRetries++);'
  + ' _lzRetryT=setTimeout(function(){ _lzRetryT=null; try{ lxBrRouteRender(); }catch(_){ } },d); }'

  + 'var _lzTok=0;'
  + 'function lxBrRouteRender(){'
  + ' var panel=document.querySelector("[data-lxroute]"); if(!panel)return Promise.resolve();'
  + ' var host=panel.querySelector("[data-lxroute-opts]"); var dest=lzDest();'
  + ' if(!dest||!host){ panel.hidden=true; return Promise.resolve(); }'
  + ' var tok=++_lzTok;'
  // THE USER'S AMOUNT, NOT A PLACEHOLDER. This used to quote with 100 whenever the field was empty, and 100 USDC
  // happens to be almost exactly where the young USDT0 book on Stellar runs out -- measured 2026-09-19: 50 USDC gets
  // 48.48 USDT0, 100 USDC gets only 50.85. So the liquidity guard fired on a number nobody typed, and LayerZero
  // showed as unavailable on page load. With 0 it is priced at 1 unit (lxLzQuote and lzPathOut both floor there),
  // which is enough to state the fee and the time, and the depth check waits for a real amount.
  + ' return lxBrCompare(dest, lzAmt(), lzRecip(), ((window.__lxBr||{}).srcKey||"USDC")).then(function(rows){'
  + '  if(tok!==_lzTok)return;'                     // a later destination/amount already asked
  // remember what this source+amount yields per route, and each destination's messaging fee, for lzSkeleton
  + '  rows.forEach(function(r){ if(r.available!==false) _lzLast[lzKey(r.route)]={recv:r.recv, impact:r.impact};'
  + '   if(r.route==="LayerZero"&&r.networkFeeXlm>0){ _lzLast["fee|"+dest]=r.networkFeeXlm; _lzRetries=0; } });'
  // lzChoose keeps a route only while it is AVAILABLE -- a route the liquidity guard just closed must not stay chosen
  // (RAZA's screenshot, 100,000 SHX to Ethereum).
  + '  lzDraw(dest, rows);'
  + ' }).catch(function(){ if(tok===_lzTok) panel.hidden=true; }); }'

  + 'function lzWire(){'
  + ' var panel=document.querySelector("[data-lxroute]"); if(!panel||panel.__lzw)return; panel.__lzw=1;'
  // ONE TAP SELECTS (RAZA 2026-09-19: "it doesn't tap smoothly. I have to tap 3-4 times until it's selected"). A click
  // is decided at finger-UP, against whatever is under the finger THEN -- and two things move it between down and up:
  // the phone keyboard closing (a tap outside a focused field dismisses it, and the page reflows under the finger), and
  // a quote landing, which rebuilds these cards so the tapped node is gone before its click. So the route is read at
  // finger-DOWN and applied at finger-up, whatever moved in between; a finger that travelled is a scroll, not a tap.
  + ' var pd=null, lastSel=0;'
  + ' function sel(route){ var hit=null;'
  + '  [].slice.call(panel.querySelectorAll(".lx-brr[data-route]")).forEach(function(x){ if(x.getAttribute("data-route")===route) hit=x; });'
  + '  if(!hit||hit.disabled) return;'
  + '  window.__lxBrRoute=route; lastSel=Date.now();'
  + '  var dn=lzDest(); if(dn) window.__lxBrRouteFor[dn]=route;'   // the user's own choice, for this destination only
  + '  [].slice.call(panel.querySelectorAll(".lx-brr")).forEach(function(x){ x.setAttribute("aria-pressed", x===hit?"true":"false"); });'
  + '  lzPaintStats(); }'
  + ' document.addEventListener("pointerdown",function(e){ var b=e.target&&e.target.closest&&e.target.closest(".lx-brr[data-route]");'
  + '  pd=(b&&panel.contains(b))?{r:b.getAttribute("data-route"),x:e.clientX,y:e.clientY,t:Date.now()}:null; },true);'
  + ' document.addEventListener("pointerup",function(e){ if(!pd) return; var p=pd; pd=null;'
  + '  if(Math.abs(e.clientX-p.x)>12||Math.abs(e.clientY-p.y)>12||Date.now()-p.t>1200) return;'
  + '  sel(p.r); },true);'
  + ' document.addEventListener("pointercancel",function(){ pd=null; },true);'
  // the click that follows is the same tap: swallowed. A keyboard "click" (Enter/Space) has no pointer before it.
  + ' panel.addEventListener("click",function(e){'
  + '  var b=e.target&&e.target.closest&&e.target.closest(".lx-brr[data-route]"); if(!b)return;'
  + '  e.preventDefault(); e.stopPropagation();'
  + '  if(Date.now()-lastSel<700) return;'
  + '  sel(b.getAttribute("data-route"));'
  + ' });'
  // Re-quote when the thing being quoted changes. The destination is chosen in step 1, so a step change is the
  // moment the answer can differ; the amount moves the platform fee but not the messaging fee, and is debounced.
  + ' var t=null;'
  + ' function bump(){ clearTimeout(t); t=setTimeout(function(){ try{ lxBrRouteRender(); }catch(_){ } },260); }'
  + ' document.addEventListener("click",function(e){'
  + '  var x=e.target; if(!x||!x.closest)return;'
  // Picking a destination redraws the panel for it at once, from what it supports -- in this capture listener,
  // before the step can be shown -- so the previous destination's routes and asset are never painted for it.
  + '  var op=x.closest(".brd-opt[data-net]"); if(op) lzProvisional(op.getAttribute("data-net"));'
  + '  else if(x.closest(".br-step[data-step=\\"1\\"] .br-next")) lzProvisional(lzDest());'
  // Also re-quote when the SOURCE ASSET changes (the From menu) or MAX fills the amount: neither types, and a new
  // source is a new swap into USDT0. RAZA 2026-09-19: AQUA -> Sei sat at "~ 0.00 USDT0" with 636 AQUA entered.
  + '  if(x.closest(".brd-opt")||x.closest(".br-next")||x.closest(".br-back")||x.closest("#lx-br-amenu button")||x.closest(".bal .max")) bump();'
  + ' },true);'
  // DELEGATED, not bound to the field: the amount input is rebuilt when the source asset changes, and a listener
  // on the old node went with it -- so after picking AQUA, typing never re-quoted LayerZero at all.
  + ' document.addEventListener("input",function(e){ var t=e.target; if(t&&t.closest&&t.closest(\'.br-step[data-step="2"] .br-amt\')) bump(); },true);'
  + ' bump(); }'
  + 'if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",lzWire); else lzWire();'

  + 'try{ window.lxLzQuote=lxLzQuote; window.lxLzQuoteOft=lxLzQuoteOft; window.lxLzPaused=lxLzPaused; window.lxBrRoutes=lxBrRoutes; window.lxBrCompare=lxBrCompare; window.lxBrRouteRender=lxBrRouteRender; window.lxLzSend=lxLzSend; window.lxLzBridgeFull=lxLzBridgeFull; }catch(_){ }'
  + '})();';

// THE INJECTED CODE IS A STRING, so `node --check` on this file says nothing about it. A single unbalanced paren
// emits a file the browser refuses to parse, which takes the WHOLE layer down silently -- every lx* function simply
// never exists, and the page looks fine until something calls one. That happened once here (four closers where five
// were needed), so the parse now runs at build time. new Function parses without executing.
try { new Function(BODY); }
catch (e) {
  console.error('  ! injected browser code does not parse: ' + e.message);
  console.error('    nothing was written — fix _lzusdt0.js before rebuilding');
  process.exit(1);
}

const SCRIPT = '<script id="' + ID + '">' + BODY + '<' + '/script>';

let n = 0, mk = 0, seen = 0, dd = 0;
// The Stellar site is built from the aptos container. The other containers are showcase sites for other chains and
// have no USDT0 route, so they are deliberately left alone.
for (const dev of ['desktop', 'mobile']) {
  const file = 'lumoscore-aptos-' + dev + '.html';
  let data;
  try { data = read(file); } catch (e) { console.error('  ' + file + ': missing — skipped'); continue; }
  const { json, s, e } = getContents(data);
  for (const k of Object.keys(json)) {
    if (!/bridge/.test(k)) continue;
    let h = json[k];
    const before = h;
    // Idempotent on all three injections, or a rebuild stacks copies. The <style> needs its own strip: stripping
    // only the <script> is how duplicate stylesheets pile up in this repo and how stale rules end up winning on
    // source order.
    h = h.replace(new RegExp('<script id="' + ID + '">[' + B + 's' + B + 'S]*?<' + B + '/script>', 'g'), '');
    h = h.replace(new RegExp('<style id="lx-lzpick-css">[' + B + 's' + B + 'S]*?<' + B + '/style>', 'g'), '');
    h = h.replace(new RegExp('<div class="br-side lx-brroute"[' + B + 's' + B + 'S]*?<' + B + '/div><' + B + '/div>', 'g'), '');

    if (h.indexOf('</head>') >= 0) h = h.replace('</head>', CSS + '</head>');

    // The panel belongs after the assets/destination block and before the error slot, which is the order the step
    // already reads in: what you are sending, then how it travels, then what is wrong, then the buttons.
    // The panel is wrapped WITH .br-io so the two can sit side by side. Both the opening and closing tags are
    // stripped above, so a rebuild re-wraps rather than nesting a second wrapper each time.
    h = h.split('<div class="lx-brwrap">').join('').split('<!--/lx-brwrap--></div>').join('');
    const s2 = h.indexOf('<div class="br-step" data-step="2"');
    if (s2 >= 0) {
      const ioAt = h.indexOf('<div class="br-io">', s2);
      const slot = h.indexOf('<div class="br-errslot"', s2);
      if (ioAt > s2 && slot > ioAt) {
        // Insert the closing tag first: inserting the opening one first would shift every index after it.
        h = h.slice(0, slot) + MARKUP + '<!--/lx-brwrap--></div>' + h.slice(slot);
        h = h.slice(0, ioAt) + '<div class="lx-brwrap">' + h.slice(ioAt);
        mk++;
      } else if (slot > s2) {
        h = h.slice(0, slot) + MARKUP + h.slice(slot);
        mk++;
      }
    }

    // The LayerZero-only destinations go after the design's last option, so the existing order is untouched.
    // Anchored on World Chain's closing tag rather than a position, so a reordered design does not misplace them.
    // Stripped and re-added rather than guarded on presence: editing LZ_ONLY must not leave yesterday's options
    // behind, which a "skip if already there" check would do silently.
    h = h.replace(new RegExp('<button class="brd-opt lx-lzopt"[' + B + 's' + B + 'S]*?<' + B + '/button>', 'g'), '');
    const anchor = '<span class="brd-nm">World Chain</span></button>';
    const ai = h.indexOf(anchor);
    if (ai >= 0) {
      h = h.slice(0, ai + anchor.length) + LZ_OPTS + h.slice(ai + anchor.length);
      dd++;
    }

    const bi = h.lastIndexOf('</body>');
    if (bi < 0) continue;
    // After the CCTP script, which this one reads its RPC, passphrase and destination list from.
    h = h.slice(0, bi) + SCRIPT + h.slice(bi);
    seen++;
    // A second run over an already-wired container produces byte-identical HTML, so "changed" being 0 is the
    // idempotence guarantee, not a failure. Only "no bridge page was found at all" is worth exiting over.
    if (h !== before) { json[k] = h; n++; }
  }
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
}
console.log('LayerZero/USDT0 quote layer: ' + seen + ' bridge page key(s), ' + mk + ' route panel(s), ' + n + ' changed');
// Only "no bridge page at all" is a failure. A rebuild over already-wired containers legitimately changes nothing.
if (!seen) { console.error('  ! no bridge page matched — nothing was wired'); process.exit(1); }
