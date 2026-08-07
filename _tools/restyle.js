const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');

// New Google Fonts href: Hanken Grotesk (UI/display) + JetBrains Mono (data)
const NEW_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap';

// Ordered list of literal string replacements. Applied with split/join (safe, no regex escaping).
const B = String.fromCharCode(92);
const FONT_NAME_REPLACERS = [
  ["'Plus Jakarta Sans'", "'Hanken Grotesk'"],
  ['"Plus Jakarta Sans"', '"Hanken Grotesk"'],
  ["'Inter Tight'", "'Hanken Grotesk'"],
  ['"Inter Tight"', '"Hanken Grotesk"'],
  ["'Inter'", "'Hanken Grotesk'"],
  ['"Inter"', '"Hanken Grotesk"'],
];

// Color remap (lowercase hex -> new). Case-insensitive handled below.
const COLOR_MAP = {
  // primary: hot orange -> refined ember
  '#ff7a30': '#ea6a2c',
  // lighter orange partner (gradients / hovers) -> ember-2
  '#ff8843': '#ff894c',
  '#ff8a45': '#ff894c',
  '#ff8a4a': '#ff894c',
  // secondary blue -> iris (premium)
  '#4d8bff': '#8b7bff',
  // green / semantic refine
  '#34d27a': '#35c07f',
  // warm-neutral steps
  '#0b0b0e': '#0a0a0b',
  '#131318': '#131317',
  '#18181f': '#1a1a1f',
  '#25252d': '#26262c',
  '#32323c': '#34343c',
  '#f4f4f6': '#f6f5f3',
  '#9a9aa5': '#a5a4ac',
  '#6b6b76': '#6e6d78',
};
// rgba() variants of the accent + secondary
const RGBA_MAP = [
  ['rgba(255,122,48,', 'rgba(234,106,44,'],
  ['rgba(255, 122, 48,', 'rgba(234, 106, 44,'],
  ['rgba(77,139,255,', 'rgba(139,123,255,'],
  ['rgba(77, 139, 255,', 'rgba(139, 123, 255,'],
];

function replaceHexCaseInsensitive(html, from, to){
  // match #rrggbb in either case
  const re = new RegExp(from.replace('#','#'), 'gi');
  return html.replace(re, to);
}

function restyle(html){
  let out = html, stats = { font:0, names:0, colors:0, rgba:0 };

  // 1) Swap Google Fonts css2 <link> href(s)
  out = out.replace(/https:\/\/fonts\.googleapis\.com\/css2\?family=[^"']*/g, () => { stats.font++; return NEW_FONT_HREF; });

  // 2) Font-family name swaps
  for (const [a, b] of FONT_NAME_REPLACERS){
    const before = out.length; const parts = out.split(a);
    if (parts.length > 1){ stats.names += parts.length - 1; out = parts.join(b); }
  }

  // 3) Hex color remap (case-insensitive)
  for (const from of Object.keys(COLOR_MAP)){
    const to = COLOR_MAP[from];
    const re = new RegExp(from, 'gi');
    const m = out.match(re);
    if (m){ stats.colors += m.length; out = out.replace(re, to); }
  }

  // 4) rgba() remaps
  for (const [a, b] of RGBA_MAP){
    const parts = out.split(a);
    if (parts.length > 1){ stats.rgba += parts.length - 1; out = parts.join(b); }
  }

  return { out, stats };
}

// ---- Drivers ----
function restyleStandaloneFile(file, write){
  const html = read(file);
  const { out, stats } = restyle(html);
  if (write) fs.writeFileSync(file, out, 'utf8');
  return stats;
}

function restyleShowcaseFile(file, write){
  const data = read(file);
  const { json, s, e } = getContents(data);
  const total = { font:0, names:0, colors:0, rgba:0 };
  for (const k of Object.keys(json)){
    const { out, stats } = restyle(json[k]);
    json[k] = out;
    for (const kk in stats) total[kk] += stats[kk];
  }
  // also restyle the shell chrome (outside designContents) — fonts/colors in the shell UI
  let head = data.slice(0, s);
  let tail = data.slice(e);
  const rHead = restyle(head); const rTail = restyle(tail);
  head = rHead.out; tail = rTail.out;
  for (const kk in total){ total[kk] += rHead.stats[kk] + rTail.stats[kk]; }
  // re-serialize designContents with </ escaped so no literal </script> closes the JSON tag
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  const outFile = head + serialized + tail;
  if (write) fs.writeFileSync(file, outFile, 'utf8');
  return total;
}

module.exports = { restyle, restyleStandaloneFile, restyleShowcaseFile };

// CLI: node restyle.js --standalone <files...>   |   node restyle.js --showcase <files...>   (add --write to persist)
if (require.main === module){
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const mode = args.includes('--showcase') ? 'showcase' : 'standalone';
  const files = args.filter(a => a.endsWith('.html'));
  for (const f of files){
    const stats = mode === 'showcase' ? restyleShowcaseFile(f, write) : restyleStandaloneFile(f, write);
    console.log((write ? '[WROTE] ' : '[DRY] ') + f.split(/[\\/]/).pop(),
      '| fontLink:' + stats.font, 'nameSwaps:' + stats.names, 'colors:' + stats.colors, 'rgba:' + stats.rgba);
  }
}
