"""Make a one-time password reset link for an account, for when the owner is locked out of the admin page.

Run from repo/worker:
    python scripts/reset-link.py you@example.com            # the real site
    python scripts/reset-link.py you@example.com --local    # the local test site
    python scripts/reset-link.py you@example.com --staging  # the staging Worker on Cloudflare

Only the SHA-256 of the link's token goes into D1. The link works once and expires in 30 minutes.
"""
import base64
import hashlib
import re
import secrets
import subprocess
import sys
import time

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) != 1 or not re.fullmatch(r'[^\s@\'"]+@[^\s@\'"]+\.[^\s@\'"]{2,}', args[0]):
    sys.exit('usage: python scripts/reset-link.py you@example.com [--local]')
email = args[0].lower()
local = '--local' in sys.argv

token = secrets.token_urlsafe(32)
token_id = base64.urlsafe_b64encode(hashlib.sha256(token.encode()).digest()).decode().rstrip('=')
t = int(time.time())
sql = ("INSERT INTO reset_links (id, user_id, created_at, expires_at) "
       f"SELECT '{token_id}', id, {t}, {t + 1800} FROM users WHERE email = '{email}';")
staging = '--staging' in sys.argv
db = 'award-auth-staging' if staging else 'award-auth'
out = subprocess.run(f'npx --yes wrangler@4.150.0 d1 execute {db} {"--local" if local else "--remote"} --json --command "{sql}"',
                     shell=True, check=True, capture_output=True, text=True).stdout
if '"changes": 0' in out:
    sys.exit('No account with that email.')
site = 'http://127.0.0.1:8766/index.html' if local or staging else 'https://richlovegod.github.io/award-search/'
print('Reset link (works once, valid 30 minutes):')
print(site + '#reset=' + token)
