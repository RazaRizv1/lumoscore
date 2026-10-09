// The card design's generation number, shared by the endpoint that STORES a browser-rendered card
// and the one that SERVES it.
//
// Bump it whenever the card design changes. Two things then happen on their own: /lxapi/ogcard stops
// trusting every stored card drawn by the previous design (it compares this against the version
// recorded beside the bytes, and falls through to the build's own file instead), and its edge cache
// key changes so the previous generation leaves the cache rather than being served for another day.
//
// Keeping it here rather than in either endpoint is the point: a card stored under one number and
// read under another would either be served after the design moved on, or thrown away for ever.
// 6: the XRPL asset cards gained the "Listed asset" badge, to match the tick dexasset.js already
// shows on every page in the top-100 roster.
export const CARD_V = 6;
