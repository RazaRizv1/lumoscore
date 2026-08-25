// Swap popups: when a From amount is entered, reveal a details panel (rate, slippage, swap fee, network
// fee, price impact, minimum received) computed from the entered value.
// Two swap popups exist: #swapModal (dashboard quick-action Swap card — the one the user means; already
// computes "You receive", we add the details) and #modalSwap (wallet-page quick-action Swap — class-based).
// Rate is read from each popup's own displayed rate so every chain keeps its native pair. Idempotent.
const fs=require('fs');const{read,getContents}=require(__dirname+'/lib.js');const B=String.fromCharCode(92);

// The review step drew letter avatars instead of logos on the LUMOS token page. ssIco() resolved XLM via
// window.__lxStellarUri and everything else via window.__lxLogos -- both published by _walletdata.js,
// which only runs on the wallet pages. Anywhere else the lookup found nothing and fell through to the
// initial-letter placeholder. Baked as a LAST resort so the icons are right on every page carrying a
// swap; the runtime globals still win where they exist. The Stellar mark is read out of _walletdata.js
// at build time so it stays defined in exactly one place.
const SW_STELLAR_URI = (function(){
  // Build it the way _walletdata does -- from the SVG -- because STELLAR_URI there is a CONCATENATION
  // (data:...base64, + Buffer.from(SVG)). My first attempt regexed the quoted part and captured only
  // the 26-character prefix, so what shipped was a data URI with no payload: a broken image, which is
  // why the review circles stayed blank. Assert the length so a truncated URI can never ship again.
  const w = fs.readFileSync(__dirname + "/_walletdata.js", "utf8");
  const m = /const STELLAR_SVG='([^']+)'/.exec(w);
  if (!m) throw new Error("_swapcalc: STELLAR_SVG not found in _walletdata.js");
  const uri = "data:image/svg+xml;base64," + Buffer.from(m[1]).toString("base64");
  if (uri.length < 400) throw new Error("_swapcalc: STELLAR_URI looks truncated (" + uri.length + " chars)");
  return uri; })();
const SW_LUMOS_LOGO = "/assets/tokens/lumos.png";

const STYLE='<style id="lx-swapcalc-css">'
+'.lx-swapd{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:8px 13px;margin:0 0 13px;font-size:13.5px}'
+'.lx-swapd .r{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:4px 0;color:var(--text-soft)}'
+'.lx-swapd .r strong{color:var(--text);font-weight:600;text-align:right;font-family:\'JetBrains Mono\',monospace;font-size:13px}'
+'.lx-swapd .rtot{border-top:1px solid var(--border);margin-top:4px;padding-top:8px}'
+'.lx-swapd .rtot strong{color:var(--accent,#ea6a2c)}'
+'.lx-swapd .lx-feenote{margin-top:10px;padding-top:11px;border-top:1px dashed var(--border)}'
+'.lx-fee-banner{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.35;text-align:left}'
+'.lx-fee-banner.holder{background:linear-gradient(135deg,rgba(53,192,127,.16),rgba(53,192,127,.05));border:1px solid rgba(53,192,127,.34)}'
+'.lx-fee-banner.nudge{background:linear-gradient(135deg,rgba(234,106,44,.16),rgba(234,106,44,.05));border:1px solid var(--accent-soft,rgba(234,106,44,.34))}'
+'.lx-fee-banner .lx-fee-ic{flex:0 0 auto;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:9px}'
+'.lx-fee-banner.holder .lx-fee-ic{background:rgba(53,192,127,.2);color:var(--green,#35c07f)}'
+'.lx-fee-banner.nudge .lx-fee-ic{background:rgba(234,106,44,.2);color:var(--accent,#ea6a2c)}'
+'.lx-fee-banner .lx-fee-ic svg{width:16px;height:16px}'
+'.lx-fee-banner .txt{flex:1;min-width:0;color:var(--text)}'
+'.lx-fee-banner .txt b{font-weight:700}'
+'.lx-fee-banner.holder .txt b{color:var(--green,#35c07f)}'
+'.lx-fee-banner.nudge .txt b{color:var(--accent,#ea6a2c)}'
+'.lx-fee-buy{color:inherit;text-decoration:none;border-bottom:1px solid currentColor;font-weight:700}'
+'.lx-fee-buy:hover{filter:brightness(1.09)}'
+'#modalSwap .modal{max-height:96vh}'
+'#modalSwap .modal-body{padding-top:8px!important;padding-bottom:8px!important}'
+'#modalSwap .swap-pair{margin-bottom:4px!important}'
+'#modalSwap .swap-pair .field{padding:9px 14px!important}'
+'#modalSwap .field-label{display:flex;align-items:center;gap:8px}'
+'#modalSwap .field-label .meta{margin-left:auto}'
+'.lx-wsmax{flex:0 0 auto;padding:3px 9px;border-radius:7px;cursor:pointer;'
+'font-weight:800;font-size:10.5px;line-height:1.5;letter-spacing:.03em;'
+'color:var(--accent,#ea6a2c);background:var(--accent-soft,rgba(234,106,44,.14));'
+'border:1px solid var(--accent-soft,rgba(234,106,44,.32))}'
+'.lx-wsmax:hover{filter:brightness(1.08)}'
+'#modalSwap .swap-pair .field input{font-size:20px!important;padding-top:2px!important;padding-bottom:2px!important;padding-left:14px!important}'
+'#modalSwap .swap-pair .field-label,#modalSwap .swap-pair .field>label{margin-bottom:2px!important}'
+'#modalSwap .swap-pair .lx-swap-pick{margin-top:4px!important;padding:5px 9px!important}'
+'#modalSwap .swap-pair .lx-ap-ico{width:28px!important;height:28px!important}'
+'#modalSwap .swap-arrow{margin:1px auto!important;width:34px!important;height:34px!important}'
+'#modalSwap .lx-swapd{padding:6px 12px!important;margin:0!important;font-size:12.5px!important}'
+'#modalSwap .lx-swapd .r{padding:2.5px 0!important}'
+'#modalSwap .lx-swapd .r strong{font-size:12.5px!important}'
+'#modalSwap .lx-swapd .rtot{margin-top:2px!important;padding-top:6px!important}'
+'#modalSwap .lx-swapd .lx-feenote{margin-top:6px!important;padding-top:6px!important}'
+'#modalSwap .lx-swapd .r{padding:2px 0!important}'
+'#modalSwap .lx-fee-banner{padding:8px 10px!important;gap:9px!important;font-size:11.6px!important}'
+'#modalSwap .lx-fee-banner .lx-fee-ic{width:24px!important;height:24px!important}'
+'#modalSwap .lx-fee-banner .lx-fee-ic svg{width:14px;height:14px}'
// bigger, more prominent LUMOS promo on the review (step 2)
+'#modalSwap.lx-on-step2 .lx-fee-banner{padding:14px 15px!important;gap:12px!important;font-size:13px!important;line-height:1.42!important;border-radius:13px!important}'
+'#modalSwap.lx-on-step2 .lx-fee-banner .lx-fee-ic{width:36px!important;height:36px!important;border-radius:11px!important}'
+'#modalSwap.lx-on-step2 .lx-fee-banner .lx-fee-ic svg{width:19px;height:19px}'
+'#modalSwap.lx-on-step2 .lx-fee-buy{padding:10px 16px!important;font-size:12.5px!important;border-radius:10px!important}'
+'#modalSwap .lx-fee-buy{padding:7px 11px!important;font-size:11px!important}'
+'#modalSwap .lx-swap-err{margin:0 2px 5px!important}'
+'#modalSwap .modal-foot{padding-top:10px!important;padding-bottom:12px!important}'
+'.lx-swapmax{margin-left:8px;background:var(--accent-soft,rgba(234,106,44,.14));color:var(--accent,#ea6a2c);border:1px solid var(--accent-soft,rgba(234,106,44,.32));border-radius:6px;padding:2px 10px;font-size:11px;font-weight:700;cursor:pointer;line-height:1.35}'
+'.lx-swapmax:hover{filter:brightness(1.08)}'
+'.swap-pair .field .field-label{display:flex;align-items:center}'
+'.swap-pair .field .field-label .meta{margin-left:auto;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'.swap-pair .field .field-amt input{width:100%}'
+'.swap-pair>.field{padding-bottom:2px}'
+'.lx-swap-menu{display:flex!important;flex-direction:column;overflow:visible!important;max-height:360px!important;width:250px!important}'
+'.lx-swap-menu .lx-am-list{flex:1 1 auto;overflow-y:auto;min-height:0;max-height:210px}'+'.lx-am-more{padding:8px 10px;font:600 11px/1.35 "Hanken Grotesk",system-ui,sans-serif;color:var(--text-muted,#8a8fa3);text-align:center;border-top:1px solid var(--border,#ececef)}'
+'.lx-am-search,.lx-am-custin{width:100%;box-sizing:border-box;background:var(--bg,rgba(0,0,0,.2));border:1px solid var(--border,rgba(255,255,255,.16));border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text,#fff);outline:none}'
+'.lx-am-searchwrap{position:relative;margin-bottom:6px}'
+'.lx-am-searchic{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-muted);pointer-events:none}'
+'.lx-am-search{padding-left:34px!important}'
+'.lx-am-search:focus,.lx-am-custin:focus{border-color:var(--accent-soft,rgba(234,106,44,.5))}'
+'.lx-am-iss{color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;font-size:10.5px}'
+'.lx-am-meta{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:1px;line-height:1.25;min-width:0}'
+'.lx-am-meta .lx-am-bal{margin-left:0}'
+'.lx-am-empty{padding:14px;text-align:center;color:var(--text-muted);font-size:12px}'
+'.lx-am-custom{display:flex;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid var(--border,rgba(255,255,255,.14))}'
+'.lx-am-custin{flex:1 1 auto;font-family:\'JetBrains Mono\',monospace;font-size:11px}'
+'.lx-am-custgo{flex:0 0 auto;background:var(--accent,#ea6a2c);color:#fff;border:none;border-radius:8px;padding:0 13px;font-size:12px;font-weight:700;cursor:pointer}'
+'.lx-am-customitem .lx-am-ic{font-size:16px}'
+'.lx-custom-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px}'
+'.lx-cm-box{background:var(--surface,#171922);border:1px solid var(--border);border-radius:16px;padding:20px 20px 18px;width:350px;max-width:100%;box-shadow:0 24px 70px rgba(0,0,0,.55)}'
+'.lx-cm-title{font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px}'
+'.lx-cm-lbl{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);font-weight:700;margin:12px 0 5px}'
+'.lx-cm-code,.lx-cm-iss{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--text);font-family:\'JetBrains Mono\',monospace;outline:none}'
+'.lx-cm-code:focus,.lx-cm-iss:focus{border-color:var(--accent-soft,rgba(234,106,44,.55))}'
+'.lx-cm-err{color:var(--red,#ff5b5b);font-size:12px;min-height:15px;margin-top:9px;line-height:1.35}'
+'.lx-cm-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}'
+'.lx-cm-cancel{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer}'
+'.lx-cm-confirm{background:var(--accent,#ea6a2c);border:none;color:#fff;border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer}'
+'.lx-swap-err{color:var(--red,#ff5b5b);font-size:12.5px;font-weight:600;line-height:1.4;margin:2px 2px 8px}'
// smart-swap (Soroswap/Aquarius best-rate) badge
+'.lx-smart-badge{display:flex;align-items:center;gap:12px;margin:12px 2px 6px;padding:12px 13px;border-radius:14px;background:var(--accent-pale,rgba(234,106,44,.08));border:1px solid var(--accent-soft,rgba(234,106,44,.28))}'
+'.lx-smart-badge .lx-sb-ic{flex:0 0 auto;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent,#ea6a2c),#c1440a);display:flex;align-items:center;justify-content:center;box-shadow:0 5px 14px rgba(234,106,44,.32)}'
+'.lx-smart-badge .lx-sb-ic svg{width:19px;height:19px;fill:#fff;display:block}'
+'.lx-smart-badge .lx-sb-mid{flex:1;min-width:0}'
+'.lx-smart-badge .lx-sb-ttl{font-weight:800;font-size:14.5px;color:var(--text);letter-spacing:-.01em;line-height:1.2}'
+'.lx-smart-badge .lx-sb-sub{font-size:12.3px;color:var(--text-soft);margin-top:2px;line-height:1.3}'
+'.lx-smart-badge .lx-sb-sub b{font-weight:700;color:var(--text)}'
+'.lx-smart-badge .lx-sb-learn{color:var(--accent,#ea6a2c);font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap}'
+'.lx-smart-badge .lx-sb-learn:hover{text-decoration:underline}'
+'.lx-smart-badge .lx-sb-best{flex:0 0 auto;font-weight:800;font-size:12px;color:var(--green,#2f9e6b);background:var(--green-soft,rgba(53,192,127,.13));border:1px solid rgba(53,192,127,.34);padding:6px 11px;border-radius:10px;white-space:nowrap}'
+'.lx-smart-info{position:fixed;z-index:100002;max-width:290px;background:var(--surface,#171922);border:1px solid var(--border,rgba(255,255,255,.16));border-radius:14px;padding:14px 16px;box-shadow:0 22px 64px rgba(0,0,0,.5)}'
+'.lx-smart-info h5{margin:0 0 6px;font-size:13.5px;font-weight:800;color:var(--text)}'
+'.lx-smart-info p{margin:0;font-size:12.8px;line-height:1.5;color:var(--text-soft)}'
// 2-step: hide the full picker on step 2, show a compact 2-line summary; bump review sizes
+'#modalSwap:not(.lx-on-step2) .lx-swapd,#modalSwap:not(.lx-on-step2) .lx-step2-only{display:none!important}'
+'#modalSwap.lx-on-step2 .lx-step1-only{display:none!important}'
+'#modalSwap.lx-on-step2 .swap-pair{display:none!important}'
+'.lx-swap-summary{display:none}'
+'#modalSwap.lx-on-step2 .lx-swap-summary{display:flex;align-items:stretch;position:relative;margin:2px 0 12px;border:1px solid var(--border);border-radius:14px;background:var(--surface,#fff)}'
+'.lx-swap-summary .lx-ss-row{flex:1 1 0;min-width:0;padding:12px 14px}'
+'.lx-swap-summary .lx-ss-row:first-child{border-right:1px solid var(--border);padding-right:26px}'
+'.lx-swap-summary .lx-ss-row:last-child{padding-left:26px}'
+'.lx-swap-summary .lx-ss-head{display:flex;align-items:center;gap:8px;margin-bottom:7px}'
+'.lx-swap-summary .lx-ss-ico{width:24px;height:24px;border-radius:50%;flex:0 0 auto;position:relative;background:var(--al,#333)!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;overflow:hidden;color:#fff;font-weight:800;font-size:10px}'
+'.lx-swap-summary .lx-ss-ico::after{content:attr(data-l);position:absolute;inset:0;display:flex;align-items:center;justify-content:center}'
+'.lx-swap-summary .lx-ss-ico img,.lx-ss-ico svg{display:none!important}'
+'.lx-swap-summary .lx-ss-lbl{font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em}'
+'.lx-swap-summary .lx-ss-val{font-size:17px;font-weight:800;color:var(--text);font-family:\'JetBrains Mono\',monospace;line-height:1.2;word-break:break-all}'
+'.lx-swap-summary .lx-ss-val .lx-ss-code{display:block;font-size:12px;font-weight:700;color:var(--text-soft);margin-top:3px;font-family:inherit}'
+'.lx-swap-summary .lx-ss-arrow{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#ea6a2c),#c1440a);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px var(--surface,#fff),0 4px 10px rgba(234,106,44,.28);z-index:2}'
+'.lx-swap-summary .lx-ss-arrow svg{width:14px;height:14px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}'
+'#modalSwap.lx-on-step2 .lx-swapd{font-size:13.5px!important;border-radius:14px!important;padding:9px 14px!important}'
+'#modalSwap.lx-on-step2 .lx-swapd .r{padding:4px 0!important}'
+'#modalSwap.lx-on-step2 .lx-swapd .r strong{font-size:13.5px!important}'
+'#modalSwap .lx-review-btn:disabled{opacity:.55;cursor:not-allowed}'
+'#modalSwap .modal-foot{display:flex;gap:10px}'
// --- polish / life ---
+'.lx-smart-badge{animation:lxsbGlow 3.2s ease-in-out infinite}'
+'@keyframes lxsbGlow{0%,100%{box-shadow:0 0 0 0 rgba(234,106,44,0)}50%{box-shadow:0 0 0 3px rgba(234,106,44,.10)}}'
+'.lx-smart-badge .lx-sb-ic{animation:lxsbFloat 3.2s ease-in-out infinite}'
+'@keyframes lxsbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}'
+'.lx-smart-badge .lx-sb-best{position:relative;overflow:hidden}'
+'.lx-smart-badge .lx-sb-best::after{content:"";position:absolute;top:0;bottom:0;left:0;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-220%);animation:lxsbShine 2.9s ease-in-out infinite;pointer-events:none}'
+'@keyframes lxsbShine{0%,52%{transform:translateX(-220%)}100%{transform:translateX(430%)}}'
+'#modalSwap .swap-pair .field{transition:border-color .16s ease,box-shadow .16s ease}'
+'#modalSwap .swap-pair .field:focus-within{border-color:var(--accent-soft,rgba(234,106,44,.55))!important;box-shadow:0 0 0 3px var(--accent-pale,rgba(234,106,44,.09))}'
+'#modalSwap .swap-arrow:hover{background:var(--surface-2)!important;box-shadow:none!important;transform:translate(-50%,-50%)!important;filter:none!important}'
+'#modalSwap .modal-foot .btn-primary{transition:filter .15s ease,box-shadow .2s ease,transform .08s ease}'
+'#modalSwap .modal-foot .btn-primary:not(:disabled):hover{filter:brightness(1.07);box-shadow:0 9px 24px rgba(234,106,44,.36)}'
+'#modalSwap .modal-foot .btn-primary:not(:disabled):active{transform:translateY(1px)}'
// dashboard #swapModal picker (base menu CSS — present via _walletdata on the wallet page, but the dashboard has no _walletdata)
+'.lx-asset-menu{background:var(--surface,#171922);border:1px solid var(--border,rgba(255,255,255,.14));border-radius:12px;padding:6px;box-shadow:0 14px 44px rgba(0,0,0,.55);width:230px;max-height:290px;overflow-y:auto}'
+'.lx-am-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;background:none;border:none;border-radius:8px;cursor:pointer;color:var(--text,#fff);font-size:13.5px;text-align:left}'
+'.lx-am-item:hover{background:rgba(255,255,255,.06)}'
+'.lx-am-ic{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px;flex:0 0 auto;overflow:hidden}'
+'.lx-am-ic img{width:100%;height:100%;object-fit:cover;display:block}'
+'.lx-am-code{font-weight:600}'
// asset code alone cannot identify a Stellar asset — the picker now stacks the home domain / issuer under it
+'.lx-am-txt{display:flex;flex-direction:column;gap:1px;min-width:0;overflow:hidden}'
+'.lx-am-sub{font-size:10.5px;line-height:1.25;color:var(--text-muted,#8b90a0);font-family:JetBrains Mono,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}'
+'#swapModal .lx-dchip{cursor:pointer;border-radius:10px;padding:2px 4px;margin:-2px -4px;transition:background .12s}'
+'#swapModal .lx-dchip:hover{background:var(--surface-2,rgba(255,255,255,.06))}'
+'#swapModal .lx-dcaret{display:inline-flex;margin-left:1px;opacity:.55}'
+'#swapModal .lx-dcaret svg{display:block}'
+'#swapModal .lx-swap-err{margin:2px 2px 10px}'
+'#swapModal [id="swapGo"][data-lxdis="1"]{opacity:.55;cursor:not-allowed}'
+'</style>';

const ROWS='\'<div class="r"><span>Rate</span><strong data-k="rate">&mdash;</strong></div>\''
+'+\'<div class="r"><span>Slippage tolerance</span><strong data-k="slip">&mdash;</strong></div>\''
+'+\'<div class="r"><span data-k="feelbl">Swap fee (0.2%)</span><strong data-k="fee">&mdash;</strong></div>\''
+'+\'<div class="r"><span>Network fee</span><strong data-k="net">&mdash;</strong></div>\''
// No "Price impact" row here, deliberately. This panel serves the generic swap boxes (Dashboard quick
// actions, Wallet > My assets), where the user picks BOTH sides. Price impact is a statement about one
// asset -- "this trade moves X's price by N%" -- and with no subject asset there is nothing for the sign
// to refer to; either side is equally the thing being traded. The Trade-Asset page keeps it, because
// there the page itself names the asset. The set("pi", ...) calls in the render paths are left alone on
// purpose: setter() skips keys it cannot find, so with the row gone they are no-ops, and unpicking four
// call sites out of long statement chains is more risk than a dead assignment is worth.
+'+\'<div class="r rtot"><span>Minimum received</span><strong data-k="min">&mdash;</strong></div>\''
+'+\'<div class="lx-feenote" data-k="feenote"></div>\'';

