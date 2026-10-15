-- 開票提醒 (release-date reminders), 2026-10-15: one row per account, program and travel date. open_date is the
-- travel date minus the program's booking window (WINDOWS in worker/src/features/release.js; for a range, its
-- longest end, so the email comes on the earliest day the program may open). Once a day the hourly cron's
-- 14:05 UTC run emails each account its due reminders in one message (verified addresses only) and sets sent_at
-- on exactly the rows in that email, right after it is sent. A failed send sets tried_at instead, and accounts
-- that failed go after the others in the next run. Rows go away when the travel date has passed, or 30 days
-- after their email.

CREATE TABLE release_reminders (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,                  -- seats.aero program key, e.g. united
  travel_date TEXT NOT NULL,                  -- YYYY-MM-DD
  open_date   TEXT NOT NULL,                  -- YYYY-MM-DD: travel_date minus days
  days        INTEGER NOT NULL,               -- the window used, in days
  o           TEXT,                           -- origin airports of the search on screen, comma-separated (for the email's link)
  d           TEXT,                           -- destination airports; both NULL = the link opens the 開票日 page
  lang        TEXT NOT NULL DEFAULT 'zh',     -- the email's language: zh or en
  created_at  INTEGER NOT NULL,               -- Unix seconds
  sent_at     INTEGER,                        -- when its email went out; NULL = not yet
  tried_at    INTEGER                         -- the last run whose email to this account failed; NULL = never failed
);
CREATE UNIQUE INDEX release_one ON release_reminders(user_id, source, travel_date);
CREATE INDEX release_due ON release_reminders(sent_at, open_date);
CREATE INDEX release_travel ON release_reminders(travel_date);   -- the daily clean-up of past travel dates
