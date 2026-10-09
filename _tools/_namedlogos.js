// Curated assets whose logo ships under its OWN name rather than as curated/CODE-ISSUER.png.
//
// Shared by extract_site.js (which builds the page's token registry, so a curated asset's logo is
// known on the FIRST paint instead of after a ~500ms edge lookup) and by _ogcards.js (which draws the
// share cards). Both need the same answer to "where is this asset's logo", and the share cards were
// not asking it at all -- they took whatever the issuer's stellar.toml offered, which for TFT is a
// 32x32 icon that turns to mush at the card's 226px tile, and for EURC is nothing at all, leaving a
// stale render in place while the site showed Circle's real mark.
//
// One file because the alternative is two copies of a map, which is how the XRPL card id pattern
// drifted and served 400s for cards that had been drawn. Issuers are the canonical ones from
// _cctp.js's LX_ASSETS table -- a ticker is not an identity on Stellar, so each is pinned to its
// issuer and nothing is matched on code alone.
const NAMED_LOGOS = {
  'BLND-GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY': '/assets/tokens/blnd.svg',
  'AQUA-GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA': '/assets/tokens/aqua.png',
  'SHX-GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH': '/assets/tokens/shx.png',
  'LUMOS-GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S': '/assets/tokens/lumos.png',
  'USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN': '/assets/tokens/usdc.png',
  'USDT0-GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q': '/assets/tokens/usdt0.png',
};

module.exports = { NAMED_LOGOS };
