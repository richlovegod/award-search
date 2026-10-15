-- 推播通知 (Web Push for alerts), 2026-10-15: each row is one browser's push subscription for one account (at most
-- 10 per account). When an alert emails new awards, the Worker also pushes the news to these devices.
-- id is the SHA-256 (base64url) of the endpoint, so the page can work out which row is its own device; a browser has
-- one endpoint per site, so the same endpoint signing in under another account moves the row there.
-- p256dh and auth are the browser's public key and secret for encrypting the payload (RFC 8291); they let us write to
-- that browser and nothing else. A row is deleted when its push service answers 404 or 410.
-- session_id: the sign-in that turned push on. Push follows sign-in: when that session ends (登出, 登出其他所有裝置,
-- a password change or reset, an admin switching the account off), its row goes with it (ON DELETE CASCADE; D1
-- enforces foreign keys), and the Worker only ever sends to rows whose session is still live, so an expired sign-in
-- stops its pushes too. Signing in again on that device registers it again.

CREATE TABLE push_subs (
  id          TEXT PRIMARY KEY,                     -- base64url SHA-256 of endpoint
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,                 -- https URL at web.push.apple.com, fcm.googleapis.com, ...
  p256dh      TEXT NOT NULL,                        -- base64url, the 65-byte P-256 point
  auth        TEXT NOT NULL,                        -- base64url, 16 bytes
  ua          TEXT,                                 -- the browser's User-Agent when it subscribed (for the device list)
  created_at  INTEGER NOT NULL,
  last_ok_at  INTEGER,                              -- the last push the service accepted
  last_err    TEXT,                                 -- the last refusal, e.g. "403 BadJwtToken"; cleared by a success
  last_err_at INTEGER
);
CREATE INDEX push_subs_by_user ON push_subs(user_id);
CREATE INDEX push_subs_by_session ON push_subs(session_id);   -- so deleting a session finds its rows without a scan
