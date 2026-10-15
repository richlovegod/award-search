-- 轉點加碼 (transfer bonuses), Gino 2026-10-15: for a while a bank (or Marriott) gives extra miles when its points
-- move to an airline program, e.g. Amex to Flying Blue +25% until 11/15. The owner adds them on the admin page;
-- every account sees them on the result cards, and a card's details show the points needed with the bonus.
-- Site-wide rows (not any one account's). The Worker checks the bank, program, percent and dates before writing,
-- so the table has no CHECKs that a new bank or program would need a rebuild for. The hourly cron deletes rows
-- whose last day is more than 30 days past.

CREATE TABLE bonuses (
  id          INTEGER PRIMARY KEY,
  bank        TEXT NOT NULL,                     -- amex, chase, citi, capitalone or marriott (the page's BANKS)
  source      TEXT NOT NULL,                     -- the seats.aero program key, e.g. flyingblue
  pct         INTEGER NOT NULL,                  -- extra miles in percent of the usual transfer, 1 to 200
  starts_on   TEXT NOT NULL,                     -- first day, YYYY-MM-DD
  ends_on     TEXT NOT NULL,                     -- last day (it runs through this day)
  note        TEXT,                              -- the owner's note, at most 40 characters
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL                   -- Unix seconds
);
CREATE INDEX bonuses_by_end ON bonuses(ends_on);
