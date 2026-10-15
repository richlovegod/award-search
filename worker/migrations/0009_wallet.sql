-- 點數錢包 (points wallet), Gino 2026-10-15: each account's own balances, so search results can say which awards it
-- can already pay for, as is or with one bank transfer. One row per account, private to it.
-- balances: a JSON object of key -> points with only the keys that have a balance, e.g. {"amex":96500,"aeroplan":20000}.
-- Keys are the five bank and hotel currencies (amex, chase, citi, capitalone, marriott) and the page's program keys
-- (united, aeroplan, ... the same list as PROGRAM_NAME in src/index.js); the Worker checks every key and number.

CREATE TABLE wallet (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balances   TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL                     -- Unix seconds of the last change
);
