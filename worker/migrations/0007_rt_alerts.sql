-- Round-trip alerts (來回提醒), 2026-10-15: an alert with a return range checks both directions (2 seats.aero calls)
-- and emails only date pairs (return at least a day after the outbound) whose total miles fit under max_miles.
-- Both NULL = a one-way alert, as before.
ALTER TABLE alerts ADD COLUMN rs TEXT;   -- first return date, YYYY-MM-DD
ALTER TABLE alerts ADD COLUMN re TEXT;   -- last return date
