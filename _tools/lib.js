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

  // LumosCore-minted assets. Pinned by code|issuer, NOT matched on home_domain: home_domain is
  // self-declared and nothing checks it, so any issuer on Stellar can point at lumoscore.com. A
  // domain-matched tick would therefore be forgeable by anyone -- an exact pair cannot be.
  //
  // The tick here asserts "minted on LumosCore", which is not the same claim as Circle standing behind
  // USDC. Keeping the list explicit is what makes that a decision rather than an accident: a new mint
  // gets no tick until it is added here on purpose.
  "FOX|GCVCLOBTVUZGMFP6P7KKYQQNCEFJBFCRYKKU5ER5GDI6AGALBCYTADUT":"lumoscore.com",
  "RICHARD|GAH5ZTQUJRJALC6CIY5PZLVEWHPEGL6QBHKLIQK2DZQX7QK46KGC3VDM":"lumoscore.com",
  "WHALEUM|GD5TUISLVQSNU7ELX4CXG52YOPTP53SIHMWKPN4M3KU6O6AMK2K73DOZ":"lumoscore.com",
  "XLIQM|GCYD6UCJZQ6GBACACKJLBMEYP7LNTPLCIRT6WN5GAZ754PHWRADGL2MT":"lumoscore.com",
  "BEAR|GACMOLVJSPD6U2LJXAMA5N5BDOXO7JZTEFMZBMQSGR7TZIIOVBLJENQI":"lumoscore.com",
  "PUMP|GCKMG35B6ZN3QZ6WXRKTYFQ6LD5MN2QWNITQQSVAQUKGT4YZBGMQDNAZ":"lumoscore.com",
  "PEPE|GDIZKTYAHXZEGGGHRO43PH3GQ4GPSJRAYJDRJRLBBP6F5754D4IGTHPI":"lumoscore.com",
  "ZBS|GCCNOK2CKSVOGKOQO646LSFZQ3YDIIBVHDAKUNX4RANCQMKOG4BUF622":"lumoscore.com",
  "FED|GA7OS5RZAVW2Q4RQJTP5IR63CGSTQASIIYLF4JHPJEPZKIJJ6N7LDQ3X":"lumoscore.com",
  "NEIRO|GDI3PYAWVDV3G6OVAFCYVD3WTYXBOXDHJB7HW4GCNO3K522P5HN3GL3D":"lumoscore.com",
  "PENGULUMENS|GCV4SUWKHDKW5FARQ7OOYIGYD3UN2V5L5IMVSVT5Z2HUA6BND4WOAA2A":"lumoscore.com",
  "GROK|GA4EKP4J7NY2N33HQUGJFAHG6KLTHHQWBFDLRIUKCDZHLC53R5ALXSYZ":"lumoscore.com",
  "LIBERATOR|GCV4LXAU5PMYTIO7P5USPE2HUKLRCV2PPMULTOQSZESFLJLVL25W6D7F":"lumoscore.com",
  "BLA|GB3EGACGDTQX53JSGGFEJDXGNHSCPQMIZ2YZHILVPVGDUO3HXW4TA3KP":"lumoscore.com",
  "BRIDGE|GBEM54SCE7Z7SKNT3OUS23BS3BY3WOAPA4B2JALT3XFJOKHZKQFYQYKF":"lumoscore.com",
  "HULK|GDZYOYFSBE72DHLUSQWT6KY3KIL3GNDDZF6LC4KF6LQZM2XZAYCXZANR":"lumoscore.com",
  "BROT|GA6FEQQ3KJE7JDTCYSXOWQRLZVM4CLDI3K626GWFOMNIIUYQC5GIFSZ2":"lumoscore.com",
  "REKT|GBWSN4TN2RL6CLZXXBJ24EYYFTVYKSXFRZ44GC4HQENHTY4JRX5MTTBG":"lumoscore.com",
  "ZOMBIE|GCH5HQ4J4W3H7OSGQ4YMRTYAPIR6V5IB2RSYO7JENQU5OUCZZQFBFHGM":"lumoscore.com",
  "GLTCH|GARFKDT7OS5FK2W2ZGLEQWXGUSRHWGZUXT4LMCFLEA6JPLR75ZXMDPCJ":"lumoscore.com",
  "TDT|GBINRJAGLT2WN6DK2I47QKMKEJW56ASPO6K2GQPCLY7ZO7TAQMKUBPOG":"lumoscore.com",
  "POTATO|GC3T4CLTJGDUDJHRDW7USQZ2OWSUWT7MCKHTZAPWGHK7SCCWRKCQKQSM":"lumoscore.com",
  "MILL|GBGIFSMT3BR3BSRPYXRM7WCOZYVJETZ5QUUXHRP4ENBE34JDCLBQXSHE":"lumoscore.com",
  "JROLL|GDFUI5WI3I3XAU2OI63KE4QNIG3BILK7BVBZTJUJSDNJMATOSPPX4XUI":"lumoscore.com",
  // Absent until now only because stellar.expert reports domain:(none) for it, so it never surfaced
  // in the discovery query this list was built from. The ledger is unambiguous: home_domain is
  // lumoscore.com and the issuer account was created by the LumosCore funding wallet.
  "WAZAAA|GDRY3U75Z5VJ3SY4VXFZUDPZEBWPLJBGWQF2XZMB4DFTWAWYDVTGJ57A":"lumoscore.com"
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
