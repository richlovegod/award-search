-- The seats.aero key's daily call quota, as last reported by its X-RateLimit-Remaining header (Gino, 2026-10-14:
-- show 已用 XXX/1000 as a progress bar). One row; the relay updates it after every seats.aero call.
-- The quota resets at 00:00 UTC, so a row older than the last UTC midnight means nothing has been used today.

CREATE TABLE quota (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  remaining   INTEGER NOT NULL,
  quota_limit INTEGER,                              -- X-RateLimit-Limit when seats.aero sends it
  at          INTEGER NOT NULL                      -- Unix seconds of that call
);