// ===================== Custom Swap / Orders: the dashboard modal's three tabs =====================
//
// The SAME #modalSwap markup ships on the wallet page, and this transform injects into both, so every
// addition here is scoped at runtime to the dashboard instance. The signal is the quick-action card:
// "Swap tokens" is renamed to "Custom Swap / Orders" in the markup below, and that card exists ONLY on
// the dashboard (checked: 1 occurrence on home, 0 on wallet). No card, no tabs -- wallet's swap modal
// stays exactly as it is.
//
// Built at runtime rather than in markup, which is the opposite of the usual rule here. It is safe in
// this one case because the modal is display:none until the card is clicked, so there is no first paint
// to flash -- and it keeps the wallet copy byte-identical.
const QSTYLE='<style id="lx-qorders-css">'
+'.lxo-tabs{display:flex;gap:3px;margin:0 0 14px;padding:3px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px}'
+'.lxo-tabs button{flex:1 1 0;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:var(--text-soft);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .12s ease,color .12s ease}'
+'.lxo-tabs button:hover{color:var(--text)}'
+'.lxo-tabs button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.18)}'
+'.lxo-pane[hidden]{display:none!important}'
// --- Limit + Orders ---------------------------------------------------------------------------------
// Every value below is lifted from the Swap pane's own inline styles so the three tabs read as one
// screen: field blocks are var(--bg) / 1px var(--border) / radius 14 / padding 13-14, labels are 13.5px
// var(--text-soft) with 7px beneath, the asset pill is 16px/700 next to a 24px round mark, figures are
// JetBrains Mono 20px/700 right-aligned, the meta line is 13.5px var(--text-soft), and the CTA is a
// full-width 46px var(--accent) button at 16px/700. Nothing here invents a new size or colour.
+'.lxq-f{display:flex;flex-direction:column;position:relative}'
+'.lxq-fld{background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:13px 14px;margin-bottom:10px}'
+'.lxq-lab{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13.5px;color:var(--text-soft);margin-bottom:7px}'
+'.lxq-lab .bal{font-size:12.5px;color:var(--text-muted)}'
+'.lxq-max,.lxq-mkt{background:var(--accent-soft,rgba(234,106,44,.14));color:var(--accent,#ea6a2c);border:1px solid var(--accent-soft,rgba(234,106,44,.22));border-radius:7px;font:inherit;font-size:11px;font-weight:800;padding:3px 8px;cursor:pointer;letter-spacing:.02em}'
+'.lxq-max:hover,.lxq-mkt:hover{filter:brightness(1.12)}'
// the unit reads as a sentence ("USDC per FOX") and MARKET is a control -- they were touching, so the
// label looked like part of the button
+'.lxq-mkt{margin-left:10px}'
// the received amount is a figure, not a field: same type as the input beside it, but muted and inert
+'.lxq-recv{text-align:right;color:var(--text-soft);pointer-events:none}'
+'.lxq-usd{margin-top:5px;text-align:right;font-size:12px;color:var(--text-muted);min-height:15px;font-family:\'JetBrains Mono\',monospace}'
// An inline background-image set by the site logo engine loses to an !important rule, so OUR artwork
// wins wherever we have some. Where we have none we leave the element alone and the engine may paint
// its own mark -- this claims the ones we resolved, it does not fight over the rest.
+'.lxq-ic[data-art]{background-image:var(--lxa)!important;background-size:cover!important;background-position:center!important;color:transparent!important;font-size:0!important}'
+'.lxq-lin{display:flex;align-items:center;justify-content:space-between;gap:10px}'
+'.lxq-pick{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:16px;color:var(--text);cursor:pointer;min-width:0}'
+'.lxq-pick .lxq-ic{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#2a2a35,#1a1a23);color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}'
+'.lxq-pick .cv{color:var(--text-muted);font-weight:600;font-size:15px}'
+'.lxq-pick .car{color:var(--text-muted);font-size:11px;flex:0 0 auto}'
+'.lxq-in{flex:1;min-width:0;border:none;outline:none;background:transparent;text-align:right;font-family:\'JetBrains Mono\',monospace;font-size:20px;font-weight:700;color:var(--text)}'
+'.lxq-unit{font-size:12.5px;color:var(--text-muted);white-space:nowrap;flex:0 0 auto}'
+'.lxq-meta{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;color:var(--text-soft);margin:1px 2px 12px}'
+'.lxq-meta b{color:var(--text);font-family:\'JetBrains Mono\',monospace;font-weight:700}'
+'.lxq-note{font-size:12.5px;line-height:1.5;color:var(--text-muted);margin:0 2px 12px}'
+'.lxq-err{color:var(--red,#ff5b5b);font-size:12.5px;font-weight:600;margin:0 2px 10px}'
+'.lxq-go{width:100%;height:46px;border-radius:12px;border:none;background:var(--accent);color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}'
+'.lxq-go[disabled]{opacity:.45;cursor:not-allowed}'
// the picker reads as the same card material, one step above the field it drops out of
+'.lxq-menu{position:absolute;z-index:60;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:6px;box-shadow:0 24px 60px rgba(0,0,0,.4);max-height:264px;overflow:auto}'
+'.lxq-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border:0;border-radius:10px;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}'
+'.lxq-menu button:hover{background:var(--bg)}'
+'.lxq-menu button .lxq-ic{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#2a2a35,#1a1a23);color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}'
+'.lxq-menu button .tx{min-width:0;flex:1 1 auto}'
+'.lxq-menu button .cd{font-size:14px;font-weight:700;line-height:1.2}'
+'.lxq-menu button .s{display:block;font-size:11.5px;font-weight:500;color:var(--text-muted);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'.lxq-menu button .rt{flex:0 0 auto;font-size:11.5px;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace}'
+'.lxq-menu input{width:100%;padding:9px 10px;margin:2px 0 4px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font:inherit;font-size:13.5px;color:var(--text);outline:none}'
+'.lxq-menu input:focus{border-color:var(--accent)}'
+'.lxq-menu .h{padding:7px 9px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}'
// The verified tick is a PSEUDO-ELEMENT, not a span. As a span the site logo healer treated it as an
// icon and stamped a token image into it -- which is why USDC and EURC showed a blue disc where the
// green tick belongs. A ::after has no node for any painter to reach. Same reasoning as the token marks.
+'.cd[data-v]{display:inline-flex;align-items:center;gap:5px}'
+'.cd[data-v]::after{content:"\\2713";display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#35c07f;color:#fff;font-size:8px;font-weight:900;flex:0 0 auto}'
// --- Orders tab: the same field-block material as a swap row ---
+'.lxo-list{display:flex;flex-direction:column;min-height:70px;max-height:62vh;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}'
+'.lxo-list::-webkit-scrollbar{width:8px}'
+'.lxo-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px}'
+'.lxo-list::-webkit-scrollbar-track{background:transparent}'
+'.lxo-o{background:var(--bg);border:1px solid var(--border);border-radius:13px;padding:11px 12px;margin-bottom:8px;transition:border-color .14s ease}'
+'.lxo-o:hover{border-color:var(--text-muted)}'
+'.lxo-top{display:flex;flex-direction:column;gap:8px}'
+'.lxo-col{display:flex;align-items:center;gap:10px;min-width:0}'
+'.lxo-cap{flex:0 0 52px;font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);line-height:1.25}'
+'.lxo-side{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto}'
+'.lxo-tx{min-width:0;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}'
+'.lxo-tx .q{font-family:\'JetBrains Mono\',monospace;font-size:15px;font-weight:700;color:var(--text);white-space:nowrap}'
+'.lxo-tx .c{font-size:12px;font-weight:700;color:var(--text-soft)}'
+'.lxo-side .lxq-ic{width:32px;height:32px;border-radius:50%;background:var(--lxfb,linear-gradient(135deg,#2a2a35,#1a1a23));color:#fff;font-size:11px;font-weight:800;letter-spacing:.02em;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 0 0 1px var(--border)}'
+'.lxo-ft{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px;padding-top:9px;border-top:1px solid var(--border)}'
+'.lxo-pw{display:flex;align-items:baseline;gap:8px;min-width:0}'
+'.lxo-k{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);flex:0 0 auto}'
+'.lxo-px{font-size:12px;color:var(--text-soft);font-family:\'JetBrains Mono\',monospace;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
+'.lxo-o button{flex:0 0 auto;height:28px;padding:0 13px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-soft);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:color .12s ease,border-color .12s ease,background .12s ease}'
+'.lxo-o button:hover:not([disabled]){color:var(--red,#ff5b5b);border-color:var(--red,#ff5b5b);background:rgba(255,91,91,.08)}'
+'.lxo-o button[disabled]{opacity:.5;cursor:default}'
+'.lxo-empty{padding:30px 10px;text-align:center;color:var(--text-soft);font-size:13.5px;line-height:1.6}'
+'.lxo-empty .sub{display:block;margin-top:5px;font-size:12.5px;color:var(--text-muted)}'
+'</style>';

const QSCRIPT='<script id="lx-qorders">(function(){'
+'if(window.__lxQOrders)return;window.__lxQOrders=1;'
+'function q(s,r){return (r||document).querySelector(s);}'
// dashboard only: the renamed card is the marker, and it exists on no other page
// THE MODAL IS #swapModal, NOT #modalSwap.
//
// The dashboard carries BOTH. #modalSwap is the design's .modal-overlay component and is what the WALLET
// page opens; #swapModal is a separate inline-styled panel (data-swapmodal) and is what the quick-action
// card opens -- it is the one with You pay / You receive / Rate. The first build of this feature attached
// to #modalSwap, so the tabs were real, correct, and on an element nobody ever saw. Grep found the name;
// it did not tell me which one the card opens.
//
// #swapModal exists only on the dashboard (0 occurrences on wallet), so the element itself is now the
// scoping signal and no card-title check is needed.
+'function build(){'
+'var modal=document.getElementById("swapModal");if(!modal)return;'
+'var card=modal.firstElementChild;if(!card||card.__lxqo)return;'
+'var head=card.firstElementChild;if(!head)return;card.__lxqo=1;'
// the title is the first child of the header row, beside the close button
+'var ttl=head.firstElementChild;if(ttl)ttl.textContent="Custom Swap / Orders";'
// everything after the header row becomes the Swap pane -- moved, not rebuilt, so #swapAmtIn, #swapFrom,
// #swapFlip and every handler already bound to them keep working untouched
+'var swap=document.createElement("div");swap.className="lxo-pane";swap.setAttribute("data-pane","swap");'
+'while(head.nextSibling)swap.appendChild(head.nextSibling);'
+'var tabs=document.createElement("div");tabs.className="lxo-tabs";'
+'tabs.innerHTML=\'<button type="button" data-pane="swap" class="on">Swap</button>\''
+'+\'<button type="button" data-pane="limit">Limit</button>\''
+'+\'<button type="button" data-pane="orders">Orders</button>\';'
+'var limit=document.createElement("div");limit.className="lxo-pane";limit.setAttribute("data-pane","limit");limit.hidden=true;'
+'var orders=document.createElement("div");orders.className="lxo-pane";orders.setAttribute("data-pane","orders");orders.hidden=true;'
+'card.appendChild(tabs);card.appendChild(swap);card.appendChild(limit);card.appendChild(orders);'
// capture + stop: the dashboard runs delegated click handlers that treat clicks in this modal as swap UI
+'tabs.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("button[data-pane]"):null;if(!b)return;'
+'e.preventDefault();e.stopImmediatePropagation();show(b.getAttribute("data-pane"));},true);'
+'try{window.__lxQOshow=show;}catch(_){}'
+'}'
+'function show(name){'
+'var modal=document.getElementById("swapModal");if(!modal)return;'
+'var ps=modal.querySelectorAll(".lxo-pane");for(var i=0;i<ps.length;i++)ps[i].hidden=(ps[i].getAttribute("data-pane")!==name);'
+'var bs=modal.querySelectorAll(".lxo-tabs button");for(var j=0;j<bs.length;j++)bs[j].classList.toggle("on",bs[j].getAttribute("data-pane")===name);'
+'try{if(name==="limit"&&window.__lxQOlimit)window.__lxQOlimit();'
+'if(name==="orders"&&window.__lxQOorders)window.__lxQOorders();}catch(_){}'
+'}'
+'if(document.readyState!=="loading")build();else document.addEventListener("DOMContentLoaded",build);'
// the modal can be (re)built by the design after load; keep trying cheaply until it is ours
+'var t=0,iv=setInterval(function(){t++;build();if(t>20)clearInterval(iv);},400);'

// ---------------- Limit tab ----------------
// A limit order here is a plain Stellar offer between ANY two assets, which the protocol has always
// allowed -- Trade-Asset only ever exposed it against XLM because it hardcoded xlm as the counter asset.
// manageSellOffer takes price as BUYING units per 1 SELLING unit, so the field is labelled that way and
// the total is spelled out underneath. A bare "price" box is how people place orders upside down.
+'var QH="https://horizon.stellar.org";'
+'var SWSU="'+SW_STELLAR_URI+'";'
// The buy-side shortlist. Issuer AND domain were resolved from stellar.expert by holder count, not
// recalled: every one of these codes has a look-alike on mainnet (USDC/googscale.org 1,288 holders,
// EURC/mykobo.co 12,808, SHX/stronghold.digital 465, AQUA/lobstrvault.org 198), so the domain and the
// shortened issuer are shown on every row and the tick means "this is the one we verified".
// LUMOS shows lumoscore.com though the issuer still declares lumosdao.io -- same rule the rest of the
// site uses for our own token.
+'var QCUR=['
+'{code:"USDC",issuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",dom:"centre.io",v:1,img:"https://assets.coingecko.com/coins/images/6319/small/usdc.png"},'
+'{code:"EURC",issuer:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",dom:"circle.com",v:1,img:"https://assets.coingecko.com/coins/images/26045/small/euro.png"},'
+'{code:"SHX",issuer:"GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH",dom:"stronghold.co",v:1,img:"https://stronghold.co/.well-known/logo.png"},'
+'{code:"AQUA",issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",dom:"aqua.network",v:1,img:"https://aqua.network/assets/img/aqua-logo.png"},'
+'{code:"LUMOS",issuer:"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S",dom:"lumoscore.com",v:1,img:"/assets/tokens/lumos.png"}'
+'];'
// our own launchpad roster, straight from the manifest the Trade pages are built from, so searching
// here finds everything listed under All Trading Pairs without a round trip
+'var qS=null,qB=null;'                                    // selected sell / buy asset
+'function qAddr(){try{return localStorage.getItem("lumos.address")||"";}catch(_){return "";}}'
// Balances are fetched here rather than borrowed. The dashboard's own dashBoot() fills __lxHoldings,
// but it is a private function in the swap wiring -- not exposed -- so the Limit tab was calling a
// global that never existed and the sell list was always empty. One account read, cached, refreshed
// each time the tab is opened; __lxHoldings is still used if it happens to be there first.
// Real artwork for our own tokens. LUMOS already showed its flame because the site's logo healer knows
// it by ticker; DOPE, FOX, LMNR and the rest are launchpad mints the healer has never heard of, so they
// fell back to initials. The manifest the Trade pages are built from has an image for every one of them,
// keyed CODE-ISSUER, so one fetch covers the whole roster. Initials remain only where there is no image.
+'var QICO=null;'
+'function qIcons(){if(QICO)return Promise.resolve(QICO);'
+'return fetch("/assets/tokens/launchpad-icons.json").then(function(r){return r.json();}).then(function(m){'
+'QICO={};Object.keys(m||{}).forEach(function(k){var v=m[k];var img=(v&&typeof v==="object")?v.image:v;'
+'if(img)QICO[k]=img;});return QICO;}).catch(function(){QICO={};return QICO;});}'
// Artwork straight from the issuer's own stellar.toml, for anything the manifest and stellar.expert do
// not already cover. Searching "love" returns four assets and stellar.expert carries tomlInfo.image for
// exactly one of them, so the rest have to be read at the source.
//
// Grouped by domain and cached: three results from love.stellarmint.io cost ONE request, and a domain is
// only ever fetched once per session. Blocks are matched on the ISSUER, which is unique, rather than by
// building a regex around a quoted code -- that construction is what broke this file twice already.
// A toml that is missing, unreachable or CORS-blocked simply leaves the lettered mark in place.
+'var QTOML={};'
+'function qTomlFill(rows){'
+'var byDom={};rows.forEach(function(r){ if(!r||!r.a||r.a.img||!r.a.dom||!r.a.issuer)return;'
+'(byDom[r.a.dom]=byDom[r.a.dom]||[]).push(r); });'
+'Object.keys(byDom).slice(0,5).forEach(function(dom){'
+'function apply(txt){ if(!txt)return; var blocks=txt.split("[[CURRENCIES]]");'
+'byDom[dom].forEach(function(r){ for(var i=1;i<blocks.length;i++){ var b=blocks[i];'
+'if(b.indexOf(r.a.issuer)<0)continue;'
+'var m=b.match(/image\\s*=\\s*"([^"]+)"/i);'
+'if(m&&m[1]){ r.a.img=m[1]; try{ qPaintIco(r.el,r.a); }catch(_){} } break; } }); }'
+'if(QTOML[dom]!==undefined){ apply(QTOML[dom]); return; }'
+'fetch("https://"+dom+"/.well-known/stellar.toml").then(function(r){return r.ok?r.text():"";})'
+'.then(function(t){ QTOML[dom]=t||""; apply(QTOML[dom]); }).catch(function(){ QTOML[dom]=""; });'
+'});}'
// SWSU is the Stellar mark this file already carries for the swap pane, so XLM is never a lettered blob.
+'function qPaintIco(el,a){if(!el||!a)return;'
+'var u=a.native?SWSU:(a.img||(QICO?QICO[a.code+"-"+a.issuer]:""));if(!u)return;'
+'el.textContent="";el.style.setProperty("--lxa","url("+u+")");el.setAttribute("data-art","1");}'
+'var QBAL=null;'
+'function qMap(b){var _sl=+b.selling_liabilities||0,_av=Math.max(0,(+b.balance||0)-_sl);'
+'return b.asset_type==="native"?{code:"XLM",issuer:"",native:true,bal:_av,lock:_sl}'
+':{code:b.asset_code,issuer:b.asset_issuer,native:false,bal:_av,lock:_sl};}'
+'function qHold(){if(QBAL&&QBAL.length)return QBAL;'
+'return (window.__lxHoldings||[]).map(function(h){return{code:h.code,issuer:h.iss||"",native:!!h.native,bal:+h.bal||0,lock:0};});}'
+'function qLoadBal(){var a=qAddr();if(!a)return Promise.resolve([]);'
+'return fetch(QH+"/accounts/"+a).then(function(r){return r.json();}).then(function(d){'
+'QBAL=((d&&d.balances)||[]).filter(function(b){return b.asset_type!=="liquidity_pool_shares";}).map(qMap);'
+'return QBAL;}).catch(function(){return QBAL||[];});}'
+'function qHas(a){if(!a)return false;if(a.native)return true;var h=qHold();'
+'for(var i=0;i<h.length;i++)if(h[i].code===a.code&&h[i].issuer===a.issuer)return true;return false;}'
+'function qBal(a){if(!a)return 0;var h=qHold();'
+'for(var i=0;i<h.length;i++)if(h[i].code===a.code&&(a.native?h[i].native:h[i].issuer===a.issuer))return h[i].bal;return 0;}'
+'function qLock(a){if(!a)return 0;var h=qHold();'
+'for(var i=0;i<h.length;i++)if(h[i].code===a.code&&(a.native?h[i].native:h[i].issuer===a.issuer))return +h[i].lock||0;return 0;}'
+'function qShort(g){g=String(g||"");return g.length>10?g.slice(0,4)+"\\u2026"+g.slice(-4):g;}'
+'function qNum(n){n=+n||0;return n.toLocaleString(undefined,{maximumFractionDigits:7});}'
// display only -- MAX and the order itself still use the exact balance to 7dp
+'function qNum3(n){n=+n||0;return n.toLocaleString(undefined,{maximumFractionDigits:3});}'
+'function qEl(s){return document.querySelector("#swapModal .lxo-pane[data-pane=\\"limit\\"] "+s);}'
+'function qClose(){var m=qEl(".lxq-menu");if(m)m.remove();}'
// picker. Sell side is your balances -- you cannot sell what you do not hold. Buy side adds search,
// which asks stellar.expert and ALWAYS shows the issuer and domain: 403 mainnet assets use the code
// USDC, so a ticker alone is not an identity and must never be the only thing on screen.
+'function qSame(a,b){return !!a&&!!b&&a.code===b.code&&(a.issuer||"")===(b.issuer||"");}'
+'function qMsg(host,text){while(host.firstChild)host.removeChild(host.firstChild);'
+'var d=document.createElement("div");d.className="h";d.textContent=text;host.appendChild(d);}'
+'function qRow(a,right){'
// Built with createElement, not innerHTML. This markup is three levels of quoting deep -- Node string,
// emitted JS string, HTML attribute -- and the innerHTML version shipped `class="ic"` unescaped, which
// broke the whole script. Nodes have no quoting to get wrong, and asset codes and domains come from
// upstream data, so this also means none of it is ever parsed as markup.
+'var b=document.createElement("button");b.type="button";'
// data-lxc is _logoguard's documented opt-out. Without it the site healer stamps the SAME generic
// Stellar glyph onto every one of these spans -- which is why six different assets from one domain
// all looked identical. We supply the artwork ourselves now: curated images, the icon manifest, and
// the issuer toml. Where none of those has one, initials are the honest answer.
+'var ic=document.createElement("span");ic.className="lxq-ic";ic.setAttribute("data-lxc",a.code||"");ic.textContent=(a.code||"?").slice(0,2);'
+'var tx=document.createElement("span");tx.className="tx";'
+'var cd=document.createElement("span");cd.className="cd";cd.textContent=a.code||"";'
+'if(a.v)cd.setAttribute("data-v","1");'
+'var sub=(a.dom||(a.native?"native asset":qShort(a.issuer)));'
+'if(a.dom&&!a.native)sub+=" \u00b7 "+qShort(a.issuer);'
+'var sb=document.createElement("span");sb.className="s";sb.textContent=sub;'
+'qPaintIco(ic,a);tx.appendChild(cd);tx.appendChild(sb);b.appendChild(ic);b.appendChild(tx);'
+'if(right){var rt=document.createElement("span");rt.className="rt";rt.textContent=right;b.appendChild(rt);}'
+'return b;}'
+'function qPick(side,anchor){'
+'qClose();var m=document.createElement("div");m.className="lxq-menu";'
+'m.style.top=(anchor.offsetTop+anchor.offsetHeight+6)+"px";'
+'function add(a,right){if(side==="buy"&&qSame(a,qS))return;if(side==="sell"&&qSame(a,qB))return;'
+'var b=qRow(a,right);b.addEventListener("click",function(e){e.preventDefault();e.stopImmediatePropagation();'
+'if(side==="sell"){qS=a;if(qSame(qB,a))qB=null;}else{qB=a;if(qSame(qS,a))qS=null;}qClose();qSync();qQuote();'
+'qUsdLoad(a).then(function(){qSync();});},true);'
+'m.appendChild(b);}'
+'function head(t){var h=document.createElement("div");h.className="h";h.textContent=t;m.appendChild(h);return h;}'
// SELL: the wallet, and nothing else. BUY: the five, and nothing else, then search.
// No headings on the sell side and none above the five -- a list this short does not need labelling,
// and the earlier version stacked four captioned groups over what should be one glance.
+'if(side==="sell"){'
+'var hs=qHold();'
+'if(!hs.length)head("No assets in this wallet yet");'
+'hs.forEach(function(a){ if(a.bal>0||a.native)add(a,qNum(a.bal));'
+'else if(a.lock>0)add(a,"0 \\u00b7 "+qNum3(a.lock)+" in orders"); });'
+'}else{'
+'head("Search any asset");'
+'var inp=document.createElement("input");inp.type="text";inp.placeholder="Code or issuer address";m.appendChild(inp);'
+'var res=document.createElement("div");m.appendChild(res);var tmr=null;'
+'inp.addEventListener("click",function(e){e.stopPropagation();},true);'
+'inp.addEventListener("input",function(){var v=(inp.value||"").trim();clearTimeout(tmr);'
+'if(v.length<2){res.innerHTML="";return;}'
+'tmr=setTimeout(function(){'
+'fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(v)+"&limit=12")'
+'.then(function(r){return r.json();}).then(function(d){'
+'var recs=(d&&d._embedded&&d._embedded.records)||[];res.innerHTML="";var pend=[];'
// tomlInfo is the issuer's OWN stellar.toml, already resolved by stellar.expert on this same response --
// so the artwork comes from the toml exactly as it should, with no extra request per row. Without this
// the mapper threw the image away and every search result fell back to a lettered mark.
+'recs.map(function(x){var p=String(x.asset||"").split("-");var ti=x.tomlInfo||x.toml_info||{};'
+'return {code:p[0]||"",issuer:p[1]||"",native:false,dom:x.domain||"",'
+'img:ti.image||ti.orgLogo||"",tl:(x.trustlines&&x.trustlines[0])||0};})'
+'.filter(function(a){return a.code&&/^G[A-Z2-7]{55}$/.test(a.issuer)&&!qSame(a,qS);})'
+'.sort(function(a,b){return b.tl-a.tl;})'
+'.forEach(function(a){var b=qRow(a,"");'
+'b.addEventListener("click",function(e){e.preventDefault();e.stopImmediatePropagation();qB=a;qClose();qSync();qQuote();'
+'qUsdLoad(a).then(function(){qSync();});},true);'
+'res.appendChild(b);pend.push({a:a,el:b.querySelector(".lxq-ic")});});'
// rows are on screen immediately with a lettered mark; the toml lookup fills in artwork as it arrives
+'qTomlFill(pend);'
// same createElement rule as qRow: a quoted attribute three levels deep is how this broke twice
+'if(!res.children.length)qMsg(res,"No matches");'
+'}).catch(function(){qMsg(res,"Search unavailable");});},260);});'
// the five sit BELOW the search box: typing is the fast path for anything, and the shortlist is what
// you fall back to when you are not looking for something specific
+'QCUR.forEach(function(a){ add(a); });'
+'}'
+'var f=qEl(".lxq-f");if(f)f.appendChild(m);'
+'}'

