-- Email alerts (提醒), Gino 2026-10-14: about every 3 hours the Worker re-runs each alert's search and emails its
-- account when an award at or under the alert's miles shows up, or gets cheaper than what was last emailed.
-- Mail goes out through Cloudflare Email Routing, which only delivers to addresses that clicked Cloudflare's
-- verification email, so each account's sign-in email is verified once before its alerts are checked.

CREATE TABLE alerts (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  o           TEXT NOT NULL,                    -- origin airports, comma-separated (as in the search form)
  d           TEXT NOT NULL,                    -- destination airports
  s           TEXT NOT NULL,                    -- first departure date, YYYY-MM-DD
  e           TEXT NOT NULL,                    -- last departure date
  cabin       TEXT NOT NULL,                    -- Y, W, J or F
  sources     TEXT,                             -- program keys, comma-separated; NULL = every program
  max_miles   INTEGER NOT NULL,
  direct      INTEGER NOT NULL DEFAULT 0,       -- 1 = nonstop only
  seats       INTEGER NOT NULL DEFAULT 1,       -- at least this many seats (a program that gives no count is kept)
  label       TEXT,
  lang        TEXT NOT NULL DEFAULT 'zh',       -- the email's language: zh or en
  status      TEXT NOT NULL DEFAULT 'active',   -- active, paused, or ended (its last date has passed)
  created_at  INTEGER NOT NULL,
  checked_at  INTEGER,                          -- the last check
  check_note  TEXT,                             -- why the last check stopped short, e.g. user_quota
  found       INTEGER,                          -- awards that matched at the last check
  sent_at     INTEGER,                          -- the last email
  sent_count  INTEGER NOT NULL DEFAULT 0,
  sent        TEXT                              -- JSON {date + program: miles}: the lowest miles already emailed
);
CREATE INDEX alerts_by_user ON alerts(user_id);
CREATE INDEX alerts_due ON alerts(status, checked_at);

ALTER TABLE users ADD COLUMN alerts_ok INTEGER NOT NULL DEFAULT 1;   -- the admin page's switch for an invited account
ALTER TABLE users ADD COLUMN mail_id TEXT;                             -- the sign-in email's id as an Email Routing destination
ALTER TABLE users ADD COLUMN mail_verified_at INTEGER;                 -- when Cloudflare reported that address verified
ALTER TABLE users ADD COLUMN mail_asked_at INTEGER;                    -- when its verification email was last requested
