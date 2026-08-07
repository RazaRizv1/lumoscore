// Clean-URL route shim.
//
// The site now answers on /trade/stellar/<ASSET>, /asset/stellar/<ASSET> and
// /pools/stellar/<A>/<B>, but those are REWRITES — the underlying page still receives no query
// string, so every data layer that read ?asset= would silently fall back to its default asset.
//
// This exposes window.__lxRoute, parsed from the path, and the read sites below prefer it over the
// query string. The query string keeps working, so old ?asset= links and local file:// use are
// unaffected.
//
// Injected into <head> so it is defined before any data layer runs — the injected scripts live at the
// end of <body>, so head placement guarantees ordering regardless of transform order.
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const SHIM = '<script id="lx-route">(function(){'
  + 'var out={network:"",asset:"",poolA:"",poolB:"",poolId:""};'
  + 'try{'
  // asset codes are case-sensitive on Stellar (yUSDC !== YUSDC), so segments are NOT lowercased
  + '  var seg=location.pathname.replace(/^\\/+|\\/+$/g,"").split("/").map(decodeURIComponent);'
  + '  var head=(seg[0]||"").toLowerCase();'
  + '  var ASSET=/^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}$/;'
  + '  if(head==="trade"||head==="asset"){ out.network=(seg[1]||"").toLowerCase();'
  + '    if(seg[2]&&(ASSET.test(seg[2])||seg[2].toUpperCase()==="XLM"))out.asset=seg[2]; }'
  + '  else if(head==="pools"){ out.network=(seg[1]||"").toLowerCase();'
  // /pools/stellar/id/<hex> addresses a pool directly (fallback for links that only carry an id);
  // /pools/stellar/<A>/<B> is the canonical asset-pair form
  + '    if(seg[2]==="id"){ out.poolId=seg[3]||""; }'
  + '    else { if(seg[2])out.poolA=seg[2]; if(seg[3])out.poolB=seg[3]; } }'
  + '}catch(e){}'
  + 'window.__lxRoute=out;'
  + '})();</scr' + 'ipt>';

let touched = 0;
for (const chain of ['aptos', 'hedera', 'starknet', 'vechain', 'worldchain', 'stellar', 'xrpl']) {
  for (const dev of ['desktop', 'mobile']) {
    const file = `lumoscore-${chain}-${dev}.html`;
    let data; try { data = read(file); } catch (e) { continue; }
    const { json, s, e } = getContents(data);
    let changed = false;

    for (const key of Object.keys(json)) {
      let h = json[key];
      h = h.replace(/<script id="lx-route">[\s\S]*?<\/script>/g, '');   // idempotent
      const hi = h.indexOf('</head>');
      if (hi < 0) continue;
      json[key] = h.slice(0, hi) + SHIM + h.slice(hi);
      changed = true; touched++;
    }

    if (changed) {
      const ser = JSON.stringify(json).split('</').join('<' + B + '/');
      fs.writeFileSync(file, data.slice(0, s) + ser + data.slice(e), 'utf8');
    }
  }
}
console.log('route: shim injected into ' + touched + ' page keys');
