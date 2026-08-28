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
