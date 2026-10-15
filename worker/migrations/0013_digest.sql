-- 每日精選信 (daily digest email), Gino 2026-10-15: once a day, at 8 am in Taiwan or 7 am in Seattle, an account can
-- get one email listing, for each of its home airports, the cheapest nonstop business or first class destinations
-- seen in seats.aero's cache (top 10 per airport and cabin), marked new or cheaper against the last digest's
-- snapshot. One row per account that has saved the 每日精選信 card on 我的提醒. No existing table changes.

CREATE TABLE digests (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled       INTEGER NOT NULL DEFAULT 0,      -- 1 = send it every day
  airports      TEXT NOT NULL,                   -- home airports, comma-separated: 1 to 6 (TPE, TSA, SEA and up to 3 others)
  cabins        TEXT NOT NULL DEFAULT 'J',       -- J, F or J,F
  hour          INTEGER NOT NULL DEFAULT 0,      -- 0 = 8 am in Taiwan (00 UTC); 14 = 7 am in Seattle (14 UTC, 15 UTC in winter)
  lang          TEXT NOT NULL DEFAULT 'zh',      -- the email's language: the site's language at the last save
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  last_sent_day TEXT,                            -- UTC date of the last scheduled digest done (sent, or nothing to list);
                                                 -- set before the email goes out, so a second run cannot send it again
  last_sent_at  INTEGER,                         -- the last email, scheduled or 寄一封給我看看
  sent_count    INTEGER NOT NULL DEFAULT 0,
  last_note     TEXT,                            -- why the last run sent nothing or less: unavailable, empty, mail_failed, partial
  last_try_at   INTEGER,                         -- the last scheduled attempt (any outcome); an account tried earlier in
                                                 -- today's send window waits behind the ones not tried yet
  snapshot      TEXT                             -- what the last email was built from, as JSON {airport: {cabin: string}}.
                                                 -- Each string lists every destination of that airport and cabin, cheapest
                                                 -- first, as the 3-letter code followed by the miles, comma-separated with a
                                                 -- leading and a trailing comma: {"TPE":{"J":",CAN14780,HGH14780,HKG14780,"}}.
                                                 -- An empty list is ",". Written only when an email goes out.
);
CREATE INDEX digests_due ON digests(enabled, hour);
