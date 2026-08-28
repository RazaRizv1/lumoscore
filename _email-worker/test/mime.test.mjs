// Exercise the email parser against the shapes real support mail actually arrives in.
import { parse, decodeWords, nameOf } from '../src/index.js';

const CRLF = '\r\n';
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = String(got).trim() === String(want).trim();
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name);
  if (!ok) { console.log('        got:  ' + JSON.stringify(String(got).slice(0, 120)));
             console.log('        want: ' + JSON.stringify(String(want).slice(0, 120))); }
  ok ? pass++ : fail++;
}

// 1. the simplest possible message
const plain = ['From: Alice <alice@example.com>', 'Subject: Hello there', 'Message-ID: <abc@x>', '',
  'Just a plain body.'].join(CRLF);
check('plain text body', parse(plain).text, 'Just a plain body.');
check('plain subject', parse(plain).headers.subject, 'Hello there');
check('display name', nameOf(parse(plain).headers.from), 'Alice');

// 2. quoted-printable, which is what most mail clients send for anything with an accent or a long line
const qp = ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '',
  'Caf=C3=A9 costs =E2=82=AC5 and this line is soft-wrapped =', 'right here.'].join(CRLF);
check('quoted-printable + soft wrap', parse(qp).text, 'Café costs €5 and this line is soft-wrapped right here.');

// 3. base64
const b64body = Buffer.from('Base64 encoded body.', 'utf8').toString('base64');
const b64 = ['Content-Type: text/plain', 'Content-Transfer-Encoding: base64', '', b64body].join(CRLF);
check('base64 body', parse(b64).text, 'Base64 encoded body.');

// 4. multipart/alternative -- we want the plain half, not the HTML
const alt = ['Content-Type: multipart/alternative; boundary="BND1"', '',
  '--BND1', 'Content-Type: text/plain', '', 'The plain version.', '',
  '--BND1', 'Content-Type: text/html', '', '<p>The HTML version.</p>', '',
  '--BND1--'].join(CRLF);
check('multipart picks text/plain', parse(alt).text, 'The plain version.');
check('multipart also keeps html', parse(alt).html, '<p>The HTML version.</p>');

// 5. multipart/mixed wrapping multipart/alternative -- an attachment turns every message into this
const nested = ['Content-Type: multipart/mixed; boundary="OUT"', '',
  '--OUT', 'Content-Type: multipart/alternative; boundary="IN"', '',
  '--IN', 'Content-Type: text/plain', '', 'Nested plain text.', '',
  '--IN', 'Content-Type: text/html', '', '<p>Nested html.</p>', '',
  '--IN--', '',
  '--OUT', 'Content-Type: application/pdf; name="invoice.pdf"', 'Content-Transfer-Encoding: base64', '',
  'JVBERi0xLjQK', '', '--OUT--'].join(CRLF);
check('nested multipart', parse(nested).text, 'Nested plain text.');

// 6. RFC 2047 encoded subject, both flavours
check('encoded subject (B)', decodeWords('=?utf-8?B?' + Buffer.from('Réservation #42', 'utf8').toString('base64') + '?='), 'Réservation #42');
check('encoded subject (Q)', decodeWords('=?utf-8?Q?Caf=C3=A9_time?='), 'Café time');

// 7. folded header -- a long subject is wrapped across lines by the sending server
const folded = ['Subject: This is a very long subject line that the', ' sending server folded across two lines',
  'From: b@example.com', '', 'body'].join(CRLF);
check('folded header unfolds', parse(folded).headers.subject,
  'This is a very long subject line that the sending server folded across two lines');

// 8. bare-LF message (some senders do not use CRLF)
const lf = 'Subject: LF only\nFrom: c@example.com\n\nBody after bare LF.';
check('bare LF separator', parse(lf).text, 'Body after bare LF.');

// 9. a message with no body at all must not throw
check('no body', parse('Subject: empty').text, '');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
