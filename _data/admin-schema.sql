-- D1 schema for the admin panel (database: lumoscore-admin-db, binding: ADMIN_DB).
--
-- Only things that CANNOT be derived from the chain live here. Volume, trades, revenue, holder counts
-- and reward rounds are all computed from Horizon on demand, so none of them are stored -- a cached
-- copy of a chain figure is just a second answer that can disagree with the first one.
--
-- Apply with:  npx wrangler d1 execute lumoscore-admin-db --remote --file=_data/admin-schema.sql

-- ---- wallet connections ---------------------------------------------------------------------------
-- Nothing on-chain records a wallet CONNECTING to the site; only wallets that go on to pay a fee leave
-- a trace. This is the only source for "connected wallets", windowed or lifetime.
--
-- One row per wallet per day, not one per connection: the question the dashboard asks is "how many
-- distinct wallets in this window", and a row per page load would be a much larger table answering the
-- same question worse. seen counts repeat connections within the day for anyone who wants it later.
CREATE TABLE IF NOT EXISTS wallet_day (
  addr      TEXT NOT NULL,
  day       TEXT NOT NULL,            -- UTC date, YYYY-MM-DD
  first_ts  INTEGER NOT NULL,         -- epoch ms, first connect that day
  last_ts   INTEGER NOT NULL,
  seen      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (addr, day)
);
-- the dashboard always filters by window, so the date is the hot column
CREATE INDEX IF NOT EXISTS idx_wallet_day_day ON wallet_day (day);

