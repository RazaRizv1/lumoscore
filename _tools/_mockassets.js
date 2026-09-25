// Strip the Aptos asset-picker mock out of the SERVED HTML.
//
// RAZA sent a screenshot of an assistant, connected through LumosCore MCP, answering "how many pools
// does lumoscore have on Stellar": it said the public Pools page "displays conflicting Stellar and
// Aptos data, so neither gives me a reliable total". It was right. /pools/stellar and the dashboard
// shipped this in their markup, desktop and mobile:
//
//   data-asset="APT"   data-asset-name="Aptos"         data-asset-bal="12,847.50"
//   data-asset="LUMOS" data-asset-name="Lumos"         data-asset-bal="58,932.10"
//   data-asset="AMI"   data-asset-name="Yieldblox APT" data-asset-bal="0.00"
//
// Leftovers from the Aptos design template, carrying INVENTED BALANCES presented as someone's
// holdings, each with an Aptos logo baked in as base64.
//
// A human never saw any of it: _ammdata's fill() does list.innerHTML = ... and replaces the whole
// dropdown with the real Stellar assets before anyone opens it. That is exactly why it survived --
// every check anyone ran was on the rendered page. Crawlers, LLMs and the connector's own web fetch
// read the markup, and for an MCP server the audience IS machines reading the markup.
//
// The buttons are REWRITTEN, not removed. fill() rebuilds the list and binds its own handlers to
// .lx-cpitem, so deleting these would be safe today -- but an empty picker on any page where that
// builder has not run yet is a worse failure than a correct static one, and keeping the node count
// and structure identical means nothing downstream can notice.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];

// The mock roster, in the order the template lists it, mapped to real Stellar assets. Codes and names
// only -- no balances, because this file is not in a position to know anyone's balance, which was the
// whole problem.
const MAP = {
  APT: { code: 'XLM', name: 'Stellar Lumens' },
  USDC: { code: 'USDC', name: 'USD Coin' },
  LUMOS: { code: 'LUMOS', name: 'Lumos' },
  GUI: { code: 'KALE', name: 'Kale' },
  AMI: { code: 'yXLM', name: 'Yieldblox XLM' },
  CELL: { code: 'AQUA', name: 'Aquarius' },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// one static mock button: identified by data-asset-bal, which only the baked markup carries (the
// runtime rows use data-code/data-issuer and do not exist at build time).
const BUTTON = /<button\b[^>]*class="ad-item"[^>]*data-asset-bal="[^"]*"[^>]*>[\s\S]*?<\/button>/g;

let problems = [];
const staged = [];

for (const file of FILES) {
  if (!fs.existsSync(file)) { problems.push(file + ': missing'); continue; }
  const data = read(file);
  const { json, s, e } = getContents(data);
  let touched = 0, already = 0, pages = 0;

  for (const key of Object.keys(json)) {
    const html = String(json[key] || '');
    if (html.indexOf('data-asset-bal="') < 0) continue;
    let n = 0;
    const out = html.replace(BUTTON, (block) => {
      // IDEMPOTENCE. A rewritten row still carries data-asset-bal (now empty), so it still matches the
      // pattern; on the second run its code is XLM, which is not in MAP, and an unmapped code aborts the
      // whole chain. The marker is what tells the two apart -- without it this transform breaks the build
      // the moment anyone runs it twice, which is every build after this one.
      // An emptied balance is the other half of the signature, and the half that survives a run made
      // before the marker existed. Either one means this row has been through here already.
      if (block.indexOf('data-lxreal=') >= 0 || /data-asset-bal=""/.test(block)) { already++; return block; }
      const code = (/data-asset="([^"]*)"/.exec(block) || [])[1] || '';
      const to = MAP[code];
      // an unknown code means the template changed under us: leave it alone and say so, rather than
      // inventing a mapping.
      if (!to) { problems.push(key + ': unmapped mock asset "' + code + '"'); return block; }
      n++;
      let b = block;
      b = b.replace(/class="ad-item"/, 'class="ad-item" data-lxreal="1"');
      b = b.replace(/data-asset="[^"]*"/, 'data-asset="' + esc(to.code) + '"');
      b = b.replace(/data-asset-name="[^"]*"/, 'data-asset-name="' + esc(to.name) + '"');
      b = b.replace(/data-asset-bal="[^"]*"/, 'data-asset-bal=""');
      // the Aptos mark, inlined as base64. The runtime resolver fetches the real token art; the
      // coloured letter underneath is the correct fallback until it does.
      b = b.replace(/<img\s+src="data:image[^"]*"[^>]*>/g, '');
      b = b.replace(/(<span class="ad-tk">)[^<]*(<\/span>)/, '$1' + esc(to.code) + '$2');
      b = b.replace(/(<span class="ad-nm">)[^<]*(<\/span>)/, '$1' + esc(to.name) + '$2');
      b = b.replace(/(<span class="ad-bal">)[^<]*(<\/span>)/, '$1$2');
      return b;
    });
    if (n) { json[key] = out; touched += n; pages++; }
  }

  // zero is only acceptable when the rows are already marked done -- zero and nothing marked means the
  // markup moved and this transform is now silently doing nothing.
  if (!touched && !already) { problems.push(file + ': no static asset-picker mock found'); continue; }
  staged.push({ file, data, s, e, json, touched, already, pages });
}

if (problems.length) {
  console.error('mock assets: ABORT — nothing written.');
  problems.forEach((x) => console.error('  ' + x));
  process.exit(1);
}

for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': ' + st.touched + ' mock row(s) rewritten across ' + st.pages
    + ' page(s)' + (st.already ? ', ' + st.already + ' already clean' : ''));
}
console.log('mock assets: done');
