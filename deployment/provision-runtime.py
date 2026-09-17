"""Run through sudo on the VPS. Read only this app's key from SSH stdin."""
import os
import pathlib
import sys

value = sys.stdin.read().strip()
if not 20 <= len(value) <= 512 or any(ord(c) < 33 or ord(c) > 126 for c in value):
    raise SystemExit('Runtime credential input is invalid; no value logged.')
root = pathlib.Path('/etc/deploy-manager/runtime-env')
root.mkdir(mode=0o700, exist_ok=True)
target = root / 'dodeca.env'
if target.exists():
    raise SystemExit('Runtime file already exists; refusing to replace it.')
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write('TYPESAFE_API_KEY=' + value + '\n')
print('Dodeca runtime credential installed in root-only environment file.')
