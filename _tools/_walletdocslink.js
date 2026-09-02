// "New to wallets?" in the Connect Wallet modal had no destination.
//
// It shipped as <a class="lxw-foot-link"> with no href at all -- styled as a link, announced as
// nothing, and inert on click. It now points at the beginner's guide on the blog.
//
// OPENS IN A NEW TAB, deliberately. The link sits inside the connect-wallet modal, which is almost
// always opened mid-task; navigating the page away would abandon whatever the user was part-way
// through. rel="noopener noreferrer" goes with target="_blank" as a matter of course.
//
// The markup lives inside a JS string that builds the modal, so this is a plain string replacement
// across every page that carries the modal -- 90-odd of them. Idempotent: a page that already has the
// href is left alone, and the count is reported so a silent no-op is visible.

const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const URL = 'https://lumoscore.com/blog/new-to-wallets-a-beginner-s-guide-to-stellar-wallets';
const FROM = '<a class="lxw-foot-link">';
const TO = '<a class="lxw-foot-link" href="' + URL + '" target="_blank" rel="noopener noreferrer">';

const FILES = ['lumoscore-aptos-desktop.html', 'lumoscore-aptos-mobile.html'];
const problems = [];
const staged = [];

for (const file of FILES) {
  let data; try { data = read(file); } catch (e) { problems.push(file + ': unreadable'); continue; }
  const { json, s, e } = getContents(data);
  let linked = 0, already = 0;

  for (const key of Object.keys(json)) {
    const html = json[key];
    if (html.indexOf(TO) >= 0) { already++; continue; }
    const n = html.split(FROM).length - 1;
    if (!n) continue;
    // One modal per page. More than one means the page is not what this expects, and blindly
    // rewriting every match would be guessing.
    if (n > 1) { problems.push(key + ': ' + n + ' wallet-modal footer links, expected 1'); break; }
    json[key] = html.split(FROM).join(TO);
    linked++;
  }

  if (problems.length) break;
  staged.push({ file, data, s, e, json, linked, already });
}

if (problems.length) {
  console.error('wallet docs link: ABORT — nothing written.');
  problems.forEach(x => console.error('  ' + x));
  process.exit(1);
}
const total = staged.reduce((a, st) => a + st.linked + st.already, 0);
if (!total) {
  console.error('wallet docs link: ABORT — the modal footer link was not found on any page.');
  process.exit(1);
}
for (const st of staged) {
  const ser = JSON.stringify(st.json).split('</').join('<' + B + '/');
  fs.writeFileSync(st.file, st.data.slice(0, st.s) + ser + st.data.slice(st.e), 'utf8');
  console.log('  ' + st.file + ': ' + st.linked + ' linked, ' + st.already + ' already pointing there');
}
console.log('wallet docs link: done');
