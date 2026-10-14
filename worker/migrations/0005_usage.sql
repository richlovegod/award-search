-- Per-account daily seats.aero call budget (Gino, 2026-10-14): invited accounts get 200 calls per UTC day,
-- the owner has no cap, and invited accounts stop when the key itself is down to its last 300 calls.
-- usage counts real seats.aero calls only (cache hits cost nothing); a refunded refresh is subtracted again.

ALTER TABLE users ADD COLUMN daily_limit INTEGER;   -- calls per UTC day; NULL = the default (200 for a user, none for the owner)

CREATE TABLE usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,                             -- UTC date, the same day seats.aero's quota uses
  calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
