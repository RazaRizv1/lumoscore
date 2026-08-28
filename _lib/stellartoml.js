// The SEP-1 handshake: does this asset's own issuer vouch for it?
//
// A ticker is not an identity on Stellar -- anyone can issue an asset called USDC, and plenty have. So
// the green tick has to be EARNED, and it is earned by the issuer and the domain naming each other:
//
//   1. read the ISSUER ACCOUNT from Horizon and take its on-chain home_domain
//   2. fetch that domain's /.well-known/stellar.toml
//   3. require a [[CURRENCIES]] entry naming the SAME code AND the SAME issuer back
//
// Step 3 is the whole point. home_domain alone proves nothing: anyone can set their account's
// home_domain to circle.com. It only counts when circle.com's own toml names that issuer in return.
// Both halves are required, which is why this cannot be shortcut to "the domain looks right".
//
// Runs server-side so the answer cannot be asserted by a client. The admin panel asks for it; it does
// not get to supply it.

const HORIZON = 'https://horizon.stellar.org';
const CODE_RE = /^[A-Za-z0-9]{1,12}$/;
const ISSUER_RE = /^G[A-Z2-7]{55}$/;

// The domain comes from on-chain data, so it is attacker-influenced: anyone can set home_domain to
// anything. Keep it to a plain public hostname over https -- no ports, no credentials, no private
// hosts -- so this cannot be pointed at internal infrastructure.
function safeDomain(d) {
  const s = String(d || '').trim().toLowerCase();
  if (!s || s.length > 253) return '';
  if (!/^[a-z0-9.-]+$/.test(s)) return '';
  if (s.indexOf('.') < 0) return '';
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(s)) return '';
  return s;
}

// A deliberately small TOML reader: stellar.toml is a flat file of `key = value` lines inside [TABLE]
// and [[ARRAY]] headers, and that is all this needs to understand. Bringing in a full TOML parser for
// it would be a dependency for six field reads.
function parseToml(text) {
  const out = { root: {}, tables: {}, arrays: {} };
  let cur = out.root;
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const hash = findComment(line);
    if (hash >= 0) line = line.slice(0, hash);
    line = line.trim();
    if (!line) continue;

    let m = line.match(/^\[\[\s*([A-Za-z0-9_.-]+)\s*\]\]$/);
    if (m) {
      const k = m[1].toUpperCase();
      if (!out.arrays[k]) out.arrays[k] = [];
      cur = {};
      out.arrays[k].push(cur);
      continue;
    }
    m = line.match(/^\[\s*([A-Za-z0-9_.-]+)\s*\]$/);
    if (m) {
      const k = m[1].toUpperCase();
      cur = out.tables[k] = out.tables[k] || {};
      continue;
    }
    m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toUpperCase();
    let val = m[2].trim();

    // A multi-line string keeps going until the closing """.
    if (val.slice(0, 3) === '"""') {
      let body = val.slice(3);
      if (body.indexOf('"""') >= 0) { body = body.slice(0, body.indexOf('"""')); }
      else {
        for (i = i + 1; i < lines.length; i++) {
          const l2 = lines[i];
          const end = l2.indexOf('"""');
          if (end >= 0) { body += '\n' + l2.slice(0, end); break; }
          body += '\n' + l2;
        }
      }
      cur[key] = body.trim();
      continue;
    }
    if (val.charAt(0) === '[') {           // arrays: keep the first entry, which is all we read
      const inner = val.replace(/^\[|\]$/g, '');
      const first = inner.split(',')[0] || '';
      cur[key] = unquote(first.trim());
      continue;
    }
    cur[key] = unquote(val);
  }
  return out;
}

// A # inside a quoted value is content, not a comment.
function findComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q && line[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#') return i;
  }
  return -1;
}

function unquote(v) {
  const s = String(v == null ? '' : v).trim();
  if ((s.charAt(0) === '"' && s.slice(-1) === '"') || (s.charAt(0) === "'" && s.slice(-1) === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

async function getText(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 6000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', cf: { cacheTtl: 300 } });
    if (!r.ok) return null;
    return await r.text();
  } catch (_) { return null; } finally { clearTimeout(t); }
}

// Reports WHY it failed, not just that it did. "no toml at aqua.network" and "the toml does not list
// this issuer" are different problems with different fixes, and an admin who is told which one can act.
export async function verifyAsset(code, issuer) {
  const out = {
    asset: code + '-' + issuer, verified: false, domain: '', reason: '',
    toml: null, checkedAt: Date.now(),
  };
  if (!CODE_RE.test(code) || !ISSUER_RE.test(issuer)) { out.reason = 'bad asset id'; return out; }

  const accTxt = await getText(HORIZON + '/accounts/' + issuer, 6000);
  if (!accTxt) { out.reason = 'issuer account not found on Horizon'; return out; }
  let acc; try { acc = JSON.parse(accTxt); } catch (_) { out.reason = 'Horizon returned junk'; return out; }

  const domain = safeDomain(acc.home_domain);
  if (!domain) {
    out.reason = acc.home_domain ? 'issuer home_domain is not a usable public domain' : 'issuer has no home_domain set';
    return out;
  }
  out.domain = domain;

  // Retried once, and not on a short leash. ultracapital.xyz answers in ~3.4s and a 7s timeout failed
  // it intermittently -- an asset losing its tick because a server was slow that second is the worst
  // kind of wrong here, since it looks exactly like the asset being fraudulent.
  let tomlTxt = await getText('https://' + domain + '/.well-known/stellar.toml', 10000);
  if (!tomlTxt) tomlTxt = await getText('https://' + domain + '/.well-known/stellar.toml', 10000);
  if (!tomlTxt) { out.reason = 'no stellar.toml at ' + domain; return out; }
  if (tomlTxt.length > 400000) { out.reason = 'stellar.toml at ' + domain + ' is implausibly large'; return out; }

  const t = parseToml(tomlTxt);
  const currencies = t.arrays.CURRENCIES || [];
  const hit = currencies.filter((c) => String(c.CODE || '') === code && String(c.ISSUER || '') === issuer)[0];

  const doc = t.tables.DOCUMENTATION || {};
  // Returned whether or not the handshake passed: an unverified asset can still have a usable name and
  // logo to prefill the form with, it just does not get a tick.
  out.toml = {
    name: (hit && (hit.NAME || hit.CODE)) || doc.ORG_NAME || '',
    description: (hit && (hit.DESC || hit.DESCRIPTION)) || doc.ORG_DESCRIPTION || '',
    image: (hit && hit.IMAGE) || doc.ORG_LOGO || '',
    website: doc.ORG_URL || (domain ? 'https://' + domain : ''),
    twitter: doc.ORG_TWITTER || '',
    telegram: doc.ORG_TELEGRAM || '',
    discord: '',
    orgName: doc.ORG_NAME || '',
  };

  if (!hit) {
    out.reason = currencies.length
      ? ('the toml at ' + domain + ' does not list ' + code + ' under this issuer')
      : ('the toml at ' + domain + ' has no [[CURRENCIES]] entries');
    return out;
  }
  out.verified = true;
  out.reason = 'issuer home_domain ' + domain + ' lists this exact code and issuer';
  return out;
}

export { parseToml, safeDomain };
