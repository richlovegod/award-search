-- Lockout and rate-limit counters, moved here from KV (bug fix, 2026-10-17): wrong sign-ins per email (5) and per
-- network (20) in 15 minutes, and the sign-up, reset, verification-email and test-send limits. In KV a counter was
-- read and then written back, so attempts sent at the same moment counted as one, and once KV's 1,000 writes a day
-- were used up nothing was counted at all. Here one statement checks and counts an attempt.
-- k: the counter's name (lk:em:<SHA-256 of the email>, lk:ip:<IP>, rl:reg:<IP>, rl:rs:<IP>, rl:mail:<account> ...).
-- n: attempts counted. expires_at: Unix seconds when the count starts over (the window after the last counted
-- attempt, as KV's expirationTtl did); expired rows are deleted when someone signs in.
-- WITHOUT ROWID: the primary key is the table, so counting an attempt writes one row, not two. New table only.

CREATE TABLE rate_counters (
  k          TEXT PRIMARY KEY,
  n          INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
