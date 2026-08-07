const fs = require('fs');
const path = require('path');
const { read, getContents } = require(__dirname + '/lib.js');
const B = String.fromCharCode(92);

// Higgsfield CDN url for the hero video (used by the portable single-file showcase, which renders
// the landing inside a srcdoc iframe where relative paths can't resolve).
const VIDEO_CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3EfhTtPhk9Omlh8c4nJvum95yNS/hf_20260719_235541_ecea8e8f-e4e9-4798-9e2a-43a8d4cb513b.mp4';

function dataUri(f){ return 'data:image/jpeg;base64,' + fs.readFileSync(path.join('C:/LumosCore/assets', f)).toString('base64'); }

// Showcase landing: images inlined as data URIs (small), video via CDN (works in srcdoc iframe).
function buildShowcaseLanding(){
  let html = read('C:/LumosCore/dist/_landing-preview.html');
  const mono = dataUri('land-monolith.jpg');
  html = html.split('/assets/land-monolith.jpg').join(mono);   // poster + fallback poster div
  html = html.split('/assets/land-coins.jpg').join(dataUri('land-coins.jpg'));
  html = html.split('/assets/land-rocket.jpg').join(dataUri('land-rocket.jpg'));
  html = html.split('/assets/land-monolith.mp4').join(VIDEO_CDN);
  return html;
}

function run(file, landing, write){
  const data = read(file);
  const { json, s, e } = getContents(data);
  if (!json['lumoscore-landing.html']) return 'no-landing-key';
  json['lumoscore-landing.html'] = landing;
  const serialized = JSON.stringify(json).split('</').join('<' + B + '/');
  if (write) fs.writeFileSync(file, data.slice(0,s) + serialized + data.slice(e), 'utf8');
  return 'ok(' + Math.round(landing.length/1024) + 'KB)';
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const landing = buildShowcaseLanding();
for (const f of args.filter(x => x.endsWith('.html'))){
  console.log((write?'[WROTE] ':'[DRY] ') + f.split(/[\\/]/).pop() + '  ' + run(f, landing, write));
}