// keep the form and its derived numbers in step
+'function qSync(){'
+'var ps=qEl(".lxq-pick[data-side=\\"sell\\"]"),pb=qEl(".lxq-pick[data-side=\\"buy\\"]");if(!ps||!pb)return;'
// the selected asset reads exactly like the Swap pane's pill: round mark, code, then a caret
+'function qPill(el,a){'
+'while(el.firstChild)el.removeChild(el.firstChild);'
+'if(a){var ic=document.createElement("span");ic.className="lxq-ic";ic.setAttribute("data-lxc",a.code||"");ic.textContent=(a.code||"?").slice(0,2);'
+'var cd=document.createElement("span");cd.textContent=a.code||"";'
+'qPaintIco(ic,a);el.appendChild(ic);el.appendChild(cd);'
+'if(a.v)cd.setAttribute("data-v","1");}'
+'else{var cv=document.createElement("span");cv.className="cv";cv.textContent="Select asset";el.appendChild(cv);}'
+'var car=document.createElement("span");car.className="car";car.textContent="▾";el.appendChild(car);}'
+'qPill(ps,qS);qPill(pb,qB);'
+'var u=qEl(".lxq-unit");if(u)u.textContent=(qS&&qB)?(qB.code+" per "+qS.code):"";'
+'var bl=qEl(".lxq-balv");if(bl)bl.textContent=qS?(qNum3(qBal(qS))+" "+qS.code):"\\u2014";'
+'var amt=parseFloat(((qEl(".lxq-amt")||{}).value||"").replace(/,/g,""))||0;'
+'var pr=parseFloat(((qEl(".lxq-price")||{}).value||"").replace(/,/g,""))||0;'
+'var recvAmt=(qS&&qB&&amt>0&&pr>0)?(amt*pr):0;var us=qEl(".lxq-usds");if(us)us.textContent=qUsdTxt(amt,qS);var ub=qEl(".lxq-usdb");if(ub)ub.textContent=qUsdTxt(recvAmt,qB);var tot=qEl(".lxq-recv");if(tot)tot.textContent=(qS&&qB&&amt>0&&pr>0)?qNum(amt*pr):"\\u2014";'
// the trustline line is a cost disclosure, not a warning to be skimmed
+'var nt=qEl(".lxq-note");'
+'if(nt){var _nl=[];var _lk=qS?qLock(qS):0;'
+'if(_lk>0)_nl.push(qNum3(_lk)+" "+qS.code+" is already committed to open orders and cannot be sold twice.");'
+'if(qMktMsg)_nl.push(qMktMsg);'
+'if(qB&&!qHas(qB))_nl.push("Buying "+qB.code+" needs a trustline. It is added in the same transaction and locks 0.5 XLM as a reserve for as long as you hold it.");'
+'nt.textContent=_nl.join(" "); }'
+'var err=qEl(".lxq-err"),go=qEl(".lxq-go");if(!err||!go)return;'
+'var msg="";'
+'if(qS&&qB&&qS.code===qB.code&&qS.issuer===qB.issuer)msg="Pick two different assets.";'
+'else if(amt>0&&qS&&amt>qBal(qS)+1e-9)msg=(qLock(qS)>0)?("Only "+qNum(qBal(qS))+" "+qS.code+" is free to sell \\u2014 the rest is committed to open orders."):("You only hold "+qNum(qBal(qS))+" "+qS.code+".");'
+'else if(qS&&qS.native&&amt>0&&amt>qBal(qS)-1.5)msg="Leave at least 1.5 XLM for reserves and fees.";'
+'err.textContent=msg;'
+'go.disabled=!(qS&&qB&&amt>0&&pr>0&&!msg&&qAddr());'
+'}'
+'function qBuildUi(){'
+'var pane=document.querySelector("#swapModal .lxo-pane[data-pane=\\"limit\\"]");if(!pane||pane.__b)return;pane.__b=1;'
// same three-block rhythm as the Swap pane: labelled field, labelled field, meta line, CTA
+'pane.innerHTML=\'<div class="lxq-f">\''
+'+\'<div class="lxq-fld"><div class="lxq-lab"><span>You sell</span>\''
+'+\'<span><span class="bal">Available: <span class="lxq-balv">\\u2014</span></span> <button type="button" class="lxq-max">MAX</button></span></div>\''
+'+\'<div class="lxq-lin"><div class="lxq-pick" data-side="sell"></div>\''
+'+\'<input class="lxq-in lxq-amt" type="text" inputmode="decimal" placeholder="0.00"></div>\''
+'+\'<div class="lxq-usd lxq-usds"></div></div>\''
+'+\'<div class="lxq-fld"><div class="lxq-lab"><span>You buy</span></div>\''
+'+\'<div class="lxq-lin"><div class="lxq-pick" data-side="buy"></div>\''
+'+\'<span class="lxq-in lxq-recv">0.00</span></div>\''
+'+\'<div class="lxq-usd lxq-usdb"></div></div>\''
+'+\'<div class="lxq-fld"><div class="lxq-lab"><span>Price</span>\''
+'+\'<span><span class="lxq-unit"></span> <button type="button" class="lxq-mkt">MARKET</button></span></div>\''
+'+\'<div class="lxq-lin"><input class="lxq-in lxq-price" type="text" inputmode="decimal" placeholder="0.00"></div></div>\''
+'+\'<div class="lxq-note"></div><div class="lxq-err"></div>\''
+'+\'<button type="button" class="lxq-go" disabled>Place limit order</button></div>\';'
// capture everywhere: the dashboard runs delegated handlers that treat clicks in this modal as swap UI
+'pane.addEventListener("click",function(e){var t=e.target,p=t.closest?t.closest(".lxq-pick"):null;'
// .lxq-fld, not the old .lxq-row: the restyle renamed the block, and closest() returning null made
// qPick throw on anchor.offsetTop, which silently killed every picker click.
+'if(p){e.preventDefault();e.stopImmediatePropagation();qPick(p.getAttribute("data-side"),p.closest(".lxq-fld"));return;}'
+'if(t.closest&&t.closest(".lxq-max")){e.preventDefault();e.stopImmediatePropagation();'
+'if(qS){var b=qBal(qS);if(qS.native)b=Math.max(0,b-1.5);var i=qEl(".lxq-amt");if(i){i.value=plain7(Math.floor(b*1e7)/1e7);qSync();}}return;}'
+'if(t.closest&&t.closest(".lxq-mkt")){e.preventDefault();e.stopImmediatePropagation();'
// MARKET hands the field back to the live quote after a manual edit -- qAuto is what the typing
// listener turns off, so turning it on and refetching is the whole gesture.
+'qAuto=true;var pe=qEl(".lxq-price");if(pe)pe.value="";qSync();qQuote();return;}'
+'if(t.closest&&t.closest(".lxq-go")){e.preventDefault();e.stopImmediatePropagation();qPlace();return;}'
+'if(!t.closest||!t.closest(".lxq-menu"))qClose();'
+'},true);'
+'pane.addEventListener("input",function(e){if(e.target&&e.target.classList&&e.target.classList.contains("lxq-price"))qAuto=false;qSync();},true);'
+'qSync();'
+'}'
// build the offer. changeTrust rides in the same transaction when the buy asset is new, exactly as the
// Trade-Asset limit path already does -- one signature, and the order cannot land without the trustline.
// Seed the price with the live market rate for the chosen pair, so the field opens at something real
// rather than 0.00 and the reader can see what they are moving away from. Strict-send paths for ONE unit
// of the sell asset -- the same endpoint the Swap tab quotes with -- and the best destination_amount IS
// the price in buying-per-selling, which is exactly what the field means.
//
// It stops seeding the moment the price is typed in: a limit order is a deliberate number, and a quote
// arriving late must never overwrite what someone has just entered.
// Dollar values for both sides. Priced by asking for a strict-send path from ONE unit of the asset to
// Circle's USDC, whose destination_amount IS the dollar price -- the same routing the swap uses, so the
// figure agrees with what the DEX would actually pay. Cached per asset; USDC itself skips the request.
// An asset with no route to USDC has no honest dollar value, and the line is simply left off.
+'var QUSD={};'
+'var QUSDC="GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";'
+'function qUsdKey(a){return a.native?"XLM|":(a.code+"|"+a.issuer);}'
+'function qUsdLoad(a){'
+'if(!a)return Promise.resolve(null);var k=qUsdKey(a);'
+'if(QUSD[k]!==undefined)return Promise.resolve(QUSD[k]);'
+'if(a.code==="USDC"&&a.issuer===QUSDC){QUSD[k]=1;return Promise.resolve(1);}'
+'return fetch(QH+"/paths/strict-send?"+qAssetQ(a,"source")+"&source_amount=1&destination_assets=USDC%3A"+QUSDC)'
+'.then(function(r){return r.json();}).then(function(d){'
+'var recs=(d&&d._embedded&&d._embedded.records)||[];var best=0;'
+'recs.forEach(function(x){var v=+x.destination_amount||0;if(v>best)best=v;});'
+'QUSD[k]=best>0?best:null;return QUSD[k];}).catch(function(){QUSD[k]=null;return null;});}'
+'function qUsdOf(a){if(!a)return null;var v=QUSD[qUsdKey(a)];return (v===undefined)?null:v;}'
+'function qUsdTxt(amount,a){var p=qUsdOf(a);'
+'if(!(p>0)||!(amount>0))return "";'
+'var v=amount*p;'
+'return "\\u2248 $"+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:v<1?6:2});}'
+'var qAuto=true;'
+'function qAssetQ(a,pfx){if(a.native)return pfx+"_asset_type=native";'
+'var t=(a.code.length<=4)?"credit_alphanum4":"credit_alphanum12";'
+'return pfx+"_asset_type="+t+"&"+pfx+"_asset_code="+encodeURIComponent(a.code)+"&"+pfx+"_asset_issuer="+a.issuer;}'
+'function qPx1(o){if(!o)return 0;var r=o.price_r;if(r&&+r.d>0)return (+r.n)/(+r.d);return +o.price||0;}'
+'function qBookPx(sA,bA){return fetch(QH+"/order_book?"+qAssetQ(sA,"selling")+"&"+qAssetQ(bA,"buying")+"&limit=1")'
+'.then(function(r){return r.json();}).then(function(d){'
+'return{bid:qPx1((((d&&d.bids)||[])[0])),ask:qPx1((((d&&d.asks)||[])[0]))};'
+'}).catch(function(){return{bid:0,ask:0};});}'
+'function qPathPx(sA,bA){var dest=bA.native?"native":(encodeURIComponent(bA.code)+":"+bA.issuer);'
+'return fetch(QH+"/paths/strict-send?"+qAssetQ(sA,"source")+"&source_amount=1&destination_assets="+dest)'
+'.then(function(r){return r.json();}).then(function(d){'
+'var recs=(d&&d._embedded&&d._embedded.records)||[];var best=0;'
+'recs.forEach(function(x){var v=+x.destination_amount||0;if(v>best)best=v;});return best;}).catch(function(){return 0;});}'
+'function qPxStr(v){if(!(v>0))return "";if(v>=0.0001)return String(+v.toFixed(7));'
+'return v.toFixed(14).replace(/0+$/,"").replace(/\\.$/,"");}'
+'var qMktMsg="";'
+'function qQuote(){'
+'if(!qS||!qB||!qAuto)return;'
+'var sA=qS,bA=qB;'
+'var mark=qS.code+"|"+qB.code;qQuote.__k=mark;qMktMsg="";'
+'Promise.all([qBookPx(sA,bA),qPathPx(sA,bA)]).then(function(res){'
+'if(qQuote.__k!==mark||!qAuto)return;'                    // the pair changed while this was in flight
+'var el=qEl(".lxq-price");if(!el)return;'
+'var _bk=res[0],_rt=res[1],_px=0;'
+'if(_bk.bid>0&&_bk.ask>0)_px=(_bk.bid+_bk.ask)/2;else if(_rt>0)_px=_rt;'
+'var _s=qPxStr(_px);'
+'if(_s){el.value=_s;el.setAttribute("data-mkt","1");}'
+'else{el.value="";el.removeAttribute("data-mkt");'
+'var _lone=(_bk.bid>0)?_bk.bid:_bk.ask;'
+'qMktMsg=(_lone>0)?("The only quote on "+sA.code+"/"+bA.code+" is a single resting offer at "+qPxStr(_lone)+" "+bA.code+" per "+sA.code+". One offer is not a market price, so set your own.")'
+':("Nothing is trading "+sA.code+"/"+bA.code+" yet, so there is no market price to fill in \\u2014 set your own.");}'                 // no route: leave it to the user
+'qSync();}).catch(function(){});}'
+'function qPlace(){'
+'var go=qEl(".lxq-go");if(!go||go.disabled||go.__busy)return;'
+'var addr=qAddr();if(!addr){(window.lxToast||function(){})("Connect a wallet first.",true);return;}'
+'var amt=parseFloat(((qEl(".lxq-amt")||{}).value||"").replace(/,/g,""))||0;'
+'var pr=parseFloat(((qEl(".lxq-price")||{}).value||"").replace(/,/g,""))||0;'
+'if(!(amt>0&&pr>0&&qS&&qB))return;'
+'var lbl=go.textContent;go.__busy=1;go.disabled=true;go.textContent="Confirm in wallet\\u2026";'
+'var SDK=null;'
+'window.lxStellar().then(function(S){SDK=S;'
+'var sell=qS.native?S.Asset.native():new S.Asset(qS.code,qS.issuer);'
+'var buy=qB.native?S.Asset.native():new S.Asset(qB.code,qB.issuer);'
+'return fetch(QH+"/accounts/"+addr).then(function(r){return r.json();}).then(function(acc){'
+'var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"1000",networkPassphrase:S.Networks.PUBLIC});'
+'if(!qHas(qB))tb.addOperation(S.Operation.changeTrust({asset:buy}));'
+'tb.addOperation(S.Operation.manageSellOffer({selling:sell,buying:buy,amount:amt.toFixed(7),price:(+pr.toFixed(7)).toString()}));'
+'return window.lxSign(tb.setTimeout(180).build().toXDR(),S);});})'
+'.then(function(signed){return fetch(QH+"/transactions",{method:"POST",'
+'headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)})'
+'.then(function(r){return r.json();});})'
+'.then(function(resp){go.__busy=0;go.disabled=false;go.textContent=lbl;'
+'if(resp&&resp.successful){(window.lxToast||function(){})("Limit order placed.",false);'
+'var i=qEl(".lxq-amt");if(i)i.value="";var p2=qEl(".lxq-price");if(p2)p2.value="";qAuto=true;qSync();'
// the order exists now, so show the reader where it lives rather than leaving a cleared form
+'try{ if(window.__lxQOshow)window.__lxQOshow("orders"); }catch(_){}'
+'try{if(window.__lxQOloadOrders)window.__lxQOloadOrders(true);}catch(_){}'
+'try{qRefresh();}catch(_){}}'
+'else{(window.lxToast||function(){})("The order was not accepted. Nothing was placed.",true);}'
+'})'
+'.catch(function(){go.__busy=0;go.disabled=false;go.textContent=lbl;'
+'(window.lxToast||function(){})("Could not place the order.",true);});'
+'}'
+'function qRefresh(){var a=qAddr();if(!a)return Promise.resolve();'
+'return fetch(QH+"/accounts/"+a).then(function(r){return r.json();}).then(function(acc){'
+'var bals=((acc&&acc.balances)||[]).filter(function(b){return b.asset_type!=="liquidity_pool_shares";});'
+'if(!bals.length)return;'
+'QBAL=bals.map(qMap);'
+'try{var nb=bals.filter(function(b){return b.asset_type==="native";})[0];'
+'window.__lxNative=+(nb&&nb.balance)||0;'
+'var _sub=+acc.subentry_count||0,_spon=(+acc.num_sponsoring||0)-(+acc.num_sponsored||0);'
+'var _res=(2+_sub+_spon)*0.5,_sl=+(nb&&nb.selling_liabilities)||0;'
+'window.__lxMaxXLM=Math.max(0,(window.__lxNative||0)-_res-_sl-0.001);'
+'window.__lxAssets=window.__lxAssets||{};'
+'bals.forEach(function(b){if(b.asset_code&&b.asset_issuer)window.__lxAssets[b.asset_code]=b.asset_issuer;});'
+'window.__lxHoldings=bals.filter(function(b){return b.asset_type==="native"||+b.balance>0;}).map(function(b){'
+'var nat=(b.asset_type==="native");return{code:nat?"XLM":b.asset_code,iss:nat?"":(b.asset_issuer||""),bal:+b.balance,native:nat};'
+'}).filter(function(h){return h.code;}).sort(function(x,y){return (y.native?1:0)-(x.native?1:0)||y.bal-x.bal;});'
+'if(window.__lxDashHoldings)window.__lxDashHoldings();}catch(_){}'
+'try{qSync();}catch(_){}'
+'try{if(window.__lxQOloadOrders)window.__lxQOloadOrders(true);}catch(_){}'
+'}).catch(function(){});}'
+'window.__lxQORefresh=qRefresh;'
+'window.__lxQOlimit=function(){qBuildUi();qSync();qIcons().then(function(){qSync();});qLoadBal().then(function(){qSync();});};'