-- ---- support inbox --------------------------------------------------------------------------------
-- Filled by an Email Worker on team@ / raza@. The Worker also forwards onward to the real mailbox, so
-- storing a copy here never costs a delivery.
CREATE TABLE IF NOT EXISTS mail (
  id         TEXT PRIMARY KEY,        -- Message-ID, so a redelivery cannot duplicate a row
  ts         INTEGER NOT NULL,        -- epoch ms received
  to_addr    TEXT NOT NULL,
  from_addr  TEXT NOT NULL,
  from_name  TEXT,
  -- Where a reply must actually go. A message relayed by a provider carries that provider's bounce
  -- address as its envelope from -- Resend uses a per-message ...@send.mail. address -- so from_addr
  -- identifies the relay, not the person. Reply-To is the header that names them, and without it a
  -- reply from the panel goes back to the relay and is silently lost.
  reply_to   TEXT,
  subject    TEXT,
  body_text  TEXT,
  body_html  TEXT,
  size       INTEGER,
  read_at    INTEGER,
  archived   INTEGER NOT NULL DEFAULT 0,
  -- The original source. Kept so a gap in the MIME parser can never lose a message: the body columns
  -- are a convenience, this is the record.
  raw        TEXT
);
CREATE INDEX IF NOT EXISTS idx_mail_ts ON mail (ts DESC);
CREATE INDEX IF NOT EXISTS idx_mail_unread ON mail (read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mail_from ON mail (from_addr);

-- Replies sent from the panel through Resend. This table predates the file and was created directly
-- against D1; it is written down here so the schema is the record it claims to be.
CREATE TABLE IF NOT EXISTS mail_reply (
  id        TEXT PRIMARY KEY,
  mail_id   TEXT NOT NULL,
  ts        INTEGER NOT NULL,
  to_addr   TEXT NOT NULL,
  subject   TEXT,
  body      TEXT,
  provider  TEXT,          -- the id Resend gives back, so a delivery question can be traced
  err       TEXT
);

-- ---- blocked senders (the Spam box) ----------------------------------------------------------------
-- Marking a message as spam blocks its SENDER, not only that one message, because "always land in
-- spam" is a statement about a correspondent rather than about one email.
--
-- IT IS APPLIED WHEN THE INBOX IS READ, not when mail arrives. Two reasons, both deliberate:
--   * it is retroactive and reversible -- blocking someone moves everything they have ever sent into
--     Spam at once, and unblocking puts it all back, with no rows rewritten either way;
--   * it keeps the Email Worker out of it entirely. That Worker's one invariant is that nothing can
--     stop mail reaching the real mailbox, so a spam rule that it had to consult would put delivery
--     downstream of a judgement call. Here a mistake costs a filtered view and nothing else.
CREATE TABLE IF NOT EXISTS mail_block (
  addr TEXT PRIMARY KEY,   -- lower-cased from_addr, exactly as stored on the message
  ts   INTEGER NOT NULL,
  by   TEXT                -- the admin who blocked it, from the verified Access token
);

-- ---- where a wallet last connected from -------------------------------------------------------------
-- COUNTRY ONLY, and deliberately so. Cloudflare hands every request a country, a region and a city;
-- only the country is kept here, because the question this answers is "roughly where are the people
-- using this" and a wallet address plus a city is a materially different, and much more identifying,
-- record than a wallet address plus a flag.
--
-- The country is taken from request.cf at the edge and NEVER from the request body, so it cannot be
-- claimed by the caller. One row per address, overwritten on each connect: this is "last seen from",
-- not a location history, so there is nothing here to reconstruct someone's movements from.
--
-- It only fills going forward. Nothing recorded a wallet's origin before this existed and there is no
-- way to backfill it, so a wallet that has not connected since will have no flag.
CREATE TABLE IF NOT EXISTS wallet_geo (
  addr    TEXT PRIMARY KEY,
  country TEXT,                      -- ISO 3166 alpha-2, from Cloudflare
  ts      INTEGER NOT NULL,          -- epoch ms of the most recent connect
  n       INTEGER NOT NULL DEFAULT 1 -- how many connects have been seen, for a sense of regularity
);

-- ---- reward payout history ------------------------------------------------------------------------
-- The ROUND is recomputed from chain every time, so it is not stored. What cannot be recomputed is what
-- we actually sent and when -- without it there is no way to tell a paid round from an unpaid one.
CREATE TABLE IF NOT EXISTS reward_run (
  id          TEXT PRIMARY KEY,
  ts          INTEGER NOT NULL,
  recipients  INTEGER NOT NULL,
  total_lumos TEXT NOT NULL,          -- text, not float: 7-dp amounts must not go through a double
  note        TEXT
);
CREATE TABLE IF NOT EXISTS reward_payment (
  run_id    TEXT NOT NULL,
  addr      TEXT NOT NULL,
  amount    TEXT NOT NULL,
  tx_hash   TEXT,
  err       TEXT,
  PRIMARY KEY (run_id, addr)
);
CREATE INDEX IF NOT EXISTS idx_reward_payment_run ON reward_payment (run_id);

-- Transactions submitted THROUGH LumosCore.
--
-- The dashboard activity feed was built from fee payments to the collector, so it could only show
-- fee-paying actions. Pool creation, deposits, withdrawals and limit orders are free and leave no
-- on-chain marker tying them to us, so they were invisible. Only the platform knows what the platform
-- did, which is what this records.
--
-- Hash and address are both already public on-chain; the hash reveals strictly more than is kept here.
-- The hash is the primary key so a retry or a second tab costs nothing.
CREATE TABLE IF NOT EXISTS activity (
  hash TEXT PRIMARY KEY,
  addr TEXT NOT NULL,
  ts   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_ts ON activity (ts DESC);

-- Curated listing applications from the public "List your token" page.
--
-- The $250 is paid in the SAME transaction that submits the form, so tx_hash is the proof and is the
-- natural unique key: a resubmit or a double-click cannot create a second request for one payment.
-- pay_asset and pay_amount record what was actually received, because a rejection has to refund
-- exactly that -- same asset, same amount -- and the quote that produced it will have moved by then.
CREATE TABLE IF NOT EXISTS listing_request (
  id          TEXT PRIMARY KEY,
  network     TEXT NOT NULL,
  code        TEXT NOT NULL,
  issuer      TEXT NOT NULL,
  descr       TEXT,
  logo_id     TEXT,
  payer       TEXT NOT NULL,          -- refunds go back here, never to an address supplied in the form
  pay_asset   TEXT NOT NULL,          -- 'native' or CODE:ISSUER
  pay_amount  TEXT NOT NULL,
  tx_hash     TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | refunded
  created_at  INTEGER NOT NULL,
  decided_at  INTEGER,
  refund_hash TEXT,
  note        TEXT,
  -- Where to go and look. Review is "is this project findable and is it what it claims", which cannot
  -- be answered from a code and an address alone, so the application collects them and the panel shows
  -- them as links. They are also passed straight to /lxapi/assetmeta on approval, so an approved asset
  -- arrives on the public site already wearing its own links instead of waiting for someone to retype
  -- them. Handles are kept AS TYPED, matching assetmeta: the asset page already turns a bare handle,
  -- an @handle or a full URL into the right link, and normalising here would be a second, disagreeing
  -- implementation of that.
  website     TEXT,
  twitter     TEXT,
  telegram    TEXT,
  discord     TEXT
);
CREATE INDEX IF NOT EXISTS listing_status ON listing_request (status, created_at DESC);

-- Who did what in the admin panel.
--
-- Exists because the panel stopped being single-user. Two people now curate assets, publish posts,
-- approve listings and send refunds, and until this table there was no way to tell afterwards which
-- of them did any of it, or when. Refunds are the sharpest case: money leaves, and the only record
-- was the transaction itself with nothing tying it to a decision.
--
-- actor is the email Cloudflare Access put in the verified token, never anything the client sent.
-- detail is a short JSON blob, deliberately small: enough to answer "what changed", not a copy of the
-- content -- the content already lives in KV and has its own history.
--
-- Append-only by intention. Nothing in the panel updates or deletes a row here; a mistaken entry is
-- corrected by a later one, because a log you can edit answers no question worth asking.
CREATE TABLE IF NOT EXISTS admin_audit (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,          -- ms since epoch
  actor   TEXT NOT NULL,             -- from the Access JWT, not from the request body
  action  TEXT NOT NULL,             -- 'listing.approve', 'asset.curate', 'blog.publish', …
  target  TEXT,                      -- what it was done to: an asset, a slug, a request id
  detail  TEXT                       -- small JSON, may be null
);
CREATE INDEX IF NOT EXISTS admin_audit_at ON admin_audit (at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_actor ON admin_audit (actor, at DESC);

-- ---- first-party page views (functions/lxapi/pv.js) ------------------------------------------------------------
-- Cities and bounce rate: Cloudflare Web Analytics has neither (no city field, no sessions). One row per page view;
-- sid is a random id the page keeps in sessionStorage for that browsing session only. No IP, no user agent, no
-- cookie, no wallet address. host keeps staging/preview rows apart from lumoscore.com. Pruned after 180 days.
CREATE TABLE IF NOT EXISTS pageview (
  ts      INTEGER NOT NULL,          -- epoch ms
  day     TEXT NOT NULL,             -- UTC date, YYYY-MM-DD
  sid     TEXT NOT NULL,
  path    TEXT NOT NULL,
  ref     TEXT,                      -- referring host, only when it is another site
  country TEXT,                      -- ISO 3166 alpha-2, from Cloudflare
  region  TEXT,
  city    TEXT,
  device  TEXT,                      -- desktop | mobile | tablet
  host    TEXT
);
CREATE INDEX IF NOT EXISTS pageview_ts ON pageview (ts);
CREATE INDEX IF NOT EXISTS pageview_sid_ts ON pageview (sid, ts);

-- ---- live activity: clicks (functions/lxapi/pv.js, kind=click) -------------------------------------------------
-- The live panel answers "what is this visitor doing right now" the way Plausible does: the pages of the visit, and
-- the links and buttons pressed. Only the element's VISIBLE LABEL is kept (and the destination host for an outbound
-- link) -- never typed text, amounts, addresses or form values. Same session id as pageview, same 180-day pruning.
CREATE TABLE IF NOT EXISTS pvevent (
  ts    INTEGER NOT NULL,
  sid   TEXT NOT NULL,
  path  TEXT NOT NULL,            -- the page it happened on
  kind  TEXT NOT NULL,            -- 'click'
  label TEXT,                     -- what the link or button says
  href  TEXT,                     -- destination host, only for a link leaving the site
  host  TEXT
);
CREATE INDEX IF NOT EXISTS pvevent_ts ON pvevent (ts);
CREATE INDEX IF NOT EXISTS pvevent_sid_ts ON pvevent (sid, ts);
