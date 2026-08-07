// Remove the now-defunct user concept from all showcase files (desktop + mobile):
//  1) search "Users" results section  2) user Profile + Settings pages  3) "guest" user options
// Guest is now the only user type, so guest-specific UI/labels go away.
// Usage: node _tools/cleanup_users.js [--write]
const fs = require('fs');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

const DEL_KEY = /^lumoscore-(profile|user-settings)(-light|-dark|-mobile)?\.html$/;

// Remove the search-panel "Users" section: <sp-divider> + section-head + #spUserList
function removeSearchUsers(h){
  let out = h, guard = 0;
  while (guard++ < 6){
    const ul = out.indexOf('id="spUserList"');
    if (ul < 0) break;
    let st = out.indexOf('>', ul) + 1, d = 1, i = st;
    while (d > 0){ const n = out.indexOf('<div', i), c = out.indexOf('</div>', i); if (c < 0) break; if (n >= 0 && n < c){ d++; i = n + 4; } else { d--; i = c + 6; } }
    const divStart = out.lastIndexOf('<div class="sp-divider"', ul);
    const start = divStart >= 0 ? divStart : out.lastIndexOf('<div class="sp-section-head"', ul);
    if (start < 0) break;
    out = out.slice(0, start) + out.slice(i);
  }
  return out;
}
// Remove every <div class="lc-guest-section"> ... </div>
function removeGuest(h){
  let out = h, guard = 0;
  while (guard++ < 6){
    const g = out.indexOf('<div class="lc-guest-section"');
    if (g < 0) break;
    let st = out.indexOf('>', g) + 1, d = 1, i = st;
    while (d > 0){ const n = out.indexOf('<div', i), c = out.indexOf('</div>', i); if (c < 0) break; if (n >= 0 && n < c){ d++; i = n + 4; } else { d--; i = c + 6; } }
    out = out.slice(0, g) + out.slice(i);
  }
  return out;
}
// Neutralize profile navigation (desktop account widget + mobile avatar link)
function stripProfileNav(h){
  let out = h;
  // desktop: <div class="nx-acct" data-lxwired onclick="__lxNav('lumoscore-profile*.html')" style="cursor:pointer">
  out = out.replace(/ onclick="__lxNav\('lumoscore-profile[a-z-]*\.html'\)" style="cursor:pointer"/g, '');
  out = out.replace(/ onclick="__lxNav\('lumoscore-profile[a-z-]*\.html'\)"/g, '');
  // mobile + any direct refs to deleted pages -> inert '#'
  out = out.split('lumoscore-profile-mobile.html').join('#');
  out = out.split('lumoscore-user-settings-mobile.html').join('#');
  return out;
}

const chains = ['aptos','hedera','starknet','vechain','worldchain'];
const files = [];
for (const c of chains){ files.push(`lumoscore-${c}-desktop.html`, `lumoscore-${c}-mobile.html`); }

const write = process.argv.includes('--write');
for (const file of files){
  const data = read(file);
  const { json, s, e } = getContents(data);
  const stat = { delKeys:0, users:0, guest:0 };
  // 1) delete profile/settings page keys
  for (const k of Object.keys(json)){
    if (DEL_KEY.test(k)){ delete json[k]; stat.delKeys++; }
  }
  // 2) transform remaining pages
  for (const k of Object.keys(json)){
    let h = json[k];
    const hadU = h.includes('id="spUserList"'); const hadG = h.includes('<div class="lc-guest-section"');
    h = removeSearchUsers(h);
    h = removeGuest(h);
    h = stripProfileNav(h);
    if (hadU) stat.users++;
    if (hadG) stat.guest++;
    json[k] = h;
  }
  if (write){
    const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
    fs.writeFileSync(file, data.slice(0, s) + serialized + data.slice(e), 'utf8');
  }
  console.log(`${write?'[WROTE]':'[DRY]'} ${file}: delKeys=${stat.delKeys} usersStripped=${stat.users} guestStripped=${stat.guest}`);
}
