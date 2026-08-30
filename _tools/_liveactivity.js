// Dashboard "Live Network Activity" -> "Live Platform Activity".
//
// This ran the other way round for as long as the panel streamed horizon /trades: the feed was the
// whole Stellar network, so calling it "platform" activity was a claim the data did not support.
// The feed reads LumosCore's own fee collector now (see _realdata.js), so the honest name is back.
//
// It is a feed of Stellar ledger operations — payments, trades, trustlines — not activity on LumosCore, so
// "platform" claimed the wrong thing. Requested for both layouts.
//
// The string lives in three places per container and all three must move together, or the i18n lookup breaks:
//   1. the visible <h3> in the dashboard's .activity-card;
//   2. an i18n dictionary KEY, which is the English string verbatim — rename the heading without the key and
//      every non-English visitor falls back to the raw English;
//   3. the ko/de/fr/es VALUES under that key, which all said "platform" in their own language.
//
// The desktop heading also carried "— Aptos" while mobile carried no suffix at all: a leftover from the
// multi-chain design that the Stellar re-theme missed, sitting on the dashboard of a Stellar-only app. Since
// this is the very string being edited, it becomes "— Stellar" rather than being left wrong.
//
// Idempotent: the old phrasing is gone after the first run, so re-running changes nothing.
//
// Usage: node _tools/_liveactivity.js
const fs = require('fs');

// Rebuilt dictionary entries. Values are escaped exactly as they sit in the container (\" around each token).
function entry(key, ko, de, fr, es){
  const Q = '\\"';
  return Q+key+Q+':{'+Q+'ko'+Q+':'+Q+ko+Q+','+Q+'de'+Q+':'+Q+de+Q+','
        +Q+'fr'+Q+':'+Q+fr+Q+','+Q+'es'+Q+':'+Q+es+Q+'}';
}
const LONG = entry('Live Platform Activity — Stellar',
  '실시간 플랫폼 활동 — Stellar', 'Live-Plattformaktivität — Stellar',
  'Activité de la plateforme en direct — Stellar', 'Actividad de la plataforma en vivo — Stellar');
const SHORT = entry('Live Platform Activity',
  '실시간 플랫폼 활동', 'Live-Plattformaktivität',
  'Activité de la plateforme en direct', 'Actividad de la plataforma en vivo');

let files = 0, headings = 0, dicts = 0;
for (const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']) {
  for (const dev of ['desktop','mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let s; try { s = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const before = s;

    // Dictionary entries first: rewrite the whole object so the key AND its translations move together.
    // Values hold no "}", so the non-greedy class is a safe boundary.
    s = s.replace(/\\"Live (?:Network|Platform) Activity — (?:Aptos|Stellar)\\":\{[^}]*\}/g, () => { dicts++; return LONG; });
    s = s.replace(/\\"Live (?:Network|Platform) Activity\\":\{[^}]*\}/g,        () => { dicts++; return SHORT; });

    // Then the visible headings. Longest form first, so the suffixed one is not half-matched.
    for (const from of ['Live Platform Activity — Aptos', 'Live Network Activity — Stellar']) {
      if (s.indexOf(from) >= 0) { s = s.split(from).join('Live Platform Activity — Stellar'); headings++; }
    }
    // Longest form first above, so this cannot half-match the suffixed one.
    if (s.indexOf('Live Network Activity') >= 0) {
      s = s.split('Live Network Activity').join('Live Platform Activity'); headings++;
    }
    // The phone said only "Live Platform Activity" while the desktop said "— Stellar", so the one
    // layout that gives no other clue which chain it is showing was the one that named no chain.
    //
    // Anchored on the closing </h3> so it cannot also rewrite the i18n KEY, which is the bare string
    // and was already rebuilt above. BOTH spellings of that tag are tried: the heading lives inside
    // the container's JSON, where every "</" is stored escaped as "<\/", so matching the plain form
    // alone finds nothing and reports a clean run having changed not a thing.
    const H3 = '<' + String.fromCharCode(92) + '/h3>';
    for (const close of [H3, '</h3>']) {
      const from = 'Live Platform Activity' + close;
      if (s.indexOf(from) >= 0) {
        s = s.split(from).join('Live Platform Activity — Stellar' + close);
        headings++;
      }
    }

    if (s !== before) { fs.writeFileSync(file, s, 'utf8'); files++; }
  }
}
console.log('live activity: heading renamed on '+headings+' key(s), '+dicts+' i18n entrie(s), across '+files+' container(s)');
