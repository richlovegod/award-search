-- Alert search options, 2026-10-17: an alert made from a search with 包含混艙 or 包含動態高價位子 on keeps that
-- option, so its checks search the way the page did (min_cabin_pct=50, include_filtered=true).
-- Both 0 = seats.aero's default search, as every alert made before this had.
ALTER TABLE alerts ADD COLUMN mixed INTEGER NOT NULL DEFAULT 0;   -- 1 = 包含混艙 (min_cabin_pct=50)
ALTER TABLE alerts ADD COLUMN dyn INTEGER NOT NULL DEFAULT 0;     -- 1 = 包含動態高價位子 (include_filtered=true)
