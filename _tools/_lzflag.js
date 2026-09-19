// ONE SWITCH FOR THE LAYERZERO / USDT0 ROUTE.
//
// Everything about the second bridge route hangs off this single boolean, because the parts must never disagree:
//
//   _lzusdt0.js   makes the LayerZero card selectable (LZ_SENDABLE) and reveals the 8 LayerZero-only destinations
//   _faq.js       swaps the bridge FAQ between the CCTP-only set and the two-route set
//   _cctp.js      the page title and the sub-heading
//   _seo.js       the site description and the chain count
//
// Turning it on while any one of them lagged would put a real promise on the page that the product cannot keep --
// copy advertising 16 chains over a dropdown showing 8, or a selectable route with no working send path. Flip this,
// rebuild, and every surface moves together.
//
// DO NOT FLIP THIS until a real LayerZero transfer has round-tripped a signature on mainnet. As of 2026-09-17 the
// send path has been validated only by simulateTransaction (a read-only dry run): it was accepted into the token
// transfer and refused there on balance, which proves the call is correct but proves nothing about signing,
// submission or delivery.
// DRIVEN BY THE ENVIRONMENT, defaulting to OFF, so that turning it on for a staging build can never leak into a
// production one by way of an edited file someone forgot to revert:
//
//   staging (route visible, sendable):   LZ_LIVE=1 node _tools/_cctp.js ... && LZ_LIVE=1 npm run build
//   production (default):                npm run build
//
// A push to main builds from the committed source with no such variable set, so main is off unless somebody
// deliberately changes this line.
// SWITCHED ON FOR PRODUCTION 2026-09-19 (RAZA: 'switch them on'). Both routes had round-tripped real transfers on
// mainnet by then -- LayerZero (1 XLM -> USDT0 on Sei, delivered; the first send delivered in 27.6 min) and NEAR Intents
// (three transfers, all SUCCESS). So the default is now ON, and the routes are withdrawn only DELIBERATELY:
//
//   production + staging (default):   npm run build            (LayerZero + NEAR Intents sendable)
//   routes withdrawn:                 LZ_LIVE=0 node _tools/... && LZ_LIVE=0 npm run build
//
// Defaulting to off after the launch would have been the dangerous direction: any routine rebuild would have
// silently switched both routes off on production.
module.exports = { LZ_LIVE: process.env.LZ_LIVE !== '0' };