// ---------------- Orders tab ----------------
// Every open offer on the account, not just this modal's -- Horizon returns them for all pairs, and an
// order placed on Trade-Asset is the same kind of object, so it belongs in the same list. Cancelling is
// the same operation that created it with amount 0 and the original offerId, which is how Stellar
// deletes an offer.
+'function qOEl(s){return document.querySelector("#swapModal .lxo-pane[data-pane=\\"orders\\"] "+s);}'
+'function qAsset(o){return (o&&o.asset_type==="native")?{code:"XLM",issuer:"",native:true}'
+':{code:(o&&o.asset_code)||"",issuer:(o&&o.asset_issuer)||"",native:false};}'
+'function qOrdersUi(){'
+'var pane=document.querySelector("#swapModal .lxo-pane[data-pane=\\"orders\\"]");if(!pane||pane.__b)return;pane.__b=1;'
+'pane.innerHTML=\'<div class="lxo-list"><div class="lxo-empty">Loading\\u2026</div></div>\';'
+'pane.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("[data-off]"):null;'
+'if(!b)return;e.preventDefault();e.stopImmediatePropagation();qCancel(b);},true);'
+'}'
+'window.__lxQOloadOrders=function(){'
+'var list=qOEl(".lxo-list");if(!list)return;'
+'var addr=qAddr();'
+'if(!addr){list.innerHTML=\'<div class="lxo-empty">Connect a wallet<span class="sub">Your open orders across every pair will show here.</span></div>\';return;}'
+'qIcons().then(function(){return fetch(QH+"/accounts/"+addr+"/offers?limit=50&order=desc");})'
+'.then(function(r){return r.json();}).then(function(d){'
+'var recs=(d&&d._embedded&&d._embedded.records)||[];'
+'if(!recs.length){list.innerHTML=\'<div class="lxo-empty">No open orders<span class="sub">A limit order stays here until it fills or you cancel it.</span></div>\';return;}'
+'list.innerHTML="";'
// An order is three facts -- what leaves, what arrives, at what rate -- so the row states them as three
// labelled lines rather than one sentence of numbers. Both legs carry the asset's own mark, resolved the
// same way the pickers resolve theirs. Built with createElement: this row interpolates amounts and codes
// that come from the network, and none of it should ever be parsed as markup.
+'function qLeg(cap,a,amount){'
+'var col=document.createElement("div");col.className="lxo-col";'
+'var cp=document.createElement("div");cp.className="lxo-cap";cp.textContent=cap;'
+'var w=document.createElement("div");w.className="lxo-side";'
+'var ic=document.createElement("span");ic.className="lxq-ic";ic.setAttribute("data-lxc",a.code||"");'
+'ic.textContent=(a.code||"?").slice(0,2).toUpperCase();'
+'var _h=0,_cs=String(a.code||"?");for(var _i=0;_i<_cs.length;_i++)_h=(_h*31+_cs.charCodeAt(_i))%360;'
+'ic.style.setProperty("--lxfb","linear-gradient(135deg,hsl("+_h+",42%,38%),hsl("+((_h+26)%360)+",44%,26%))");'
+'var tx=document.createElement("div");tx.className="lxo-tx";'
+'var qty=document.createElement("div");qty.className="q";qty.textContent=qNum(amount);'
+'qty.title=qNum(amount)+" "+(a.code||"");'
+'var cd=document.createElement("div");cd.className="c";cd.textContent=a.code||"";'
+'tx.appendChild(qty);tx.appendChild(cd);w.appendChild(ic);w.appendChild(tx);'
+'col.appendChild(cp);col.appendChild(w);'
+'try{ qPaintIco(ic,a); }catch(_){}'
+'return col;}'
+'recs.forEach(function(o){'
+'var s=qAsset(o.selling),b=qAsset(o.buying);'
// give each leg whatever artwork we already hold, so the marks match the rest of the modal
+'[s,b].forEach(function(a){ if(a.native)return;'
+'for(var i=0;i<QCUR.length;i++){ if(QCUR[i].code===a.code&&QCUR[i].issuer===a.issuer){a.img=QCUR[i].img;a.dom=QCUR[i].dom;a.v=1;break;} }'
+'if(!a.img&&QICO&&QICO[a.code+"-"+a.issuer])a.img=QICO[a.code+"-"+a.issuer]; });'
+'var amt=+o.amount||0,pr=+o.price||0;'
+'var row=document.createElement("div");row.className="lxo-o";'
+'var top=document.createElement("div");top.className="lxo-top";'
+'var legS=qLeg("Selling",s,amt),legB=qLeg("Receive",b,amt*pr);'
+'top.appendChild(legS);top.appendChild(legB);'
+'var ft=document.createElement("div");ft.className="lxo-ft";'
+'var pw=document.createElement("div");pw.className="lxo-pw";'
+'var pk=document.createElement("span");pk.className="lxo-k";pk.textContent="Price";'
+'var pn=document.createElement("span");pn.className="lxo-px";'
+'pn.textContent=qNum(pr)+" "+b.code+" per "+s.code;'
+'pn.title=pn.textContent;'
+'pw.appendChild(pk);pw.appendChild(pn);ft.appendChild(pw);'
+'row.appendChild(top);row.appendChild(ft);'
// An offer record carries no home domain, so an asset outside our manifest and the curated five has
// nothing to paint from. Ask stellar.expert once per unknown asset -- an order list is a handful of
// rows, and the answer is cached for the session -- then fill the mark in when it lands.
+'[[s,legS],[b,legB]].forEach(function(pair){'
+'var a=pair[0],el=pair[1]?pair[1].querySelector(".lxq-ic"):null;'
+'if(!a||!el||a.native||a.img)return;'
+'var k=a.code+"|"+a.issuer;'
+'if(QUSD["art:"+k]!==undefined){ if(QUSD["art:"+k]){a.img=QUSD["art:"+k];qPaintIco(el,a);} return; }'
+'fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(a.issuer)+"&limit=20")'
+'.then(function(r){return r.json();}).then(function(dd){'
+'var rr=((dd&&dd._embedded&&dd._embedded.records)||[]).filter(function(x){'
+'return String(x.asset||"").indexOf(a.code+"-"+a.issuer)===0;})[0];'
+'var ti=(rr&&(rr.tomlInfo||rr.toml_info))||{};var im=ti.image||ti.orgLogo||"";'
+'QUSD["art:"+k]=im; if(im){a.img=im;qPaintIco(el,a);}'
+'}).catch(function(){QUSD["art:"+k]="";});});'
+'var cb=document.createElement("button");cb.type="button";cb.setAttribute("data-off",String(o.id));'
+'cb.textContent="Cancel";ft.appendChild(cb);'
// the row carries everything the cancel needs, so it never has to be looked up again
+'var btn=cb;'
+'btn.__o={id:String(o.id),s:s,b:b,price:String(o.price||"1")};'
+'list.appendChild(row);});'
+'}).catch(function(){list.innerHTML=\'<div class="lxo-empty">Could not load your orders.</div>\';});'
+'};'
+'function qCancel(btn){'
+'var o=btn.__o;if(!o||btn.__busy)return;'
+'var addr=qAddr();if(!addr)return;'
+'btn.__busy=1;btn.disabled=true;var lbl=btn.textContent;btn.textContent="Confirm\\u2026";'
+'window.lxStellar().then(function(S){'
+'var sell=o.s.native?S.Asset.native():new S.Asset(o.s.code,o.s.issuer);'
+'var buy=o.b.native?S.Asset.native():new S.Asset(o.b.code,o.b.issuer);'
+'return fetch(QH+"/accounts/"+addr).then(function(r){return r.json();}).then(function(acc){'
+'var tb=new S.TransactionBuilder(new S.Account(addr,acc.sequence),{fee:"1000",networkPassphrase:S.Networks.PUBLIC});'
// amount 0 + the original offerId deletes it; price is required but irrelevant at amount 0
+'tb.addOperation(S.Operation.manageSellOffer({selling:sell,buying:buy,amount:"0",price:o.price,offerId:o.id}));'
+'return window.lxSign(tb.setTimeout(180).build().toXDR(),S);});})'
+'.then(function(signed){return fetch(QH+"/transactions",{method:"POST",'
+'headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)})'
+'.then(function(r){return r.json();});})'
+'.then(function(resp){btn.__busy=0;btn.disabled=false;btn.textContent=lbl;'
+'if(resp&&resp.successful){(window.lxToast||function(){})("Order cancelled.",false);window.__lxQOloadOrders();}'
+'else{(window.lxToast||function(){})("The cancel was not accepted. The order is still open.",true);}})'
+'.catch(function(){btn.__busy=0;btn.disabled=false;btn.textContent=lbl;'
+'(window.lxToast||function(){})("Could not cancel the order.",true);});'
+'}'
+'window.__lxQOorders=function(){qOrdersUi();window.__lxQOloadOrders();};'
+'})();</script>';

