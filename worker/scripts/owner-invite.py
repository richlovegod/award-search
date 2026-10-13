"""Make a one-time invite code for an OWNER account and store only its SHA-256 in D1.

Run from repo/worker:
    python scripts/owner-invite.py              # the real database on Cloudflare
    python scripts/owner-invite.py --staging    # the staging database on Cloudflare
    python scripts/owner-invite.py --local      # the local database used by `wrangler dev`

The code is printed once; the database never sees it. It works once and expires in 7 days.
"""
import base64
import hashlib
import os
import secrets
import subprocess
import sys
import tempfile
import time

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   # same alphabet as the Worker: no 0/O or 1/I

code = ''.join(ALPHABET[b % 32] for b in secrets.token_bytes(10))
code_id = base64.urlsafe_b64encode(hashlib.sha256(code.encode()).digest()).decode().rstrip('=')
t = int(time.time())
sql = ("INSERT INTO invites (id, label, role, created_at, expires_at) "
       f"VALUES ('{code_id}', '管理員', 'owner', {t}, {t + 7 * 86400});")
where = '--local' if '--local' in sys.argv else '--remote'
db = 'award-auth-staging' if '--staging' in sys.argv else 'award-auth'
# Go through a UTF-8 file: the Windows command line would mangle the Chinese label.
with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8') as f:
    f.write(sql)
try:
    subprocess.run(f'npx --yes wrangler@4.150.0 d1 execute {db} {where} --file "{f.name}"',
                   shell=True, check=True, stdout=subprocess.DEVNULL)
finally:
    os.unlink(f.name)
print('Owner invite code (works once, valid 7 days):', code[:5] + '-' + code[5:])
