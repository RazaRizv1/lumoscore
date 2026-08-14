const fs=require('fs');
function read(f){return fs.readFileSync(f,'utf8');}
function getContents(data){
  const i=data.indexOf('id="designContents"');const s=data.indexOf('>',i)+1;const e=data.indexOf('</script>',s);
  return {json:JSON.parse(data.slice(s,e)), s, e};
}
// The container JSON lives INSIDE a <script> tag, so every "</" it contains must go back escaped as "<\/".
// Writing a plain JSON.stringify puts a literal </script> in the middle of the tag: the browser (and
// getContents, which scans for the first </script>) then sees the container end early and the file is
// silently truncated. That corrupted all seven mobile containers once — they are gitignored, so there was
// no undo. Escape on the way out, always.
function writeContents(file, transformFn){
  const data=read(file);
  const {json,s,e}=getContents(data);
  const changed=transformFn(json);
  const B=String.fromCharCode(92);
  const out=data.slice(0,s)+JSON.stringify(json).split('</').join('<'+B+'/')+data.slice(e);
  fs.writeFileSync(file,out,'utf8');
  return changed;
}
// ---- verified issuers: ONE list, shared by every transform that renders a green tick -------------------
// A ticker is not an identity on Stellar. Anyone can issue an asset called USDC and plenty have, so a map
// keyed on code alone would badge the very fakes the tick exists to expose. Keys are CODE|ISSUER, and each
// pair was checked against its own issuer's home_domain on mainnet before being added.
//
// This lives here rather than being copied into each transform because a verified list that drifts between
// pages is worse than none: the same asset would be trustworthy on one screen and not on the next.
const VERIFIED={
  "USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN":"circle.com",
  "EURC|GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2":"circle.com",
  "yXLM|GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55":"ultracapital.xyz",
  "yUSDC|GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF":"ultracapital.xyz",
  "SHX|GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH":"stronghold.co",
  "LUMOS|GB5T2EQC2VDG2XEYQ5C2CQJ2SCB5RFPPWALUU2GQ3R5HUEGOZST55B6S":"lumosdao.io",
  "AQUA|GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA":"aqua.network"
};
// the tick itself, so every page draws the same mark
const VTICK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

module.exports={read,getContents,writeContents,VERIFIED,VTICK_SVG};
