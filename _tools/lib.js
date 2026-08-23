const fs=require('fs');
function read(f){return fs.readFileSync(f,'utf8');}
function getContents(data){
  const i=data.indexOf('id="designContents"');const s=data.indexOf('>',i)+1;const e=data.indexOf('</script>',s);
  return {json:JSON.parse(data.slice(s,e)), s, e};
}
// The container JSON lives INSIDE a <script> tag, so every "</" it contains must go back escaped as "<\/".
// Writing a plain JSON.stringify puts a literal </script> in the middle of the tag: the browser (and
// getContents, which scans for the first </script>) then sees the container end early and the file is
// silently truncated. That corrupted all seven mobile containers once — they are gitignored, so there was
// no undo. Escape on the way out, always.
function writeContents(file, transformFn){
  const data=read(file);
  const {json,s,e}=getContents(data);
  const changed=transformFn(json);
  const B=String.fromCharCode(92);
  const out=data.slice(0,s)+JSON.stringify(json).split('</').join('<'+B+'/')+data.slice(e);
  fs.writeFileSync(file,out,'utf8');
  return changed;
}
// ---- verified issuers: ONE list, shared by every transform that renders a green tick -------------------
// A ticker is not an identity on Stellar. Anyone can issue an asset called USDC and plenty have, so a map
// keyed on code alone would badge the very fakes the tick exists to expose. Keys are CODE|ISSUER, and each
// pair was checked against its own issuer's home_domain on mainnet before being added.
//
// This lives here rather than being copied into each transform because a verified list that drifts between
// pages is worse than none: the same asset would be trustworthy on one screen and not on the next.
const VERIFIED={
  "XLM|":"stellar.org",                 // the native asset: no issuer to forge
  "USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"circle.com",
  "EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"circle.com",
  "yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"ultracapital.xyz",
  "yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":"ultracapital.xyz",
  "SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":"stronghold.co",
  "LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumosdao.io",
  "AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"aqua.network",

  // Added deliberately, each one checked by its own SEP-1 handshake rather than taken on an index's
  // word: the issuer's on-chain home_domain read from Horizon, that domain's stellar.toml fetched, and
  // its [[CURRENCIES]] block naming the same code AND the same issuer back. An aggregator's tomlInfo
  // proves only that SOME domain vouches, which is the exact hole the comment above this map is about.
  //
  // PYUSD (Paxos) was a candidate and is deliberately absent: its toml host answered 403, so the
  // handshake could not be completed here. It may well be genuine -- but a tick has to mean checked.
  "XRP|GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5":"fchain.io",
  "SCOP|GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ":"scopuly.com",
  "MTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org",
  "EURMTL|GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V":"mtl.montelibero.org",
  "ZARZ|GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U":"zeam.money",
  "USDZ|GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR":"zeam.money",
  "CLPX|GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G":"clpx.finance",
  "yBTC|GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW":"ultracapital.xyz",
  "yETH|GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD":"ultracapital.xyz",
  "ARS|GCYE7C77EB5AWAA25R5XMWNI2EDOKTTFTTPZKM2SR5DI4B4WFD52DARS":"api.anclap.com",
  "PEN|GA4TDPNUCZPTOHB3TKUYMDCRVATXKEADH7ZEYEBWJKQKE2UBFCYNBPEN":"api.anclap.com",

  // WHY THERE ARE NO LUMOSCORE MINTS IN THIS LIST ANY MORE.
  //
  // There were twenty-five, added automatically because the launchpad minted them. That made the tick
  // mean "issued here", and nobody reads it that way -- beside a token called LIBERATOR or ZBS a green
  // check reads as "this one is safe", which is a claim the platform cannot make about a memecoin it
  // merely provided the button for. The tick was doing the opposite of its job: it was loudest exactly
  // where a reader most needed to be careful, and it made the same mark on USDC worth less.
  //
  // What it means now is what CANONICAL means below: this ticker has one true issuer and this is it.
  // Adding an asset is a deliberate act, not a side effect of minting. LumosCore assets can and should
  // be added when they earn it -- one line each -- and LUMOS is here on that basis rather than because
  // of where it came from.
};
// ---- canonical tickers: the ONE issuer each of these codes is allowed to mean --------------------
//
// The single highest-signal fraud check available to us, and it costs nothing: if an asset's CODE is
// one of these and its ISSUER is not the one named here, the asset is not the thing its ticker says it
// is. That is true by construction -- we have already asserted, above, which issuer USDC means -- so
// the rule cannot false-positive the way a heuristic can.
//
// It is the only check that caught the real case. Measured across 30 assets a user actually meets:
// USDC-GCBYVQ... on mirrasets.com passes every technical test -- it declares a home_domain, and that
// domain's stellar.toml lists it back -- because the scammer owns the domain. A SEP-1 handshake proves
// that SOME domain vouches for an asset, never that the RIGHT one does. This comparison is what
// distinguishes them.
//
// DELIBERATELY NOT auto-derived from VERIFIED. That map also holds the LumosCore meme mints (PEPE,
// BEAR, FOX, PUMP...), and someone else's PEPE is not impersonating ours -- ours is not the canonical
// PEPE, and flagging it would be us claiming a ticker we do not own. A code belongs here only when it
// has one true issuer that everyone would recognise. Adding one is a decision, not a side effect.
const CANONICAL={
  "USDC":  {issuer:"GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", by:"Circle"},
  "EURC":  {issuer:"GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2", by:"Circle"},
  "yXLM":  {issuer:"GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55", by:"Ultra Capital"},
  "yUSDC": {issuer:"GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF", by:"Ultra Capital"},
  "SHX":   {issuer:"GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH", by:"Stronghold"},
  "AQUA":  {issuer:"GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA", by:"Aquarius"},
  "LUMOS": {issuer:"GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S", by:"LumosCore"},

  // Brand tickers: another issuer using these codes is claiming to be someone. ARS and PEN are
  // deliberately NOT here -- they are ISO currency codes, several anchors legitimately issue them, and
  // asserting ours is the only true ARS would flag honest issuers as impostors.
  "XRP": {issuer:"GBXRPL45NPHCVMFFAYZVUVFFVKSIZ362ZXFP7I2ETNQ3QKZMFLPRDTD5", by:"Fchain"},
  "SCOP": {issuer:"GC6OYQJIZF3HFXCYPFCBXYXNGIBQ4TNSFUBUXQJOZWIP6F3YZK4QH3VQ", by:"Scopuly"},
  "MTL": {issuer:"GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V", by:"Montelibero"},
  "EURMTL": {issuer:"GACKTN5DAZGWXRWB2WLM6OPBDHAMT6SJNGLJZPQMEZBUR4JUGBX2UK7V", by:"Montelibero"},
  "ZARZ": {issuer:"GAROH4EV3WVVTRQKEY43GZK3XSRBEYETRVZ7SVG5LHWOAANSMCTJBB3U", by:"Zeam"},
  "USDZ": {issuer:"GAKTLPC4ZV37SSCITQ5IS5AQ4WPF4CF4VZJQPPAROSGXMYOATF5U6XPR", by:"Zeam"},
  "CLPX": {issuer:"GDYSPBVZHPQTYMGSYNOHRZQNLB3ZWFVQ2F7EP7YBOLRGD42XIC3QUX5G", by:"CLPX"},
  "yBTC": {issuer:"GBUVRNH4RW4VLHP4C5MOF46RRIRZLAVHYGX45MVSTKA2F6TMR7E7L6NW", by:"Ultra Capital"},
  "yETH": {issuer:"GDYQNEF2UWTK4L6HITMT53MZ6F5QWO3Q4UVE6SCGC4OMEQIZQQDERQFD", by:"Ultra Capital"},
};
// Every entry must also be in VERIFIED under the same issuer -- otherwise the site would be warning
// about impostors of an asset it does not itself vouch for. Checked at build time so the two lists
// cannot drift apart in a way nobody notices.
for(const c of Object.keys(CANONICAL)){
  if(VERIFIED[c+"|"+CANONICAL[c].issuer]===undefined)
    throw new Error('lib.js: CANONICAL["'+c+'"] names an issuer that is not in VERIFIED — fix one or the other');
}

// the tick itself, so every page draws the same mark
const VTICK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

// What WE show as an asset's home domain, where the on-chain value is stale.
//
// LUMOS's issuer still declares lumosdao.io, the pre-rename domain, and that is genuinely what Horizon and
// the explorers report -- changing it on chain would mean re-issuing the asset. So our own surfaces show
// the current domain and the explorer keeps showing the real one; nothing is concealed, and the link out
// still goes where the chain says.
//
// Deliberately separate from VERIFIED: that map decides whether an asset is trusted (presence only, its
// value is never compared), while this one decides what a reader sees. Folding the two together would mean
// a display tweak could silently grant or revoke a verified tick.
//
// Lives here, like VERIFIED, because a domain that differs between pages is its own kind of wrong.
const DOMAIN_DISPLAY={
  "LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumoscore.com"
};

module.exports={read,getContents,writeContents,VERIFIED,CANONICAL,VTICK_SVG,DOMAIN_DISPLAY};
