-- 飯店 daily limit per account (Gino 2026-10-15): rooms.aero calls a UTC day for an invited account, set from the
-- admin page's 改飯店上限. NULL = the default (ROOMS_DAILY in src/features/hotels.js, 100); the owner has no cap.
ALTER TABLE users ADD COLUMN rooms_limit INTEGER;
