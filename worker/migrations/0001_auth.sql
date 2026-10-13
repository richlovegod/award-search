-- Accounts for the award search site (phase 1: email + password, invite codes, no outgoing email).
-- Nothing secret is stored in readable form: passwords are salted PBKDF2 hashes, and session tokens,
-- invite codes and reset links are stored only as SHA-256 hashes. A stolen copy of this database
-- holds nothing anyone could sign in with.
-- Times are Unix seconds.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash       TEXT NOT NULL,                      -- "pbkdf2-sha256$<iterations>$<salt>$<hash>"
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'user')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

-- One row per signed-in device. The browser keeps the token; this table keeps its hash.
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,                    -- SHA-256 of the session token
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  device       TEXT,                                -- e.g. "iPhone Safari", read from the User-Agent
  country      TEXT                                 -- CF-IPCountry when the session started
);
CREATE INDEX sessions_by_user ON sessions(user_id);

-- Registration needs an invite code from the owner. Each code works once and expires.
CREATE TABLE invites (
  id         TEXT PRIMARY KEY,                      -- SHA-256 of the code
  label      TEXT,                                  -- the owner's note, e.g. "測試帳號 1"
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'user')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  used_at    INTEGER
);

-- One-time password reset links the owner makes for someone who forgot a password.
CREATE TABLE reset_links (
  id         TEXT PRIMARY KEY,                      -- SHA-256 of the link's token
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