const SCRIPT='<script id="lx-swapcalc">(function(){'+'var SWSU="'+SW_STELLAR_URI+'",SWLL="'+SW_LUMOS_LOGO+'";'+''
+'function fmt(x){if(!isFinite(x))return "0";'
// #39: below 1e-5 spell the zero-run as a subscript count, the convention every exchange uses -- the
// same treatment and the same threshold as the asset page's smallNum, so a price reads identically in
// both places. Display only; see plain7 below for what goes into the field.
+'x=+x||0;'
+'if(x>0&&x<1e-4){var e=x.toExponential(3),i=e.indexOf("e");'
+'if(i>0){var mant=e.slice(0,i).replace(/0+$/,"").replace(/\\.$/,"").split(".").join("");'
+'var exp=-parseInt(e.slice(i+1),10);'
+'if(exp>=5){var sub="",d=String(exp-1);'
+'for(var z=0;z<d.length;z++)sub+=String.fromCharCode(8320+ +d.charAt(z));'
+'return "0.0"+sub+mant;}}}'
+'return x.toLocaleString("en-US",{maximumFractionDigits:7});}'
// A number the amount FIELD can hold: fixed precision, never exponential, padding trimmed.
+'function plain7(n){n=+n||0;if(!isFinite(n)||n<=0)return "0";'
+'var t=n.toFixed(7).replace(/0+$/,"").replace(/\\.$/,"");return t||"0";}'
+'function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return c==="&"?"&amp;":c==="<"?"&lt;":"&gt;";});}'
+'function swAbbr(n){n=+n||0;var a=Math.abs(n);if(a>=1e12)return (n/1e12).toFixed(2)+"T";if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3&&a<1e5)return fmt(n);if(a>=1e5)return (n/1e3).toFixed(1)+"K";return fmt(n);}'
+'function lastNum(t){var m=(t||"").match(/[0-9.]+/g);return m&&m.length?parseFloat(m[m.length-1]):NaN;}'
+'function panelHTML(){var p=document.createElement("div");p.className="lx-swapd";p.style.display="none";p.innerHTML='+ROWS+';return p;}'
+'function setter(panel){return function(k,v){var el=panel.querySelector(\'[data-k="\'+k+\'"]\');if(el)el.innerHTML=v;};}'
+'function calc(set,panel,amt,rate,fSym,tSym){'
+'if(amt>0&&isFinite(rate)){var fr=(window.__lxFeeRate||0.002),fee=amt*fr,out=(amt-fee)*rate,slip=0.5,minR=out*(1-slip/100);'
+'var piPct=Math.min(2.5,out*0.00002);var piTxt=piPct<0.01?"&lt; 0.01%":piPct.toFixed(2)+"%";'
// toFixed(1) rounded the discounted 0.1% tier to "0.3%". The amount charged was always right; the LABEL
// misstated the rate, on the one line of the panel a user reads to check what they are paying. Two decimals,
// trailing zeros trimmed by hand -- no regex here, since a "\." inside this template literal is exactly how
// an escape gets lost on the way to the browser.
// Every figure the panel shows goes through here, so the exact value travels with the text it is
// rendered as. data-num is what the swap reads; the text is only for the person reading it.
+'function setNum(k,val,suffix){var el=panel.querySelector(\'[data-k="\'+k+\'"]\');if(!el)return;'
+'el.textContent=fmt(val)+(suffix?(" "+suffix):"");el.setAttribute("data-num",String(val));}'
+'function readNum(el,fallbackText){if(!el)return 0;'
+'var d=el.getAttribute&&el.getAttribute("data-num");'
+'if(d!==null&&d!==undefined&&d!=="" &&isFinite(+d))return +d;'
+'return parseFloat(String(fallbackText||"").replace(/[^0-9.]/g,""))||0;}'
+'function pctTxt(v){var t=(+v).toFixed(2);while(t.length&&t.charAt(t.length-1)==="0")t=t.slice(0,-1);if(t.charAt(t.length-1)===".")t=t.slice(0,-1);return t;}'
+'set("feelbl","Swap fee ("+pctTxt(fr*100)+"%)");'
+'set("feenote",fr<=0.001?\'<div class="lx-fee-banner holder"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>You qualify for 0.1% trading fees</b> \u2014 50% Discount</span></div>\':\'<div class="lx-fee-banner nudge"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>50% off trading fees</b> \u2014 hold 250,000 <a class="lx-fee-buy" href="/lumos/stellar">LUMOS</a></span></div>\');'
+'set("rate","1 "+fSym+" \\u2248 "+fmt(rate)+" "+tSym);set("slip",slip+"%");set("fee",fmt(fee)+" "+fSym);'
+'set("net","~0.00001 "+fSym);set("pi",piTxt);var pe=panel.querySelector(\'[data-k="pi"]\');if(pe)pe.style.color=piPct<0.5?"var(--green,#35c07f)":"var(--yellow,#ffb547)";'
+'setNum("min",minR,tSym);panel.style.display="";}else{panel.style.display="none";}}'
// real swap: pathPaymentStrictSend (send From, receive To to self via best DEX path), signed by the connected wallet
+'var LXKNOWN={USDC:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",yUSDC:"GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF",AQUA:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"};'
+'var LX_FEE_COLLECTOR="GAMZFXIJD5E3PNRFCG6VPXCJNUOZAP5BY2P3MU3ZXXUSVM2UY5P6LJKD";'
+'window.__lxKnownSwap=window.__lxKnownSwap||{};function lxIssuer(sym){return (window.__lxAssets||{})[sym]||window.__lxKnownSwap[sym]||LXKNOWN[sym]||"";}'
+'function lxAssetOf(S,sym){if(!sym||sym==="XLM")return S.Asset.native();var iss=lxIssuer(sym);if(!iss)throw new Error("Cannot resolve "+sym+" issuer \\u2014 add it to your wallet first");return new S.Asset(sym,iss);}'
// AUDIT #6 (FUNDS): lxIssuer() resolves by TICKER and lets the wallet's own trustlines (__lxAssets) outrank the
// issuer the user actually picked, so a swap could execute against a same-ticker token from a DIFFERENT issuer.
// When the caller knows the selected issuer it must win. Falls back to lxIssuer only when none was supplied.
+'function lxAssetPick(S,sym,iss){if(!sym||sym==="XLM")return S.Asset.native();var i=iss||lxIssuer(sym);if(!i)throw new Error("Cannot resolve "+sym+" issuer \\u2014 add it to your wallet first");return new S.Asset(sym,i);}'
// ---- Soroswap aggregator (Aquarius/Aqua + Phoenix + Soroswap + SDEX) for best-rate "smart swap" routing ----
+'var LX_SORO="/lxapi/soroswap";'   /* key lives in a Cloudflare secret now, never in the page */
+'function soroHeaders(){return {"Content-Type":"application/json"};}'
+'var _sacCache={};function sacOf(S,code,iss,native){var k=native?"native":(code+":"+iss);if(_sacCache[k])return _sacCache[k];var a=native?S.Asset.native():new S.Asset(code,iss);var c=a.contractId(S.Networks.PUBLIC);_sacCache[k]=c;return c;}'
+'function soroQuote(fa,ta,amtStroops){return window.lxStellar().then(function(S){var faN=fa.native||fa.code==="XLM",taN=ta.native||ta.code==="XLM";var ai,ao;try{ai=sacOf(S,fa.code,fa.iss||lxIssuer(fa.code),faN);ao=sacOf(S,ta.code,ta.iss||lxIssuer(ta.code),taN);}catch(e){return null;}return fetch(LX_SORO+"/quote?network=mainnet",{method:"POST",headers:soroHeaders(),body:JSON.stringify({assetIn:ai,assetOut:ao,amount:String(amtStroops),tradeType:"EXACT_IN",protocols:["sdex","soroswap","phoenix"],slippageBps:50})}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(!j||!j.amountOut)return null;var route=(j.routePlan||[]).map(function(x){return {p:(x.swapInfo&&x.swapInfo.protocol)||"",pct:x.percent};});var usesSoroban=route.some(function(x){return x.p==="aqua"||x.p==="soroswap"||x.p==="phoenix";});return {out:+j.amountOut/1e7,impact:parseFloat(j.priceImpactPct||"0"),quote:j,route:route,usesSoroban:usesSoroban,usesAqua:route.some(function(x){return x.p==="aqua";})};}).catch(function(){return null;});});}'
+'function soroBuild(quote,from){return fetch(LX_SORO+"/quote/build?network=mainnet",{method:"POST",headers:soroHeaders(),body:JSON.stringify({quote:quote,from:from,to:from})}).then(function(r){return r.json();}).then(function(j){if(j&&j.xdr)return j.xdr;var m=(j&&(j.message||j.error))||"Could not build swap";if(/poolHash/i.test(m))m="Aquarius routing is view-only for now (router build pending) \\u2014 this rate is not yet executable";throw new Error(m);});}'
+'function soroSend(signedXdr){return fetch(LX_SORO+"/send?network=mainnet",{method:"POST",headers:soroHeaders(),body:JSON.stringify({xdr:signedXdr})}).then(function(r){return r.json();}).then(function(j){if(j&&(j.success||j.txHash))return j;var x=j&&(j.message||j.error||(j.result&&j.result.error));throw new Error(x||"Swap submit failed");});}'
// execute a Soroswap best-rate swap: build unsigned XDR -> sign with the connected wallet -> submit via Soroswap
// ensure the connected wallet trusts tSym; if not, sign+submit a changeTrust tx first (its own signature),
// then resolve. Used before Soroswap swaps (Soroswap's XDR assumes the trustline already exists). Classic
// lxSwap adds its trustline inline, so it does NOT need this.
+'function ensureTrust(tSym){if(!tSym||tSym==="XLM"||(window.__lxAssets||{})[tSym])return Promise.resolve(false);var ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}if(!ME)return Promise.reject(new Error("No wallet connected"));var H="https://horizon.stellar.org";return window.lxStellar().then(function(S){var iss=lxIssuer(tSym);if(!iss)throw new Error("Cannot resolve "+tSym+" issuer \\u2014 add it to your wallet first");var asset=new S.Asset(tSym,iss);return fetch(H+"/accounts/"+ME).then(function(r){return r.json();}).then(function(acc){var tb=new S.TransactionBuilder(new S.Account(ME,acc.sequence),{fee:"1000",networkPassphrase:S.Networks.PUBLIC}).addOperation(S.Operation.changeTrust({asset:asset})).setTimeout(120).build();return window.lxTimeout(window.lxSign(tb.toXDR(),S),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){if(!signed)throw new Error("Trustline signing cancelled");return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();}).then(function(res){if(res&&(res.successful||res.hash)){(window.__lxAssets=window.__lxAssets||{})[tSym]=iss;return true;}var x=res&&res.extras&&res.extras.result_codes;throw new Error(x?("Trustline failed: "+JSON.stringify(x)):"Trustline failed");});});});});}'
+'function soroExecute(soro){var ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}if(!ME)return Promise.reject(new Error("No wallet connected"));return soroBuild(soro.quote,ME).then(function(xdr){return window.lxStellar().then(function(S){return window.lxTimeout(window.lxSign(xdr,S),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){if(!signed)throw new Error("Signing cancelled");return soroSend(signed);});});});}'
// "Learn more" popover on the smart-swap badge (one delegated listener)
+'(function(){if(window.__lxSmartInfoWired)return;window.__lxSmartInfoWired=1;document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("[data-lx-smartinfo]"):null;var open=document.querySelector(".lx-smart-info");if(open)open.remove();if(!a)return;e.preventDefault();e.stopPropagation();var pop=document.createElement("div");pop.className="lx-smart-info";pop.innerHTML=\'<h5>\\u26a1 Smart Swap</h5><p>LumosCore checks Soroban AMMs (Soroswap, Phoenix) alongside the classic Stellar order book and automatically routes your swap through whichever returns the most \\u2014 at no extra cost.</p>\';document.body.appendChild(pop);var r=a.getBoundingClientRect();var top=r.bottom+8;if(top+150>window.innerHeight)top=Math.max(10,r.top-158);pop.style.top=top+"px";pop.style.left=Math.max(10,Math.min(r.left-40,window.innerWidth-302))+"px";},true);})();'
// fIss/tIss = the issuers the USER selected in the picker. When present they take precedence over lxIssuer().
+'function lxSwap(fSym,tSym,amount,minOut,fIss,tIss){var H="https://horizon.stellar.org",ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}'
+'return window.lxStellar().then(function(S){var send=lxAssetPick(S,fSym,fIss),dest=lxAssetPick(S,tSym,tIss);var _fr=(window.__lxFeeRate||0.002);var _fee=+(amount*_fr).toFixed(7);var _net=+(amount-_fee).toFixed(7);if(!(_net>0))throw new Error("Amount too small after fee");'
+'var _fI=(fSym&&fSym!=="XLM")?(fIss||lxIssuer(fSym)):"";var _tI=(tSym&&tSym!=="XLM")?(tIss||lxIssuer(tSym)):"";'
+'var srcP=(!fSym||fSym==="XLM")?"source_asset_type=native":("source_asset_type=credit_alphanum"+(fSym.length>4?"12":"4")+"&source_asset_code="+fSym+"&source_asset_issuer="+_fI);'
+'var dstP=(!tSym||tSym==="XLM")?"destination_assets=native":("destination_assets="+encodeURIComponent(tSym+":"+_tI));'
+'return fetch(H+"/paths/strict-send?"+srcP+"&source_amount="+_net.toFixed(7)+"&"+dstP).then(function(r){return r.json();}).then(function(pd){var recs=(pd._embedded&&pd._embedded.records)||[];var _freshOut=recs.length?parseFloat(recs[0].destination_amount):0;var path=recs.length?recs[0].path.map(function(a){return a.asset_type==="native"?S.Asset.native():new S.Asset(a.asset_code,a.asset_issuer);}):[];'
// for a non-native From asset, find a path to convert the fee into XLM so the fee always lands as XLM in the collector (which only trusts XLM)
+'var _feeXlmP=(!fSym||fSym==="XLM")?Promise.resolve(null):fetch(H+"/paths/strict-send?"+srcP+"&source_amount="+_fee.toFixed(7)+"&destination_assets=native").then(function(r){return r.json();}).catch(function(){return null;});'
+'return Promise.all([fetch(H+"/accounts/"+ME).then(function(r){return r.json();}),fetch(H+"/accounts/"+LX_FEE_COLLECTOR).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),_feeXlmP]).then(function(_pa){var acc=_pa[0],_collAcc=_pa[1],_feePd=_pa[2],_collExists=!!_collAcc;'
// AUDIT #5 (FUNDS): destMin was _freshOut*(1-_fr-0.01). _freshOut is ALREADY the post-fee quote (the path is
// priced on _net), so subtracting _fr again double-charged the fee and the extra 0.01 added a 1% pad — the real
// slippage floor was ~1.5% while the UI promised 0.5%. And when no path was found it fell back to 1 stroop,
// i.e. UNLIMITED slippage, and still submitted. Now: honour the quoted 0.5%, and refuse to submit with no route.
+'if(!(_freshOut>0))throw new Error("No route found for this swap right now \\u2014 try a different amount or pair.");'
+'var _slip=0.005;var dm=Math.max(0.0000001,_freshOut*(1-_slip)).toFixed(7);'
+'var needTrust=(tSym&&tSym!=="XLM"&&!(window.__lxAssets||{})[tSym]);'
+'var tb2=new S.TransactionBuilder(new S.Account(ME,acc.sequence),{fee:"100",networkPassphrase:S.Networks.PUBLIC});'
+'if(needTrust)tb2.addOperation(S.Operation.changeTrust({asset:dest}));'
// main swap FIRST (gets full liquidity, meets destMin), then the fee conversion on the remainder — avoids the fee op starving the swap on thin books
+'tb2.addOperation(S.Operation.pathPaymentStrictSend({sendAsset:send,sendAmount:_net.toFixed(7),destination:ME,destAsset:dest,destMin:dm,path:path}));'
+'if(_fee>0&&_collExists){if(!fSym||fSym==="XLM"){tb2.addOperation(S.Operation.payment({destination:LX_FEE_COLLECTOR,asset:send,amount:_fee.toFixed(7)}));}else{var _frecs=(_feePd&&_feePd._embedded&&_feePd._embedded.records)||[];if(_frecs.length){var _fpath=(_frecs[0].path||[]).map(function(a){return a.asset_type==="native"?S.Asset.native():new S.Asset(a.asset_code,a.asset_issuer);});tb2.addOperation(S.Operation.pathPaymentStrictSend({sendAsset:send,sendAmount:_fee.toFixed(7),destination:LX_FEE_COLLECTOR,destAsset:S.Asset.native(),destMin:"0.0000001",path:_fpath}));}}}'
+'var tx=tb2.setTimeout(180).build();'
+'return window.lxTimeout(window.lxSign(tx.toXDR(),S),150000,"Signing timed out \\u2014 open your wallet and try again").then(function(signed){if(!signed)throw new Error("Signing cancelled");return fetch(H+"/transactions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"tx="+encodeURIComponent(signed)}).then(function(r){return r.json();}).then(function(res){if(res&&(res.successful||res.hash))return res;var x=res&&res.extras&&res.extras.result_codes;throw new Error(x?("Swap: "+JSON.stringify(x)):"Submit failed");});});});});});}'
// ---- #swapModal (dashboard quick-action Swap): real held-asset picker + balances + live best-rate quote + execute ----
// The dashboard has no _walletdata, so bootstrap the swap globals (holdings, sign, SDK) it lacks, guarded so we
// never clobber the wallet page's own. Reuses the shared soroQuote/soroExecute/ensureTrust/lxSwap/calc helpers above.
+'function dashHeld(code,iss){var H=(window.__lxHoldings||[]);var h;'
+'if(iss){h=H.filter(function(x){return !x.native&&x.iss===iss&&x.code===code;})[0];if(h)return h.bal||0;}'
+'h=H.filter(function(x){return !x.native&&x.code===code;})[0];if(h)return h.bal||0;'
+'var lc=String(code||"").toLowerCase();'
+'h=H.filter(function(x){return !x.native&&String(x.code||"").toLowerCase()===lc;})[0];return h?(h.bal||0):0;}'
+'function dashBalOf(a){if(!a)return 0;if(a.native||a.code==="XLM")return (window.__lxMaxXLM!=null?window.__lxMaxXLM:(window.__lxNative||0));'
+'if(a.bal>0)return a.bal;'
+'return dashHeld(a.code,a.iss||a.issuer||"");}'
+'function dashLogo(a){if(!a)return "";if(a.native||a.code==="XLM")return window.__lxStellarUri||window.__lxDSTU||"";return a.logo||(window.__lxLogos||{})[a.code]||"";}'
+'var DSWCOL=["#6f5ded","#ff894c","#2bb673","#e0447b","#3aa0ff","#f5b301","#9b5de5","#00bbf9"];function dashCol(s){s=s||"?";var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return DSWCOL[h%DSWCOL.length];}'
+'function dashSetChip(logoEl,codeEl,a){if(codeEl)codeEl.textContent=a.code;if(!logoEl)return;var lg=dashLogo(a);logoEl.setAttribute("data-logo",a.code);logoEl.textContent="";logoEl.style.backgroundSize="contain";logoEl.style.backgroundPosition="center";logoEl.style.backgroundRepeat="no-repeat";if(lg){logoEl.style.setProperty("background-image","url("+JSON.stringify(lg)+")","important");logoEl.style.setProperty("background-color","transparent","important");}else{logoEl.style.setProperty("background-image","none","important");logoEl.style.setProperty("background-color",a.native?"#8b5cf6":dashCol(a.code),"important");logoEl.textContent=a.native?"\\u2726":(a.code||"?").slice(0,1).toUpperCase();}}'
// bootstrap wallet globals on the dashboard (idempotent; skips if the wallet page already provided them)
+'var __dashBooted=0;function dashBoot(){if(__dashBooted)return;__dashBooted=1;'
+'if(!window.lxTimeout)window.lxTimeout=function(p,ms,msg){return new Promise(function(res,rej){var d=0,to=setTimeout(function(){if(!d){d=1;rej(new Error(msg));}},ms);p.then(function(v){if(!d){d=1;clearTimeout(to);res(v);}},function(e){if(!d){d=1;clearTimeout(to);rej(e);}});});};'
+'if(!window.lxToast)window.lxToast=function(msg){try{if(typeof window.showToast==="function"){window.showToast(msg);return;}}catch(_){}try{var t=document.createElement("div");t.textContent=msg;t.style.cssText="position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1c1f27;color:#fff;border:1px solid rgba(255,255,255,.16);padding:10px 16px;border-radius:10px;font-size:13px;z-index:100002;box-shadow:0 10px 34px rgba(0,0,0,.45);max-width:82vw;text-align:center";document.body.appendChild(t);setTimeout(function(){t.style.transition="opacity .4s";t.style.opacity="0";setTimeout(function(){t.remove();},420);},2600);}catch(_){}};'
+'if(!window.lxStellar){var _sbP=null;window.lxStellar=function(){if(!_sbP)_sbP=new Promise(function(res,rej){if(window.StellarBase)return res(window.StellarBase);var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@stellar/stellar-base@13.0.1/dist/stellar-base.min.js";s.onload=function(){window.StellarBase?res(window.StellarBase):rej(new Error("Stellar SDK failed to load"));};s.onerror=function(){rej(new Error("Stellar SDK failed to load"));};document.head.appendChild(s);});return _sbP;};}'
+'if(!window.lxSign){window.lxSign=function(xdr,S){var w="";try{w=(localStorage.getItem("lumos.wallet")||"").toLowerCase();}catch(_){}var ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}var PP=S.Networks.PUBLIC;'
+'if(w==="freighter"){if(window.freighterApi&&window.freighterApi.signTransaction)return Promise.resolve(window.freighterApi.signTransaction(xdr,{networkPassphrase:PP,network:"PUBLIC",address:ME})).then(function(r){return (r&&(r.signedTxXdr||r.signedXDR))||r;});return import("https://esm.sh/@stellar/freighter-api@6").then(function(m){var f=m.default||m;return f.signTransaction(xdr,{networkPassphrase:PP,address:ME});}).then(function(r){return (r&&(r.signedTxXdr||r.signedXDR))||r;});}'
+'if(w==="rabet")return window.rabet.sign(xdr,"mainnet").then(function(r){return r.xdr;});'
+'if(w==="xbull")return window.xBullSDK.signXDR(xdr,{network:"PUBLIC",publicKey:ME}).then(function(r){return (r&&(r.signedXDR||r.xdr))||r;});'
+'if(w==="albedo")return import("https://esm.sh/@albedo-link/intent@0.12.0").then(function(m){var al=m.default||m.albedo||m;return al.tx({xdr:xdr,network:"public",pubkey:ME});}).then(function(r){return r.signed_envelope_xdr;});'
// A phone has no LOBSTR extension - that session signs over WalletConnect instead (transport=wc).
+'if((w==="lobstr"||w==="walletconnect")&&window.__lxWcActive&&window.__lxWcActive())return window.__lxWcSign(xdr,PP);'
+'if(w==="lobstr")return import("https://esm.sh/@lobstrco/signer-extension-api").then(function(m){var s=m.signTransaction||(m.default&&m.default.signTransaction);return s(xdr);}).then(function(r){return (r&&r.signedTransaction)||r;});'
+'return Promise.reject(new Error("Reconnect your Stellar wallet to sign (unsupported: "+(w||"none")+")"));};}'
+'var ME="";try{ME=localStorage.getItem("lumos.address")||"";}catch(_){}if(!ME)return;var H="https://horizon.stellar.org";'
+'fetch(H+"/accounts/"+ME).then(function(r){return r.json();}).then(function(acc){if(!acc||!acc.balances)return;var bals=acc.balances;var nb=bals.filter(function(b){return b.asset_type==="native";})[0];window.__lxNative=+(nb&&nb.balance)||0;window.__lxAssets=window.__lxAssets||{};bals.forEach(function(b){if(b.asset_code&&b.asset_issuer)window.__lxAssets[b.asset_code]=b.asset_issuer;});var _LI=window.__lxLumosIssuer||"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S";var lum=bals.filter(function(b){return b.asset_code==="LUMOS"&&b.asset_issuer===_LI;}).reduce(function(s,b){return s+(+b.balance||0);},0);if(window.__lxFeeTierSet)window.__lxFeeTierSet(lum);else{window.__lxLumosBal=lum;window.__lxFeeRate=lum>=250000?0.001:0.002;}var _sub=+acc.subentry_count||0,_spon=(+acc.num_sponsoring||0)-(+acc.num_sponsored||0),_res=(2+_sub+_spon)*0.5,_sl=+(nb&&nb.selling_liabilities)||0;window.__lxMaxXLM=Math.max(0,(window.__lxNative||0)-_res-_sl-0.001);window.__lxHoldings=bals.filter(function(b){return b.asset_type!=="liquidity_pool_shares"&&(b.asset_type==="native"||+b.balance>0);}).map(function(b){var nat=b.asset_type==="native";return{code:nat?"XLM":b.asset_code,iss:nat?"":(b.asset_issuer||""),bal:+b.balance,native:nat};}).filter(function(h){return h.code;}).sort(function(a,b){return (b.native?1:0)-(a.native?1:0)||b.bal-a.bal;});if(window.__lxDashHoldings)window.__lxDashHoldings();}).catch(function(){});}'
+'function bootA(){var modal=document.getElementById("swapModal");if(!modal)return true;if(modal.__lxd)return true;'
+'var inp=document.getElementById("swapAmtIn"),swapFrom=document.getElementById("swapFrom"),swapTo=document.getElementById("swapTo");if(!inp||!swapFrom||!swapTo)return true;modal.__lxd=1;dashBoot();'
+'var out=document.getElementById("swapAmtOut"),rateEl=document.getElementById("swapRate"),go=document.getElementById("swapGo"),flip=document.getElementById("swapFlip");'
+'var payChip=swapFrom.parentElement,recChip=swapTo.parentElement,payLogo=payChip.children[0],recLogo=recChip.children[0];'
+'var payCard=payChip.parentElement.parentElement,recCard=recChip.parentElement.parentElement;'
// capture the design\'s default XLM/Stellar glyph so XLM keeps a real logo
+'try{var _bg0=getComputedStyle(payLogo).backgroundImage;if(_bg0&&_bg0.indexOf("url(")>=0&&_bg0.indexOf("gradient")<0)window.__lxDSTU=_bg0.replace(/^url\\((["\\x27]?)/,"").replace(/(["\\x27]?)\\)$/,"");}catch(_){}'
+'var fromA={code:"XLM",iss:"",native:true,bal:null},toA={code:"USDC",iss:lxIssuer("USDC"),native:false,bal:null};'
+'var spotRate=null,qseq=0,qtmr=null,useSoro=null;'
+'var panel=panelHTML();var set=setter(panel);if(go&&go.parentNode)go.parentNode.insertBefore(panel,go);'
+'var errEl=document.createElement("div");errEl.className="lx-swap-err";errEl.style.display="none";if(go&&go.parentNode)go.parentNode.insertBefore(errEl,go);'
+'function showErr(m){if(m){errEl.textContent=m;errEl.style.display="block";}else{errEl.style.display="none";errEl.textContent="";}}'
+'function dis(b){if(!go)return;if(b){go.setAttribute("data-lxdis","1");}else{go.removeAttribute("data-lxdis");}}'
+'function mkBal(card){var lbl=card&&card.children[0];if(!lbl)return null;lbl.style.display="flex";lbl.style.justifyContent="flex-start";lbl.style.alignItems="center";lbl.style.gap="8px";var b=document.createElement("span");b.className="lx-dbal";b.style.cssText="font-size:12px;color:var(--text-muted,#8b90a0);font-weight:600;margin-left:auto";lbl.appendChild(b);return b;}'
+'var payBal=mkBal(payCard),recBal=mkBal(recCard);'
// The wallet's swap has a Max next to the balance; this modal showed the balance but gave no way to use it,
// so "swap everything" meant typing a 7-decimal number by hand. Same button, same class, same rule: XLM uses
// the SPENDABLE figure (__lxMaxXLM keeps the account reserve back) so Max can never build an underfunded tx.
+'if(payBal&&!payBal.__lxmax){payBal.__lxmax=1;var dmx=document.createElement("button");dmx.type="button";dmx.className="lx-swapmax";dmx.textContent="Max";payBal.parentNode.appendChild(dmx);'
+'dmx.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var bal=dashBalOf(fromA);if(!(bal>0))return;inp.value=plain7(Math.floor(bal*1e7)/1e7);'
+'try{inp.dispatchEvent(new Event("input",{bubbles:true}));}catch(_){run(false);}});}'
+'function refreshBal(){if(payBal)payBal.textContent="Balance: "+swAbbr(dashBalOf(fromA))+" "+fromA.code;if(recBal){var has=toA.native||toA.bal!=null||dashHeld(toA.code)>0;recBal.textContent=has?("Balance: "+swAbbr(dashBalOf(toA))+" "+toA.code):"";}}'
+'[[payChip,"from"],[recChip,"to"]].forEach(function(pr){var c=pr[0];c.classList.add("lx-dchip");c.setAttribute("data-lx-noswap","");if(!c.querySelector(".lx-dcaret")){var cv=document.createElement("span");cv.className="lx-dcaret";cv.innerHTML=\'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\';c.appendChild(cv);}c.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();openMenu(pr[1]);},true);});'
+'function applyChips(){dashSetChip(payLogo,swapFrom,fromA);dashSetChip(recLogo,swapTo,toA);refreshBal();}'
+'function dxAP(role,a){if(!a.code||a.code==="XLM")return role+"_asset_type=native";return role+"_asset_type=credit_alphanum"+(a.code.length>4?"12":"4")+"&"+role+"_asset_code="+a.code+"&"+role+"_asset_issuer="+(a.iss||lxIssuer(a.code));}'
+'function dxDest(a){return "destination_assets="+encodeURIComponent((!a.code||a.code==="XLM")?"native":(a.code+":"+(a.iss||lxIssuer(a.code))));}'
+'function dxSrc(a){return "source_assets="+encodeURIComponent((!a.code||a.code==="XLM")?"native":(a.code+":"+(a.iss||lxIssuer(a.code))));}'
// Two assets can share a code (there are dozens of "USDC"s), so the picker has to say WHICH one: the
// home domain when the issuer publishes one, and always the shortened issuer key as the tiebreaker.
+'function swAbbrK(n){n=+n||0;var a=Math.abs(n);if(a>=1e9)return (n/1e9).toFixed(2)+"B";if(a>=1e6)return (n/1e6).toFixed(2)+"M";if(a>=1e3)return (n/1e3).toFixed(2)+"K";return fmt(n);}'
+'function _amSub(a){if(!a||a.native||a.code==="XLM")return "Stellar native";var k=a.iss||"";var sk=k?(k.slice(0,4)+"\u2026"+k.slice(-4)):"";return a.dom?(a.dom+(sk?(" \u00b7 "+sk):"")):sk;}'
+'function menuItem(a){var b=document.createElement("button");b.type="button";b.className="lx-am-item";b.setAttribute("data-lx-noswap","");var lg=dashLogo(a);var ic=lg?(\'<span class="lx-am-ic"><img src="\'+esc(lg)+\'"></span>\'):(\'<span class="lx-am-ic" style="background:\'+(a.native?"#8b5cf6":dashCol(a.code))+\'">\'+(a.native?"\\u2726":esc((a.code||"?").slice(0,1).toUpperCase()))+\'</span>\');b.innerHTML=ic+\'<span class="lx-am-txt"><span class="lx-am-code">\'+esc(a.code)+\'</span>\'+(_amSub(a)?(\'<span class="lx-am-sub">\'+esc(_amSub(a))+\'</span>\'):"")+\'</span>\'+((a.bal!=null)?\'<span style="margin-left:auto;font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-soft)">\'+swAbbrK(a.bal)+\'</span>\':"");return b;}'
+'function openMenu(which){var ex=document.querySelector(".lx-asset-menu");if(ex){ex.remove();return;}var chip=(which==="from")?payChip:recChip;var hs=(window.__lxHoldings||[]).slice();if(!hs.length)hs=[{code:"XLM",native:true,bal:(window.__lxNative||null)},{code:"USDC",iss:lxIssuer("USDC"),native:false,bal:null}];var menu=document.createElement("div");menu.className="lx-asset-menu lx-swap-menu";menu.setAttribute("data-lx-noswap","");var sw=document.createElement("div");sw.className="lx-am-searchwrap";var si=document.createElement("input");si.className="lx-am-search";si.placeholder=(which==="from"?"Search your assets\\u2026":"Search any Stellar asset\\u2026");sw.innerHTML=\'<svg class="lx-am-searchic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>\';sw.appendChild(si);menu.appendChild(sw);var list=document.createElement("div");list.className="lx-am-list";menu.appendChild(list);'
+'function fill(arr){list.innerHTML="";if(!arr.length){list.innerHTML=\'<div class="lx-am-empty">No matches</div>\';return;}var LXCAP=60,lxAll=arr.length;arr=arr.slice(0,LXCAP);arr.forEach(function(a){var b=menuItem(a);b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();menu.remove();pick(which,a);},true);list.appendChild(b);});if(lxAll>LXCAP){var lxn=document.createElement("div");lxn.className="lx-am-more";lxn.textContent="Showing "+LXCAP+" of "+lxAll+" \u2014 type to find the rest";list.appendChild(lxn);}}fill(hs);'
+'if(which==="from"){si.addEventListener("input",function(){var q=si.value.trim().toLowerCase();fill(q?hs.filter(function(h){return (h.code||"").toLowerCase().indexOf(q)>=0;}):hs);});}else{var tmr;si.addEventListener("input",function(){clearTimeout(tmr);var q=si.value.trim();if(!q){fill(hs);return;}tmr=setTimeout(function(){fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(q)+"&limit=12").then(function(r){return r.json();}).then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var arr=recs.map(function(rc){var p=(rc.asset||"").split("-");var ti=rc.tomlInfo||rc.toml_info||{};var lg=ti.image||ti.orgLogo||"";if(lg&&p[0]){window.__lxLogos=window.__lxLogos||{};window.__lxLogos[p[0]]=lg;}return{code:p[0],iss:p[1]||"",native:!p[1],bal:null,logo:lg,dom:(rc.domain||ti.orgName||"")};}).filter(function(x){return x.code&&x.iss;});fill(arr.length?arr:hs.filter(function(h){return h.code.toLowerCase().indexOf(q.toLowerCase())>=0;}));}).catch(function(){fill(hs.filter(function(h){return h.code.toLowerCase().indexOf(q.toLowerCase())>=0;}));});},260);});}'
+'document.body.appendChild(menu);var rc=chip.getBoundingClientRect();menu.style.position="fixed";menu.style.top=(rc.bottom+6)+"px";menu.style.left=Math.max(8,Math.min(rc.left,window.innerWidth-240))+"px";menu.style.zIndex="100001";si.focus();}'
+'document.addEventListener("click",function(e){if(!(e.target.closest&&(e.target.closest(".lx-asset-menu")||e.target.closest(".lx-dchip")))){var mm=document.querySelector(".lx-asset-menu");if(mm)mm.remove();}},true);'
+'function pick(which,a){if(a.iss&&a.code!=="XLM"){window.__lxKnownSwap=window.__lxKnownSwap||{};window.__lxKnownSwap[a.code]=a.iss;}if(!a.native&&a.bal==null){var hb=dashHeld(a.code);if(hb)a.bal=hb;}if(which==="from")fromA=a;else toA=a;if(fromA.code===toA.code){var d=(a.code==="XLM")?{code:"USDC",iss:lxIssuer("USDC"),native:false,bal:dashHeld("USDC")||null}:{code:"XLM",iss:"",native:true,bal:null};if(which==="from")toA=d;else fromA=d;}applyChips();inp.value&&inp.value.trim()?run(false):(out&&(out.textContent="0.00"),panel.style.display="none");spotRate=null;quoteRate();}'
+'function quoteRate(){var fa=fromA,ta=toA;fetch("https://horizon.stellar.org/paths/strict-send?"+dxAP("source",fa)+"&source_amount=1&"+dxDest(ta)).then(function(r){return r.json();}).then(function(pd){if(fromA!==fa||toA!==ta)return;var recs=(pd._embedded&&pd._embedded.records)||[];if(recs.length){var d=parseFloat(recs[0].destination_amount);if(isFinite(d)&&d>0){spotRate=d;if(rateEl)rateEl.textContent="1 "+fa.code+" \\u2248 "+fmt(d)+" "+ta.code;if((inp.value||"").trim())run(true);}}}).catch(function(){});}'
+'function run(preview){var raw=(inp.value||"");if(/[^0-9.,\\s]/.test(raw)){showErr("Enter a valid amount (numbers only)");dis(true);if(out)out.textContent="0.00";panel.style.display="none";useSoro=null;return;}var amt=parseFloat(raw.replace(/,/g,""))||0;var fa=fromA,ta=toA,fr=(window.__lxFeeRate||0.002),net=amt*(1-fr);if(!(amt>0)){if(out)out.textContent="0.00";showErr("");dis(true);panel.style.display="none";useSoro=null;return;}'
+'var bal=dashBalOf(fa);if(amt>bal+1e-9){showErr("Insufficient "+fa.code+" balance \\u2014 you have "+swAbbr(bal)+" "+fa.code);dis(true);}else{showErr("");dis(false);}'
+'if(!preview&&spotRate!=null&&spotRate>0){var o0=net*spotRate;if(out)out.textContent=fmt(o0);calc(set,panel,amt,o0/net,fa.code,ta.code);}'
+'var seq=++qseq;clearTimeout(qtmr);qtmr=setTimeout(function(){var netStroops=Math.round(net*1e7);Promise.all([fetch("https://horizon.stellar.org/paths/strict-send?"+dxAP("source",fa)+"&source_amount="+net.toFixed(7)+"&"+dxDest(ta)).then(function(r){return r.json();}).then(function(pd){var recs=(pd._embedded&&pd._embedded.records)||[];return recs.length?parseFloat(recs[0].destination_amount):NaN;}).catch(function(){return NaN;}),soroQuote(fa,ta,netStroops).catch(function(){return null;})]).then(function(res){if(seq!==qseq)return;var cout=res[0],soro=res[1];var classicOut=(isFinite(cout)&&cout>0)?cout:0;var pickSoro=soro&&soro.usesSoroban&&soro.out>0&&soro.out>classicOut*1.005&&(soro.impact||0)<10;if(pickSoro){useSoro={quote:soro.quote,out:soro.out,fa:fa,ta:ta};if(out)out.textContent=fmt(soro.out);calc(set,panel,amt,soro.out/net,fa.code,ta.code);}else{useSoro=null;if(classicOut>0){if(out)out.textContent=fmt(classicOut);calc(set,panel,amt,classicOut/net,fa.code,ta.code);}}}).catch(function(){});},280);}'
+'function dashRecord(resp,fa,ta,fromAmt,toAmt){var hash=(resp&&(resp.txHash||resp.hash))||"";if(!hash)return;var arr=[];try{arr=JSON.parse(localStorage.getItem("lumos.swaps")||"[]");}catch(_){}arr.unshift({hash:hash,from:fa.code,fromIss:fa.native?"":(fa.iss||lxIssuer(fa.code)),to:ta.code,toIss:ta.native?"":(ta.iss||lxIssuer(ta.code)),fromAmt:fromAmt,toAmt:toAmt,ts:new Date().toISOString()});try{localStorage.setItem("lumos.swaps",JSON.stringify(arr.slice(0,40)));}catch(_){}}'
+'inp.addEventListener("input",function(){run(false);});'
// The engine recomputes and rewrites this field constantly. While it has focus that would fight the
// person typing in it, so writes are dropped for exactly that window and resume on blur -- at which
// point the true figure from the executed path replaces the requested one.
+'if(out&&!out.__lxrev){out.__lxrev=1;'
+'out.setAttribute("contenteditable","true");out.setAttribute("inputmode","decimal");'
+'out.setAttribute("spellcheck","false");out.setAttribute("title","Type an amount to work backwards");'
+'try{var _tc=Object.getOwnPropertyDescriptor(Node.prototype,"textContent");'
+'Object.defineProperty(out,"textContent",{configurable:true,'
+'get:function(){return _tc.get.call(this);},'
+'set:function(v){ if(document.activeElement===this)return; _tc.set.call(this,v); }});}catch(_){}'
// Debounced: every keystroke would otherwise be a path query.
+'var _rvT=null;'
+'out.addEventListener("input",function(){'
+'clearTimeout(_rvT);'
+'_rvT=setTimeout(function(){ try{ revQuote(); }catch(_){} },380);'
+'});'
// Enter should commit rather than insert a newline into a number.
+'out.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); out.blur(); } });'
+'}'
+'function revQuote(){'
+'var want=parseFloat(String(out.textContent||"").replace(/[^0-9.]/g,""));'
+'if(!(want>0))return;'
+'var fa=fromA,ta=toA;'
+'var seq=++qseq;'
// strict-receive: what must be SENT to land exactly this much.
+'fetch("https://horizon.stellar.org/paths/strict-receive?"+dxAP("destination",ta)'
+'+"&destination_amount="+want+"&"+dxSrc(fa))'
+'.then(function(r){ return r.ok?r.json():null; })'
+'.then(function(d){'
+'if(seq!==qseq)return;'                       // a newer edit has already superseded this one
+'var recs=(d&&d._embedded&&d._embedded.records)||[];'
+'if(!recs.length){ showErr("No path to that amount right now"); return; }'
+'var best=null;'
+'recs.forEach(function(p){ var v=parseFloat(p.source_amount); if(v>0&&(best===null||v<best))best=v; });'
+'if(!(best>0))return;'
// The platform fee comes off the input, so the gross has to be larger than the path cost by exactly
// that share. __lxFeeRate is 0.002, or 0.001 while the account holds 250,000 LUMOS.
+'var fr=(typeof window.__lxFeeRate==="number"&&window.__lxFeeRate>0&&window.__lxFeeRate<=0.002)?window.__lxFeeRate:0.002;'
+'var gross=best/(1-fr);'
+'showErr("");'
+'inp.value=plain7(Math.ceil(gross*1e7)/1e7);'   // round UP: rounding down could under-deliver
+'try{ inp.dispatchEvent(new Event("input",{bubbles:true})); }catch(_){ run(false); }'
+'})'
+'.catch(function(){});'
+'}'
+'if(flip&&!flip.__lxf){flip.__lxf=1;flip.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var t=fromA;fromA=toA;toA=t;applyChips();inp.value="";if(out)out.textContent="0.00";spotRate=null;panel.style.display="none";useSoro=null;showErr("");dis(true);quoteRate();},true);}'
+'if(go&&!go.__lxswap){go.__lxswap=1;go.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==="function")e.stopImmediatePropagation();if(go.getAttribute("data-lxdis")==="1")return;var toast=window.lxToast||function(){};var amt=parseFloat((inp.value||"").replace(/,/g,""))||0;var fSym=fromA.code,tSym=toA.code;if(!(amt>0)){toast("Enter an amount to swap");return;}if(fSym===tSym){toast("Pick two different assets");return;}if(!window.lxStellar||!window.lxSign){toast("Still loading balances \\u2014 try again in a moment");return;}var _minEl=panel.querySelector(\'[data-k="min"]\');var minOut=readNum(_minEl,_minEl&&_minEl.textContent);var _exp=readNum(out,out&&out.textContent);if(_exp>0&&_exp<1e-7){toast("Too small to swap \u2014 you would receive less than 0.0000001 "+tSym+", the smallest amount Stellar can transfer");return;}var ot=go.textContent;go.setAttribute("data-lxdis","1");go.style.opacity="0.7";var needT=(useSoro&&tSym!=="XLM"&&!(window.__lxAssets||{})[tSym]);go.textContent=needT?("Adding "+tSym+" trustline\\u2026"):"Signing\\u2026";(needT?ensureTrust(tSym):Promise.resolve()).then(function(){go.textContent="Signing\\u2026";return useSoro?soroExecute(useSoro):lxSwap(fSym,tSym,amt,minOut,fromA.iss,toA.iss);}).then(function(resp){try{dashRecord(resp,fromA,toA,amt,parseFloat((out&&out.textContent||"").replace(/,/g,""))||0);}catch(_){}try{if(window.__lxFeeTierRefresh)window.__lxFeeTierRefresh();}catch(_){}useSoro=null;go.textContent="Swapped \\u2713";toast("Swapped "+amt+" "+fSym+" \\u2192 "+tSym);try{if(window.__lxQORefresh)window.__lxQORefresh();}catch(_){}setTimeout(function(){go.textContent=ot;go.style.opacity="";go.removeAttribute("data-lxdis");inp.value="";if(out)out.textContent="0.00";panel.style.display="none";var cl=modal.querySelector("[data-swapclose],.modal-close,[data-close],.close");if(cl){cl.click();}else{modal.classList.remove("open","show");modal.setAttribute("hidden","");}modal.style.display="none";document.body.style.overflow="";},1300);}).catch(function(err){go.textContent=ot;go.style.opacity="";go.removeAttribute("data-lxdis");toast((err&&err.message)||"Swap failed");});},true);}'
// re-apply once holdings arrive (dashBoot is async) + reset fields each time the modal opens
+'window.__lxDashHoldings=function(){if(toA.bal==null&&!toA.native)toA.bal=dashHeld(toA.code)||null;applyChips();quoteRate();if((inp.value||"").trim())run(false);};'
+'function resetFields(){inp.value="";if(out)out.textContent="0.00";showErr("");panel.style.display="none";useSoro=null;dis(true);if(!window.__lxHoldings)dashBoot();spotRate=null;quoteRate();}'
// the modal open/close may not touch THIS element\'s attributes (ancestor-driven), so the observer alone
// missed reopens and stale amounts persisted — ALSO reset whenever the dashboard "Swap tokens" quick-card
// is clicked (the only way this modal opens).
+'if(!modal.__lxQCw){modal.__lxQCw=1;document.addEventListener("click",function(e){var c=e.target&&e.target.closest&&e.target.closest(".quick-actions .quick-card");if(c&&/swap/i.test(c.textContent||"")){setTimeout(resetFields,120);[60,220,500].forEach(function(ms){setTimeout(shutTwin,ms);});}},true);}'
// The dashboard page carries TWO swap dialogs: this one (#swapModal, the wired one) and the design's own
// #modalSwap. The quick-action click reaches both openers, so a single tap stacked them — ours at z-index
// 9999 over the design's at 2500. Nothing looked wrong until the top one was dismissed, and then the user
// was staring at the design's untouched dialog: default XLM/USDC, no logos, none of their input. Whenever
// this dialog opens, make sure the other one is shut. Only pages carrying both are affected; the wallet
// page has no #swapModal, so its #modalSwap is never touched by this.
+'function shutTwin(){var tw=document.getElementById("modalSwap");if(!tw)return;tw.classList.remove("open","show");tw.style.display="none";try{document.body.style.overflow="";}catch(_){}}'
+'if(!modal.__lxReset){modal.__lxReset=1;new MutationObserver(function(){var op=/(^|\\s)(open|show|active)(\\s|$)/.test(modal.className)||!modal.hasAttribute("hidden")&&getComputedStyle(modal).display!=="none";if(op&&!modal.__wasOpen){modal.__wasOpen=1;shutTwin();resetFields();}else if(!op){modal.__wasOpen=0;}}).observe(modal,{attributes:true,attributeFilter:["class","hidden","style"]});}'
+'toA.bal=dashHeld("USDC")||null;applyChips();dis(true);quoteRate();return true;}'
// ---- #modalSwap (wallet quick-action Swap, class-based) ----
+'function bootB(){var modal=document.getElementById("modalSwap");if(!modal)return true;if(modal.__lxd)return true;'
+'var fields=modal.querySelectorAll(".swap-pair .field");if(fields.length<2)return true;modal.__lxd=1;'
+'var fromF=fields[0],toF=fields[1];var fromInput=fromF.querySelector("input"),toInput=toF.querySelector("input");if(!fromInput)return true;'
+'(function(){var lbl=fromF.querySelector(".field-label");if(!lbl||lbl.__lxmax)return;lbl.__lxmax=1;'
+'var mb=document.createElement("button");mb.type="button";mb.className="lx-swapmax lx-wsmax";'
+'mb.textContent="Max";mb.setAttribute("data-logo","");lbl.appendChild(mb);'
+'mb.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();'
+'var h=fromF.__lxasset;if(!h)return;'
+'var raw=h.native?(window.__lxNative||0):(h.bal!=null?h.bal:heldBal(h.code));'
+'var v=h.native?((window.__lxMaxXLM!=null)?window.__lxMaxXLM:raw):raw;'
+'if(!(v>0))return;'
+'fromInput.value=plain7(Math.floor(v*1e7)/1e7);'
+'try{fromInput.dispatchEvent(new Event("input",{bubbles:true}));}catch(_){}'
+'});})();'
+'function symOf(f){if(f.__lxsym)return f.__lxsym;var b=f.querySelector(".asset-pick");if(!b)return "TKN";for(var i=0;i<b.childNodes.length;i++){var nd=b.childNodes[i];if(nd.nodeType===3){var t=nd.textContent.trim();if(t)return t;}}return "TKN";}'
+'var sr=modal.querySelector(".swap-rate");var baseRate=0.4128;if(sr){var st=sr.querySelector("strong");if(st){var r=lastNum(st.textContent);if(r>0)baseRate=r;}sr.style.display="none";}'
+'var body=modal.querySelector(".modal-body");if(body){[].forEach.call(body.children,function(d){if(d!==sr&&d.tagName==="DIV"&&/Route|Network fee|Price impact/.test(d.textContent))d.style.display="none";});}'
+'var panel=panelHTML();var set=setter(panel);var pair=modal.querySelector(".swap-pair");if(pair&&pair.parentNode)pair.parentNode.insertBefore(panel,pair.nextSibling);'
+'var H="https://horizon.stellar.org";'
+'function realRate(a,c){var xu=window.__lxXlmUsd;if(!xu||xu<=0)return null;if(a==="XLM"&&c==="USDC")return xu;if(a==="USDC"&&c==="XLM")return 1/xu;return null;}'
+'var spotRate=null,qtmr=null,qseq=0,_confirm=null,rate=0,_review=null,_back=null,_summary=null;'
+'var errEl=document.createElement("div");errEl.className="lx-swap-err";errEl.style.display="none";if(panel&&panel.parentNode)panel.parentNode.insertBefore(errEl,panel);'
+'function showErr(m){if(!errEl)return;if(m){errEl.textContent=m;errEl.style.display="block";}else{errEl.style.display="none";errEl.textContent="";}}'
+'function setConfirm(ok){if(_confirm){_confirm.disabled=!ok;_confirm.style.opacity=ok?"":"0.55";_confirm.style.cursor=ok?"":"not-allowed";}if(_review){_review.disabled=!ok;_review.style.opacity=ok?"":"0.55";_review.style.cursor=ok?"":"not-allowed";}}'
+'function heldBal(code){var h=(window.__lxHoldings||[]).filter(function(x){return x.code===code&&!x.native;})[0];return h?(h.bal||0):0;}'
+'function fromBalOf(fa){if(!fa)return 0;if(fa.native||fa.code==="XLM")return (window.__lxMaxXLM!=null?window.__lxMaxXLM:(window.__lxNative||0));return (fa.bal!=null?fa.bal:heldBal(fa.code));}'
+'function checkBal(amt,fa){var bal=fromBalOf(fa);if(amt>bal+1e-9){showErr("Insufficient "+(fa.code||"")+" balance \\u2014 you have "+swAbbr(bal)+" "+(fa.code||""));setConfirm(false);return false;}showErr("");setConfirm(true);return true;}'
+'function destAssetsParam(ta){return "destination_assets="+encodeURIComponent((!ta.code||ta.code==="XLM")?"native":(ta.code+":"+(ta.iss||lxIssuer(ta.code))));}'
+'function srcAssetsParam(fa){return "source_assets="+encodeURIComponent((!fa.code||fa.code==="XLM")?"native":(fa.code+":"+(fa.iss||lxIssuer(fa.code))));}'
// forward probe: sending netAmt of fa returns how much ta you get (the on-chain strict-send the Confirm uses)
+'function ssendOut(netAmt,fa,ta){return fetch(H+"/paths/strict-send?"+swAP("source",fa)+"&source_amount="+netAmt.toFixed(7)+"&"+destAssetsParam(ta)).then(function(r){return r.json();}).then(function(pd){var recs=(pd._embedded&&pd._embedded.records)||[];return recs.length?parseFloat(recs[0].destination_amount):NaN;});}'
+'function renderCalc(gross,net,out,fSym,tSym,fr,prov){if(!(gross>0)||!(out>0)){panel.style.display="none";return;}var fee=gross*fr,slip=0.5,minR=out*(1-slip/100),effRate=out/net;var sr=(spotRate!=null&&spotRate>0)?spotRate:effRate;var rawImp=(sr>0)?((effRate-sr)/sr*100):0;var piTxt=prov?"\\u2026":(Math.abs(rawImp)<0.01?\'<span style="color:var(--green,#35c07f)">&lt; 0.01%</span>\':(rawImp<0?\'<span style="color:var(--red,#ff5b5b)">-\'+Math.abs(rawImp).toFixed(2)+\'%</span>\':\'<span style="color:var(--green,#35c07f)">+\'+rawImp.toFixed(2)+\'%</span>\'));set("feelbl","Swap fee ("+(fr*100).toFixed(1).replace(/\\.0$/,"")+"%)");set("feenote",fr<=0.001?\'<div class="lx-fee-banner holder"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>You qualify for 0.1% trading fees</b> \u2014 50% Discount</span></div>\':\'<div class="lx-fee-banner nudge"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>50% off trading fees</b> \u2014 hold 250,000 <a class="lx-fee-buy" href="/lumos/stellar">LUMOS</a></span></div>\');set("rate","1 "+fSym+" \\u2248 "+fmt(sr)+" "+tSym);set("slip",slip+"%");set("fee",fmt(fee)+" "+fSym);set("net","~0.00001 XLM");set("pi",piTxt);set("min",fmt(minR)+" "+tSym);panel.style.display="";}'
+'function smartBadge(){var b=modal.querySelector(".lx-smart-badge");if(!b){b=document.createElement("div");b.className="lx-smart-badge";var pr=modal.querySelector(".swap-pair");if(pr&&pr.parentNode)pr.parentNode.insertBefore(b,pr.nextSibling);}return b;}'
+'function hideBadge(){var b=modal.querySelector(".lx-smart-badge");if(b)b.style.display="none";}'
// step-2 compact "you pay / you receive" summary (replaces the full picker on the review screen)
+'var SWLQ={};'
  +'function swPutLogo(k,url){try{window.__lxLogosI=window.__lxLogosI||{};window.__lxLogosI[k]=url;}catch(_){}'
  +'var q=document.querySelectorAll(".lx-ss-ico[data-k=\x27"+k+"\x27]");'
  +'for(var i=0;i<q.length;i++){q[i].style.setProperty("--al","url(\x27"+String(url).replace(/\x27/g,"%27")+"\x27)");q[i].setAttribute("data-l","");}}'
  +'function swQueueLogo(code,iss){if(!code||!iss||code==="XLM")return;var k=code+"-"+iss;'
  +'if(SWLQ[k])return;SWLQ[k]=1;'
  +'try{if((window.__lxLogosI||{})[k]){swPutLogo(k,window.__lxLogosI[k]);return;}}catch(_){}'
  +'fetch("https://horizon.stellar.org/accounts/"+iss).then(function(r){return r.ok?r.json():null;}).then(function(acc){'
  +'var d=acc&&acc.home_domain;if(!d)return null;'
  +'return fetch("https://"+d+"/.well-known/stellar.toml").then(function(r){return r.ok?r.text():null;});'
  +'}).then(function(txt){if(!txt)return;'
  +'var re=new RegExp("code\\\\s*=\\\\s*[\\x22\\x27]"+code+"[\\x22\\x27][^]*?(?=\\\\[\\\\[|$)","i");'
  +'var blk=(txt.match(re)||[""])[0]||txt;'
  +'var img=(blk.match(/image\\s*=\\s*["\x27]([^"\x27]+)["\x27]/i)||[])[1];'
  +'if(img)swPutLogo(k,img);}).catch(function(){});}'
    +'function ssIco(a){if(!a)return "";var _lk=(a.code||"")+"-"+(a.iss||a.issuer||"");var lg=(a.native||a.code==="XLM")?(window.__lxStellarUri||SWSU):(a.logo||(window.__lxLogos||{})[a.code]||(window.__lxLogosI||{})[_lk]||(a.code==="LUMOS"?SWLL:""));var bg=lg?("url(\\x27"+String(lg).replace(/\\x27/g,"%27")+"\\x27)"):swCol(a.code||"?");if(!lg)swQueueLogo(a.code||"",(a.iss||a.issuer||""));return \'<span class="lx-ss-ico" data-k="\'+esc(_lk)+\'" style="--al:\'+bg+\'" data-l="\'+(lg?"":esc((a.code||"?").slice(0,1).toUpperCase()))+\'"></span>\';}'
