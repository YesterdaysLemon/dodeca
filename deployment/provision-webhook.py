"""Add exactly DODECA_DEPLOY_WEBHOOK_SECRET; input arrives over SSH stdin."""
import os
import pathlib
import re
import sys

value = sys.stdin.read().strip()
if not re.fullmatch(r'[a-f0-9]{64}', value):
    raise SystemExit('Invalid webhook secret input; no value logged.')
target = pathlib.Path('/etc/deploy-manager/deploy-manager.env')
before = target.read_text()
if re.search(r'^DODECA_DEPLOY_WEBHOOK_SECRET=', before, re.M):
    raise SystemExit('Dodeca webhook secret already exists; refusing to replace it.')
backup = target.with_name('deploy-manager.env.before-dodeca')
fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write(before)
with target.open('a') as stream:
    stream.write('\nDODECA_DEPLOY_WEBHOOK_SECRET=' + value + '\n')
print('Added only Dodeca webhook secret; existing manager settings preserved.')
