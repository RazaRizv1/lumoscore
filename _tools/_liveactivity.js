// Dashboard "Live Platform Activity" -> "Live Network Activity".
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
const LONG = entry('Live Network Activity — Stellar',
  '실시간 네트워크 활동 — Stellar', 'Live-Netzwerkaktivität — Stellar',
  'Activité réseau en direct — Stellar', 'Actividad de red en vivo — Stellar');
const SHORT = entry('Live Network Activity',
  '실시간 네트워크 활동', 'Live-Netzwerkaktivität',
  'Activité réseau en direct', 'Actividad de red en vivo');

let files = 0, headings = 0, dicts = 0;
for (const c of ['aptos','hedera','starknet','vechain','worldchain','stellar','xrpl']) {
  for (const dev of ['desktop','mobile']) {
    const file = `lumoscore-${c}-${dev}.html`;
    let s; try { s = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const before = s;

    // Dictionary entries first: rewrite the whole object so the key AND its translations move together.
    // Values hold no "}", so the non-greedy class is a safe boundary.
    s = s.replace(/\\"Live Platform Activity — Aptos\\":\{[^}]*\}/g, () => { dicts++; return LONG; });
    s = s.replace(/\\"Live Platform Activity\\":\{[^}]*\}/g,        () => { dicts++; return SHORT; });

    // Then the visible headings. Longest form first, so the suffixed one is not half-matched.
    if (s.indexOf('Live Platform Activity — Aptos') >= 0) {
      s = s.split('Live Platform Activity — Aptos').join('Live Network Activity — Stellar'); headings++;
    }
    if (s.indexOf('Live Platform Activity') >= 0) {
      s = s.split('Live Platform Activity').join('Live Network Activity'); headings++;
    }

    if (s !== before) { fs.writeFileSync(file, s, 'utf8'); files++; }
  }
}
console.log('live activity: heading renamed on '+headings+' key(s), '+dicts+' i18n entrie(s), across '+files+' container(s)');