+'function fillSummary(){if(!_summary)return;var fa=fromF.__lxasset||{code:symOf(fromF)},ta=toF.__lxasset||{code:symOf(toF)};var _fvR=(fromInput.value||"").trim();var _fvN=parseFloat(_fvR.replace(/,/g,""))||0;var fv=(_fvN>=1000)?Math.round(_fvN).toLocaleString("en-US"):_fvR;var _tvR=(toInput.value||"").trim();var _tvN=parseFloat(_tvR.replace(/,/g,""))||0;var tv=(_tvN>=1)?Math.round(_tvN).toLocaleString("en-US"):_tvR;_summary.innerHTML=\'<div class="lx-ss-row"><div class="lx-ss-head">\'+ssIco(fa)+\'<span class="lx-ss-lbl">You pay</span></div><div class="lx-ss-val">\'+esc(fv)+\'<span class="lx-ss-code">\'+esc(fa.code)+\'</span></div></div><div class="lx-ss-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></div><div class="lx-ss-row"><div class="lx-ss-head">\'+ssIco(ta)+\'<span class="lx-ss-lbl">You receive</span></div><div class="lx-ss-val">\'+esc(tv)+\'<span class="lx-ss-code">\'+esc(ta.code)+\'</span></div></div>\';}'
+'function protLabel(soro){var ps=(soro.route||[]).map(function(x){return x.p;}).filter(function(v,i,a){return v&&a.indexOf(v)===i;});var nice={aqua:"Aquarius",soroswap:"Soroswap",phoenix:"Phoenix",sdex:"Stellar DEX"};return ps.map(function(p){return nice[p]||p;}).join(" + ")||"Aquarius";}'
// render the review panel from a Soroswap best-rate quote (full amount, no LumosCore fee -> best price)
+'function renderSoro(amt,soro,fSym,tSym,extraUSDC){var fr=(window.__lxFeeRate||0.002),net=amt*(1-fr),fee=amt*fr,out=soro.out,srr=out/net,slip=0.5;var minR=(soro.quote&&soro.quote.otherAmountThreshold)?(+soro.quote.otherAmountThreshold/1e7):out*(1-slip/100);set("feelbl","Swap fee ("+(fr*100).toFixed(1).replace(/\\.0$/,"")+"%)");set("fee",fmt(fee)+" "+fSym);set("feenote",\'<div class="lx-fee-banner nudge"><span class="lx-fee-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4 0-7-2.7-7-6.5 0-2.3 1.2-4 2.4-5.4.3.9 1 1.6 1.9 1.6 1.4 0 1.7-1 1.6-3.5-.1-2.4 1-4.6 3.1-6.2-.4 2 .3 3.2 1.6 4.6C19 9.6 19 11.8 19 16.5c0 3.8-3 6.5-7 6.5z"></path></svg></span><span class="txt"><b>50% off trading fees</b> \u2014 hold 250,000 <a class="lx-fee-buy" href="/lumos/stellar">LUMOS</a></span></div>\');set("rate","1 "+fSym+" \\u2248 "+fmt(srr)+" "+tSym);set("slip",slip+"%");set("net","~0.0005 XLM");set("pi",soro.impact<0.01?\'<span style="color:var(--green,#35c07f)">&lt; 0.01%</span>\':\'<span style="color:var(--red,#ff5b5b)">-\'+soro.impact.toFixed(2)+"%</span>");set("min",fmt(minR)+" "+tSym);panel.style.display="";var b=smartBadge();b.style.display="";b.innerHTML=\'<span class="lx-sb-ic"><svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"></path></svg></span><span class="lx-sb-mid"><div class="lx-sb-ttl">Smart Swap</div><div class="lx-sb-sub">Best rate via <b>\'+esc(protLabel(soro))+\'</b> \\u00b7 <a class="lx-sb-learn" data-lx-smartinfo>Learn more</a></div></span><span class="lx-sb-best">\'+(extraUSDC>0?("+"+fmt(extraUSDC)+" "+tSym):"Best rate")+\'</span>\';}'
+'function run(noOpt){var _raw=(fromInput.value||"");if(/[^0-9.,\\s]/.test(_raw)){showErr("Enter a valid amount (numbers only)");setConfirm(false);if(toInput)toInput.value="";if(panel)panel.style.display="none";window.__lxSoro=null;hideBadge();return;}var amt=parseFloat(_raw.replace(/,/g,""))||0;var fa=fromF.__lxasset||{code:symOf(fromF)},ta=toF.__lxasset||{code:symOf(toF)};var fSym=fa.code,tSym=ta.code;if(!(amt>0)){if(toInput)toInput.value="";showErr("");setConfirm(true);panel.style.display="none";window.__lxSoro=null;hideBadge();return;}var fr=(window.__lxFeeRate||0.002),net=amt*(1-fr);checkBal(amt,fa);if(!noOpt&&spotRate!=null&&spotRate>0){var optOut=net*spotRate;if(toInput)toInput.value=fmt(optOut);renderCalc(amt,net,optOut,fSym,tSym,fr,true);}else if(noOpt&&toInput){toInput.value="";}var seq=++qseq;clearTimeout(qtmr);qtmr=setTimeout(function(){var netStroops=Math.round(net*1e7);Promise.all([fetch(H+"/paths/strict-send?"+swAP("source",fa)+"&source_amount="+net.toFixed(7)+"&"+destAssetsParam(ta)).then(function(r){return r.json();}).then(function(pd){var recs=(pd._embedded&&pd._embedded.records)||[];return recs.length?parseFloat(recs[0].destination_amount):NaN;}).catch(function(){return NaN;}),soroQuote(fa,ta,netStroops).catch(function(){return null;})]).then(function(res){if(seq!==qseq)return;var cout=res[0],soro=res[1];var classicOut=(isFinite(cout)&&cout>0)?cout:0;var useSoro=soro&&soro.usesSoroban&&soro.out>0&&soro.out>classicOut*1.005&&(soro.impact||0)<10;if(useSoro){window.__lxSoro={quote:soro.quote,out:soro.out,fSym:fSym,tSym:tSym,fa:fa,ta:ta};if(toInput)toInput.value=fmt(soro.out);renderSoro(amt,soro,fSym,tSym,soro.out-classicOut);}else{window.__lxSoro=null;hideBadge();if(classicOut>0){if(toInput)toInput.value=fmt(classicOut);renderCalc(amt,net,classicOut,fSym,tSym,fr,false);}else{var f2=net*(spotRate||0);if(toInput&&f2>0)toInput.value=fmt(f2);renderCalc(amt,net,f2,fSym,tSym,fr,false);}}}).catch(function(){});},260);}'
+'fromInput.addEventListener("input",run);'
// #8: hold 196M LUMOS and still be told to "hold 250,000". _feerate.js resolves the tier from a
// Horizon balance fetch, so window.__lxFeeRate is 0.002 for the first moment of every page and only
// becomes 0.001 once that lands. This panel read it ONCE while rendering and had no listener for
// lx:feetier -- the event _feerate.js fires precisely so surfaces can catch up. _feemodal.js listens;
// this did not, so a qualifying holder kept the nudge banner and the 0.2% label for the life of the
// page. Re-running the quote is what repaints both.
+'try{window.addEventListener("lx:feetier",function(){try{run();}catch(_){}});}catch(_){}'
// entering an amount in the TO field back-computes the required FROM amount
+'function runTo(){window.__lxSoro=null;hideBadge();var _rawt=(toInput.value||"");if(/[^0-9.,\\s]/.test(_rawt)){showErr("Enter a valid amount (numbers only)");setConfirm(false);fromInput.value="";if(panel)panel.style.display="none";return;}var toAmt=parseFloat(_rawt.replace(/,/g,""))||0;var fa=fromF.__lxasset||{code:symOf(fromF)},ta=toF.__lxasset||{code:symOf(toF)};var fSym=fa.code,tSym=ta.code,fr=(window.__lxFeeRate||0.002);if(!(toAmt>0)){fromInput.value="";showErr("");setConfirm(true);panel.style.display="none";return;}if(realRate(fa.code,ta.code)!=null&&spotRate!=null&&spotRate>0){var optNet=toAmt/spotRate,optGross=optNet/(1-fr);fromInput.value=fmt(optGross);checkBal(optGross,fa);renderCalc(optGross,optNet,toAmt,fSym,tSym,fr,true);}else{fromInput.value="\\u2026";setConfirm(false);showErr("");if(panel)panel.style.display="none";}var seq=++qseq;clearTimeout(qtmr);qtmr=setTimeout(function(){'
// warm-start From from strict-receive, then correct it against strict-send so From->To reproduces this To (fixes the round-trip mismatch)
+'fetch(H+"/paths/strict-receive?"+swAP("destination",ta)+"&destination_amount="+toAmt.toFixed(7)+"&"+srcAssetsParam(fa)).then(function(r){return r.json();}).then(function(pd){if(seq!==qseq)return null;var recs=(pd._embedded&&pd._embedded.records)||[];var net0=recs.length?parseFloat(recs[0].source_amount):((spotRate>0)?toAmt/spotRate:NaN);return(isFinite(net0)&&net0>0)?net0:null;}).then(function(net0){if(net0==null)return null;var k=2;function step(net){return ssendOut(net,fa,ta).then(function(out){if(seq!==qseq)return null;if(!(out>0))return net;if(k<=0||Math.abs(out-toAmt)/toAmt<0.004)return net*(toAmt/out);k--;return step(net*(toAmt/out));});}return step(net0);}).then(function(net){if(net==null||!isFinite(net)||net<=0||seq!==qseq)return;return ssendOut(net,fa,ta).then(function(finalOut){if(seq!==qseq)return;if(finalOut>0&&Math.abs(finalOut-toAmt)/toAmt>0.03){fromInput.value="\\u221E Infinite";showErr("Not enough liquidity to receive "+fmt(toAmt)+" "+tSym+" \\u2014 about "+fmt(finalOut)+" "+tSym+" is the most you can get");setConfirm(false);if(panel)panel.style.display="none";return;}var gross=net/(1-fr);fromInput.value=fmt(gross);checkBal(gross,fa);renderCalc(gross,net,toAmt,fSym,tSym,fr,false);});}).catch(function(){});},260);}'
+'if(toInput)toInput.addEventListener("input",runTo);'
// ---- selectable From/To asset pickers: From = held assets; To = held + search any Stellar asset + custom ----
+'var SWCOL=["#6f5ded","#ff894c","#2bb673","#e0447b","#3aa0ff","#f5b301","#9b5de5","#00bbf9","#e56b6f","#43aa8b"];function swCol(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return SWCOL[h%SWCOL.length];}'
+'function swLogo(h){if(h.native)return window.__lxStellarUri||"";return h.logo||(window.__lxLogos||{})[h.code]||"";}'
+'function lxReadItemLogo(el){try{var ic=el.querySelector(".lx-am-ic");if(!ic)return "";var im=ic.querySelector("img");if(im&&im.src)return im.src;var bg=ic.style.backgroundImage||getComputedStyle(ic).backgroundImage||"";if(bg.indexOf("url(")>=0&&bg.indexOf("gradient")<0)return bg.replace(/^url\\((["\\x27]?)/,"").replace(/(["\\x27]?)\\)$/,"");}catch(_){}return "";}'
+'function swIcoInner(h){var lg=swLogo(h);if(lg)return \'<img src="\'+lg+\'" style="width:100%;height:100%;object-fit:cover;display:block">\';return h.native?"\\u2726":esc((h.code||"?").slice(0,1).toUpperCase());}'
+'function swIcoBg(h){return swLogo(h)?"transparent":(h.native?"#8b5cf6":swCol(h.code||"?"));}'
+'function swSetIco(ic,h){if(!ic)return;var lg=swLogo(h);if(lg){ic.style.setProperty("--lxlogo","url("+JSON.stringify(lg)+")");ic.setAttribute("data-l","");}else{var col=h.native?"#8b5cf6":swCol(h.code||"?");ic.style.setProperty("--lxlogo","linear-gradient("+col+","+col+")");ic.setAttribute("data-l",h.native?"\\u2726":esc((h.code||"?").slice(0,1).toUpperCase()));if(window.__lxHarvest&&!h.native)window.__lxHarvest(ic,h.code);}ic.innerHTML="";}'
+'function swAP(role,a){if(!a.code||a.code==="XLM")return role+"_asset_type=native";return role+"_asset_type=credit_alphanum"+(a.code.length>4?"12":"4")+"&"+role+"_asset_code="+a.code+"&"+role+"_asset_issuer="+(a.iss||lxIssuer(a.code));}'
+'function refreshRate(){var fa=fromF.__lxasset||{code:symOf(fromF)},ta=toF.__lxasset||{code:symOf(toF)};var rr=realRate(fa.code,ta.code);if(rr!=null)spotRate=rr;run();fetch(H+"/paths/strict-send?"+swAP("source",fa)+"&source_amount=1&"+destAssetsParam(ta)).then(function(r){return r.json();}).then(function(pd){var recs=(pd._embedded&&pd._embedded.records)||[];if(recs.length){var d=parseFloat(recs[0].destination_amount);if(isFinite(d)&&d>0)spotRate=d;}run();}).catch(function(){});}'
+'function swDefaultOther(h){if(h.code==="XLM"){return {code:"USDC",iss:lxIssuer("USDC"),native:false,bal:heldBal("USDC")};}var nat=(window.__lxHoldings||[]).filter(function(x){return x.native;})[0];return nat||{code:"XLM",native:true,bal:(window.__lxNative||null)};}'
+'function selectSwap(f,h,skipRate){var other=(f===fromF)?toF:fromF;var prev=f.__lxasset;if(h&&!h.native&&h.bal==null){var _hb=heldBal(h.code);if(_hb)h.bal=_hb;}var ap=f.querySelector(".lx-swap-pick");if(ap){swSetIco(ap.querySelector(".lx-ap-ico"),h);var cd=ap.querySelector(".lx-ap-code");if(cd)cd.textContent=h.code;}var meta=f.querySelector(".field-label .meta");if(meta&&/Balance/i.test(meta.textContent||"")){var bvRaw=h.native?(window.__lxNative||0):(h.bal!=null?h.bal:heldBal(h.code));var bv=h.native?((window.__lxMaxXLM!=null)?window.__lxMaxXLM:bvRaw):bvRaw;meta.textContent="Balance: "+swAbbr(bv)+" "+h.code;meta.title=h.native?(fmt(bv)+" XLM spendable \u2014 "+fmt(bvRaw)+" total, "+fmt(Math.max(0,bvRaw-bv))+" locked as the Stellar account reserve"):(fmt(bv)+" "+h.code);}f.__lxsym=h.code;f.__lxasset=h;if(h.iss&&h.code!=="XLM")window.__lxKnownSwap[h.code]=h.iss;var mm=document.querySelector(".lx-asset-menu");if(mm)mm.remove();if(other&&other.__lxasset&&other.__lxasset.code===h.code){var repl=(prev&&prev.code!==h.code)?prev:swDefaultOther(h);if(repl&&repl.code!==h.code)selectSwap(other,repl,true);}if(!skipRate)refreshRate();}'
// Published so the wallet's My-Assets row menu can open this modal with a chosen asset already on the
// You-pay side. Falls back to a synthetic holding when the asset is not in __lxHoldings (a zero-balance
// trustline is still a legitimate thing to swap FROM once funded), and pushes the other side off the same
// asset so the pair can never be X -> X.
+'window.__lxSwapFrom=function(code,iss){try{var h;'
+'if(!code||code==="XLM"){h={code:"XLM",native:true,bal:(window.__lxMaxXLM!=null?window.__lxMaxXLM:(window.__lxNative||0))};}'
+'else{h=(window.__lxHoldings||[]).filter(function(x){return x.code===code&&!x.native&&(!iss||!x.iss||x.iss===iss);})[0]||{code:code,iss:iss||lxIssuer(code),native:false,bal:heldBal(code)};}'
// Pair it with the NATIVE asset, always — not only when the two sides collide. Opening this from a row in
// My Assets means "trade this holding", and on Stellar the counter asset for that is XLM; the dialog's own
// default of USDC left every such swap needing a manual change of the receive side. swDefaultOther returns
// XLM for any credit asset, and USDC when the chosen asset IS XLM (a pair of XLM/XLM is not a swap).
+'selectSwap(fromF,h);selectSwap(toF,swDefaultOther(h),true);'
+'if(fromInput){fromInput.value="";try{fromInput.focus();}catch(_e){}}'
+'}catch(_){}};'
+'function openSwapMenu(f,ap,withSearch){var ex=document.querySelector(".lx-asset-menu");if(ex){ex.remove();return;}var hs=window.__lxHoldings||[];var menu=document.createElement("div");menu.className="lx-asset-menu lx-swap-menu";var si=null;if(withSearch){si=document.createElement("input");si.className="lx-am-search";si.placeholder=(withSearch==="local"?"Search your assets\\u2026":"Search any Stellar asset\\u2026");var sw=document.createElement("div");sw.className="lx-am-searchwrap";sw.innerHTML=\'<svg class="lx-am-searchic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>\';sw.appendChild(si);menu.appendChild(sw);}var list=document.createElement("div");list.className="lx-am-list";menu.appendChild(list);'
+'function addItems(arr){list.innerHTML="";var LXCAP=60,lxAll=arr.length;arr=arr.slice(0,LXCAP);arr.forEach(function(h){var b=document.createElement("button");b.type="button";b.className="lx-am-item";var iss=h.iss||lxIssuer(h.code);b.innerHTML=\'<span class="lx-am-ic" style="background:\'+swIcoBg(h)+\';overflow:hidden">\'+swIcoInner(h)+\'</span><span class="lx-am-code">\'+esc(h.code)+\'</span><span class="lx-am-meta">\'+(iss?\'<span class="lx-am-iss">\'+esc(iss.slice(0,4))+"\\u2026"+esc(iss.slice(-4))+\'</span>\':"")+(h.bal!=null?\'<span class="lx-am-bal">\'+fmt(h.bal)+\'</span>\':"")+\'</span>\';b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var lg=lxReadItemLogo(b);if(lg){h.logo=lg;if(h.code&&h.code!=="XLM"){window.__lxLogos=window.__lxLogos||{};window.__lxLogos[h.code]=lg;}}selectSwap(f,h);});list.appendChild(b);});if(withSearch===true){var cb=document.createElement("button");cb.type="button";cb.className="lx-am-item lx-am-customitem";cb.innerHTML=\'<span class="lx-am-ic" style="background:var(--accent,#ea6a2c)">+</span><span class="lx-am-code">Add custom asset</span>\';cb.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();document.querySelectorAll(".lx-asset-menu").forEach(function(x){x.remove();});openCustomAssetModal(f);});list.appendChild(cb);}if(!list.children.length)list.innerHTML=\'<div class="lx-am-empty">No matches</div>\';if(lxAll>LXCAP){var lxn=document.createElement("div");lxn.className="lx-am-more";lxn.textContent="Showing "+LXCAP+" of "+lxAll+" \u2014 type to find the rest";list.appendChild(lxn);}}'
+'addItems(hs);'
+'if(withSearch===true){var tmr;si.addEventListener("input",function(){clearTimeout(tmr);var q=si.value.trim();if(!q){addItems(hs);return;}tmr=setTimeout(function(){fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(q)+"&limit=12").then(function(r){return r.json();}).then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var arr=recs.map(function(rc){var p=(rc.asset||rc.paging_token||"").split("-");var ti=rc.tomlInfo||rc.toml_info||{};var lg=ti.image||ti.orgLogo||"";if(lg&&p[0]){window.__lxLogos=window.__lxLogos||{};window.__lxLogos[p[0]]=lg;}return{code:p[0],iss:p[1]||"",native:!p[1],bal:null,logo:lg,dom:(rc.domain||ti.orgName||"")};}).filter(function(x){return x.code&&x.iss;});if(!arr.length)arr=hs.filter(function(h){return h.code.toLowerCase().indexOf(q.toLowerCase())>=0;});addItems(arr);}).catch(function(){addItems(hs.filter(function(h){return h.code.toLowerCase().indexOf(q.toLowerCase())>=0;}));});},260);});'
+'}else if(withSearch==="local"){si.addEventListener("input",function(){var q=si.value.trim().toLowerCase();addItems(q?hs.filter(function(h){return (h.code||"").toLowerCase().indexOf(q)>=0;}):hs);});}'
+'function openCustomAssetModal(f){var ex=document.querySelector(".lx-custom-modal");if(ex)ex.remove();var ov=document.createElement("div");ov.className="lx-custom-modal";ov.innerHTML=\'<div class="lx-cm-box"><div class="lx-cm-title">Add custom asset</div><label class="lx-cm-lbl">Asset code</label><input class="lx-cm-code" placeholder="e.g. USDC" maxlength="12" spellcheck="false"><label class="lx-cm-lbl">Issuer address</label><input class="lx-cm-iss" placeholder="G\\u2026" spellcheck="false"><div class="lx-cm-err"></div><div class="lx-cm-btns"><button type="button" class="lx-cm-cancel">Cancel</button><button type="button" class="lx-cm-confirm">Confirm</button></div></div>\';document.body.appendChild(ov);var codeI=ov.querySelector(".lx-cm-code"),issI=ov.querySelector(".lx-cm-iss"),err=ov.querySelector(".lx-cm-err"),cf=ov.querySelector(".lx-cm-confirm");function close(){ov.remove();}ov.querySelector(".lx-cm-cancel").addEventListener("click",close);ov.addEventListener("click",function(e){if(e.target===ov)close();});cf.addEventListener("click",function(){var code=(codeI.value||"").trim(),iss=(issI.value||"").trim();if(!/^[A-Za-z0-9]{1,12}$/.test(code)){err.textContent="Enter a valid asset code (1\\u201312 letters/numbers).";return;}if(!/^G[A-Z2-7]{55}$/.test(iss)){err.textContent="Enter a valid issuer address (starts with G, 56 chars).";return;}err.textContent="";cf.disabled=true;cf.textContent="Loading\\u2026";fetch("https://api.stellar.expert/explorer/public/asset?search="+encodeURIComponent(code)+"&limit=20").then(function(r){return r.json();}).then(function(d){var recs=(d._embedded&&d._embedded.records)||[];var match=recs.filter(function(rc){return (rc.asset||"").indexOf(code+"-"+iss)===0;})[0];var ti=(match&&(match.tomlInfo||match.toml_info))||{};var img=ti.image||ti.orgLogo||"";if(img)(window.__lxLogos=window.__lxLogos||{})[code]=img;selectSwap(f,{code:code,iss:iss,native:false,bal:null,logo:img});close();}).catch(function(){selectSwap(f,{code:code,iss:iss,native:false,bal:null});close();});});codeI.focus();}'
+'document.body.appendChild(menu);var rc=ap.getBoundingClientRect();menu.style.position="fixed";menu.style.top=(rc.bottom+6)+"px";menu.style.left=Math.max(8,Math.min(rc.left,window.innerWidth-256))+"px";menu.style.zIndex="100000";if(si)si.focus();}'
+'document.addEventListener("click",function(e){if(!(e.target.closest&&(e.target.closest(".lx-asset-menu")||e.target.closest(".lx-swap-pick")))){var mm=document.querySelector(".lx-asset-menu");if(mm)mm.remove();}},true);'
+'function makeSwapPick(f,initSym,withSearch){var fp=f.querySelector(".asset-pick");if(!fp||f.__lxpick)return;f.__lxpick=1;fp.style.display="none";var ap=document.createElement("button");ap.type="button";ap.className="lx-asset-pick lx-swap-pick";ap.setAttribute("data-lx-noswap","");ap.innerHTML=\'<span class="lx-ap-ico" data-lx-noswap=""></span><span class="lx-ap-code" data-lx-noswap="">\'+esc(initSym)+\'</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\';fp.parentNode.insertBefore(ap,fp.nextSibling);ap.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();openSwapMenu(f,ap,withSearch);});var h0=(window.__lxHoldings||[]).filter(function(x){return x.code===initSym;})[0]||{code:initSym,iss:lxIssuer(initSym),native:initSym==="XLM",bal:null};selectSwap(f,h0);}'
+'makeSwapPick(fromF,symOf(fromF)||"XLM","local");makeSwapPick(toF,symOf(toF)||"USDC",true);'
// logos/holdings load async -> re-apply the pickers a few times so real logos replace fallbacks
+'function swHarvestPage(){try{window.__lxLogos=window.__lxLogos||{};[].forEach.call(document.querySelectorAll(".asset-pick"),function(p){var img=p.querySelector("img");if(!img||!img.src)return;if(img.src.indexOf("data:")!==0&&img.src.indexOf("http")!==0)return;var code=((p.textContent||"").trim().split(/\\s+/)[0]||"");if(code&&code!=="XLM"&&/^[A-Za-z0-9]{1,12}$/.test(code)&&!window.__lxLogos[code])window.__lxLogos[code]=img.src;});}catch(_){}}'
+'var _rt=0,_riv=setInterval(function(){_rt++;swHarvestPage();if(window.__lxStellarUri){if(fromF.__lxasset)selectSwap(fromF,fromF.__lxasset,true);if(toF.__lxasset)selectSwap(toF,toF.__lxasset,true);}if(_rt>=8)clearInterval(_riv);},600);'
+'if(!modal.__lxReset){modal.__lxReset=1;new MutationObserver(function(){if(modal.classList.contains("open")){if(!modal.__lxWasOpen){modal.__lxWasOpen=1;fromInput.value="";if(toInput)toInput.value="";showErr("");setConfirm(true);if(panel)panel.style.display="none";modal.classList.remove("lx-on-step2");window.__lxSoro=null;hideBadge();try{selectSwap(fromF,{code:"XLM",native:true,bal:(window.__lxMaxXLM!=null?window.__lxMaxXLM:(window.__lxNative||null))},true);selectSwap(toF,{code:"USDC",iss:lxIssuer("USDC"),native:false,bal:heldBal("USDC")},true);spotRate=null;refreshRate();}catch(_){}}}else{modal.__lxWasOpen=0;}}).observe(modal,{attributes:true,attributeFilter:["class"]});}'
// Max button on the swap From field (fills the From asset balance)
+'var flabel=fromF.querySelector(".field-label");if(flabel&&!flabel.__lxmax){flabel.__lxmax=1;var mx=document.createElement("button");mx.type="button";mx.className="lx-swapmax";mx.textContent="Max";flabel.appendChild(mx);mx.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var a=fromF.__lxasset||{code:symOf(fromF)},bal=0;if(a.native||a.code==="XLM"){bal=(window.__lxMaxXLM!=null?window.__lxMaxXLM:(window.__lxNative||0));}else{bal=(a.bal!=null?a.bal:0);}if(bal>0){fromInput.value=Math.floor(bal*1e7)/1e7;run(true);}});}'
// wire "Confirm Swap" to a real path-payment swap (uses the wallet page's shared signing helpers)
+'var confirmBtn=[].slice.call(modal.querySelectorAll("button")).filter(function(x){return /confirm swap/i.test(x.textContent||"");})[0];'
// 2-step flow: Review (step 1) advances to the review screen; Back (step 2) returns; Confirm executes on step 2
+'if(confirmBtn&&!confirmBtn.__lxstep){confirmBtn.__lxstep=1;var _foot=confirmBtn.parentNode;_summary=document.createElement("div");_summary.className="lx-swap-summary";var _sp=modal.querySelector(".swap-pair");if(_sp&&_sp.parentNode)_sp.parentNode.insertBefore(_summary,_sp.nextSibling);_review=confirmBtn.cloneNode(true);confirmBtn.classList.add("lx-step2-only");_review.className=(_review.className||"").replace(/lx-step2-only/g,"").trim()+" lx-review-btn lx-step1-only";_review.removeAttribute("id");_review.innerHTML="Review Swap \\u2192";_review.disabled=confirmBtn.disabled;var _cancel=_foot?[].slice.call(_foot.querySelectorAll("button")).filter(function(x){return /^cancel$/i.test((x.textContent||"").trim());})[0]:null;if(_foot){if(_cancel){_cancel.classList.add("lx-step1-only");_back=_cancel.cloneNode(true);_back.className=(_back.className||"").replace(/lx-step1-only/g,"").trim()+" lx-back-btn lx-step2-only";_back.removeAttribute("id");_back.innerHTML="\\u2190 Back";_back.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();modal.classList.remove("lx-on-step2");},true);_foot.insertBefore(_back,_cancel.nextSibling);_foot.insertBefore(_review,_back.nextSibling);}else{_foot.insertBefore(_review,confirmBtn);}}_review.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(_review.disabled)return;var amt=parseFloat((fromInput.value||"").replace(/,/g,""))||0;if(!(amt>0)){(window.lxToast||function(){})("Enter an amount to swap");return;}fillSummary();modal.classList.add("lx-on-step2");},true);}'
+'if(confirmBtn&&!confirmBtn.__lxswap){confirmBtn.__lxswap=1;_confirm=confirmBtn;confirmBtn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(confirmBtn.disabled)return;var toast=window.lxToast||function(m){};var amt=parseFloat((fromInput.value||"").replace(/,/g,""))||0;var fSym=symOf(fromF),tSym=symOf(toF);if(!(amt>0)){toast("Enter an amount to swap");return;}if(fSym===tSym){toast("Pick two different assets");return;}if(!window.lxStellar||!window.lxSign){toast("Still loading balances \\u2014 try again in a moment");return;}var _minEl=panel.querySelector(\'[data-k="min"]\');var minOut=readNum(_minEl,_minEl&&_minEl.textContent);var _exp=readNum(toInput,toInput&&toInput.value);if(_exp>0&&_exp<1e-7){toast("Too small to swap \u2014 you would receive less than 0.0000001 "+tSym+", the smallest amount Stellar can transfer");confirmBtn.disabled=false;return;}var ot=confirmBtn.textContent;confirmBtn.disabled=true;var _needT=(window.__lxSoro&&tSym&&tSym!=="XLM"&&!(window.__lxAssets||{})[tSym]);confirmBtn.textContent=_needT?("Adding "+tSym+" trustline\\u2026"):"Signing\\u2026";(_needT?ensureTrust(tSym):Promise.resolve()).then(function(){confirmBtn.textContent="Signing\\u2026";return window.__lxSoro?soroExecute(window.__lxSoro):lxSwap(fSym,tSym,amt,minOut,(fromF.__lxasset||{}).iss,(toF.__lxasset||{}).iss);}).then(function(){window.__lxSoro=null;confirmBtn.textContent="Swapped \\u2713";toast("Swapped "+amt+" "+fSym+" \\u2192 "+tSym);setTimeout(function(){modal.classList.remove("lx-on-step2");var cl=modal.querySelector(".modal-close,[data-close],.close");if(cl){cl.click();}else{modal.classList.remove("open");modal.setAttribute("hidden","");document.body.style.overflow="";}confirmBtn.disabled=false;confirmBtn.textContent=ot;},1300);}).catch(function(err){confirmBtn.disabled=false;confirmBtn.textContent=ot;toast((err&&err.message)||"Swap failed");});},true);}'
+'var flip=modal.querySelector(".swap-arrow");if(flip){flip.removeAttribute("data-tooltip");flip.removeAttribute("title");}if(flip)flip.addEventListener("click",function(e){e.preventDefault();var fa=fromF.__lxasset,ta=toF.__lxasset;if(fa&&ta){selectSwap(fromF,ta,true);selectSwap(toF,fa,true);}if(toInput)toInput.value="";fromInput.value="";spotRate=null;showErr("");setConfirm(true);modal.classList.remove("lx-on-step2");window.__lxSoro=null;hideBadge();refreshRate();});return true;}'
+'function run(){var a=bootA(),b=bootB();return a&&b;}'
+'function loop(){var n=0,iv=setInterval(function(){if(run()||++n>25)clearInterval(iv);},150);}'
+'if(document.readyState!=="loading")loop();else document.addEventListener("DOMContentLoaded",loop);'
+'})();</script>';

