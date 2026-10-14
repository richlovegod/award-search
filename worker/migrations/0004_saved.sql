-- Saved searches (收藏), Gino 2026-10-14. One row per saved search, private to its account.
-- seen: the lowest miles per leg, cabin, date and program from the last time the results were looked at
-- (JSON object, keys like "0J2026-11-01aeroplan"), so the page can mark awards that are new or cheaper since then.

CREATE TABLE saved_searches (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  params     TEXT NOT NULL,                         -- the search as JSON: o, d, s, e, optional rt {s, e}, mixed, dyn
  label      TEXT,
  created_at INTEGER NOT NULL,
  seen_at    INTEGER,
  seen       TEXT
);
CREATE INDEX saved_by_user ON saved_searches(user_id);
