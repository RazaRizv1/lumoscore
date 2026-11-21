// WHO SUPPORT MAIL GOES OUT AS. One map, shared by the compose path (lxapi/sendmail.js) and the reply
// path (lxapi/reply.js), because two copies drift and the failure is invisible: a reply would keep
// going out under the old name long after the compose box learned a new one.
//
// THE CALLER PICKS A KEY, NEVER AN ADDRESS. The server owns the addresses, so neither the compose box
// nor the reply box can be used to send as somebody who is not on this list.
//
// Every From stays on mail.lumoscore.com -- the subdomain Resend is authorised to sign for. Sending as
// raza@lumoscore.com or abeeha@lumoscore.com directly would fail SPF and DKIM and land in spam, so the
// real address goes in Reply-To instead. Those are routed into this panel already (support@, info@,
// raza@ and abeeha@ are all forwarded), so the answer comes back where it is expected either way.
// `name` is the display name on its own, kept separate from `from` so the mail template can sign the
// message without having to parse an address back apart -- the kind of parsing that works until a name
// contains a comma.
export const SENDERS = {
  support: {
    name: 'LumosCore Support',
    from: 'LumosCore Support <support@mail.lumoscore.com>',
    replyTo: 'support@lumoscore.com',
    addr: 'support@mail.lumoscore.com',
  },
  raza: {
    name: 'Raza Rizvi',
    from: 'Raza Rizvi <raza@mail.lumoscore.com>',
    replyTo: 'raza@lumoscore.com',
    addr: 'raza@mail.lumoscore.com',
  },
  abeeha: {
    name: 'Abeeha Zaidi',
    from: 'Abeeha Zaidi <abeeha@mail.lumoscore.com>',
    replyTo: 'abeeha@lumoscore.com',
    addr: 'abeeha@mail.lumoscore.com',
  },
};

export const DEFAULT_SENDER = 'support';

// Which key an INBOUND address answers as. Mail addressed to abeeha@lumoscore.com should be replied to
// as Abeeha without anyone having to remember to change a dropdown -- getting that wrong is silent, the
// customer simply receives an answer from the wrong person. Everything unrecognised (info@, team@, a
// forwarded address, an empty column on an old row) falls back to Support, which is what every reply
// did before this existed.
export function keyForAddress(toAddr) {
  const s = String(toAddr || '').toLowerCase();
  const m = /([^\s<>",;:]+)@/.exec(s);
  const local = m ? m[1] : '';
  return Object.prototype.hasOwnProperty.call(SENDERS, local) ? local : DEFAULT_SENDER;
}

// An explicit, valid key wins; otherwise fall back to what the mail was addressed to. Never throws and
// never returns undefined -- a bad key must not be a way to stop a reply going out.
export function pickSender(key, toAddr) {
  const k = String(key || '');
  if (Object.prototype.hasOwnProperty.call(SENDERS, k)) return SENDERS[k];
  return SENDERS[keyForAddress(toAddr)] || SENDERS[DEFAULT_SENDER];
}