let n=0, stale=0;
for(const c of ['aptos','hedera','starknet','vechain','worldchain']){
  for(const dev of ['desktop','mobile']){
    const file=`lumoscore-${c}-${dev}.html`;
    let data; try{ data=read(file); }catch(e){ continue; }
    const {json,s,e}=getContents(data);
    for(const k of Object.keys(json)){
      let h=json[k];
      // Strip FIRST, on every key, before deciding whether to inject. Stripping only where we re-inject
      // leaves a stale copy behind on any page that once qualified and no longer does -- and the
      // containers are gitignored, so that stale copy outlives every rebuild and every revert. It had
      // already happened: wallet-mobile was still serving an lx-swapcalc from an earlier build, complete
      // with the Price impact row this change removes, while the transform reported success.
      const had=/<script id="lx-swapcalc">/.test(h);
      h=h.replace(/<style id="lx-swapcalc-css">[\s\S]*?<\/style>/g,'').replace(/<script id="lx-swapcalc">[\s\S]*?<\/script>/g,'')
         .replace(/<script id="lx-qorders">[\s\S]*?<\/script>/g,'')
         .replace(/<style id="lx-qorders-css">[\s\S]*?<\/style>/g,'');
      // The dashboard quick action. Renamed in the MARKUP so it is right at first paint, and because the
      // renamed title is what scopes the runtime tabs to this page -- the wallet ships no such card.
      // The description said "Orderbook and swap"; it now names the thing that is actually new here.
      h=h.split('<div class="ttl">Swap tokens</div>').join('<div class="ttl">Custom Swap / Orders</div>');
      h=h.split('<div class="desc">Orderbook and swap on the Aptos DEX. Best routing across pairs.</div>')
         .join('<div class="desc">Swap instantly, or place a limit order on any pair.</div>');
      const want=h.indexOf('id="swapModal"')>=0||h.indexOf('id="modalSwap"')>=0;
      if(!want){ if(had){ json[k]=h; stale++; } continue; }
      const bi=h.lastIndexOf('</body>'); if(bi<0) continue;
      json[k]=h.slice(0,bi)+STYLE+QSTYLE+SCRIPT+QSCRIPT+h.slice(bi); n++;
    }
    const serialized=JSON.stringify(json).split('</').join('<'+B+'/');
    fs.writeFileSync(file,data.slice(0,s)+serialized+data.slice(e),'utf8');
  }
}
console.log(`swap live-details wired on ${n} pages` + (stale?`; stripped ${stale} stale copies`:``));
