-- 飯店 (hotel award search through rooms.aero), Gino 2026-10-15. rooms.aero takes the same seats.aero Pro key but has
-- its own 1,000 calls per UTC day, so it has its own budget, built like the flights one (0003_quota, 0005_usage):
-- invited accounts get 100 rooms.aero calls per UTC day (the owner has no cap), and stop when rooms.aero has 200 or
-- fewer left today. New tables only; nothing existing changes.

-- Each account's real rooms.aero calls per UTC day (cached results in the page cost nothing).
CREATE TABLE rooms_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,                             -- UTC date, the same day rooms.aero's quota uses
  calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- rooms.aero's daily call quota, as last reported by its X-RateLimit-Remaining header. One row; the Worker updates it
-- after every rooms.aero call. A row older than the last UTC midnight means nothing has been used today.
CREATE TABLE rooms_quota (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  remaining   INTEGER NOT NULL,
  quota_limit INTEGER,                              -- X-RateLimit-Limit when rooms.aero sends it
  at          INTEGER NOT NULL                      -- Unix seconds of that call
);
