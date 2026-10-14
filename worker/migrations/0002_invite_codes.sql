-- Let the admin page show each invite code again (Gino, 2026-10-14).
-- The code stays unreadable in the database: it is AES-GCM encrypted with the Worker secret INVITE_KEY,
-- and the row is still looked up by the code's SHA-256 (invites.id). Codes made before this have NULL here.

ALTER TABLE invites ADD COLUMN code_enc TEXT;   -- base64url(12-byte IV + ciphertext), invite id as additional data
