"""Activate the reviewed additive Dodeca registration without replacing fleet config."""
import json
import pathlib
import shutil
import subprocess
import urllib.request

with urllib.request.urlopen('http://127.0.0.1:9019/api/releases', timeout=10) as response:
    releases = json.load(response)['releases']
if any(job['status'] in ('running', 'queued') for job in releases):
    raise SystemExit('The shared release lane is busy; activation stopped.')
target = pathlib.Path('/etc/caddy/Caddyfile')
before = target.read_text()
if 'dodeca.alirezaafshan.com' in before:
    raise SystemExit('Dodeca route already exists; inspect before changing.')
backup = target.with_name('Caddyfile.before-dodeca-20260917')
if backup.exists():
    raise SystemExit('Caddy backup already exists; inspect before continuing.')
shutil.copy2(target, backup)
addition = '\n# BEGIN DODECA\ndodeca.alirezaafshan.com {\n    encode zstd gzip\n    reverse_proxy 127.0.0.1:3200\n}\n# END DODECA\n'
target.write_text(before + addition)
check = subprocess.run(['caddy', 'validate', '--config', str(target)], capture_output=True)
if check.returncode:
    shutil.copy2(backup, target)
    raise SystemExit('Caddy validation failed; prior configuration restored.')
subprocess.run(['systemctl', 'reload', 'caddy'], check=True)
subprocess.run(['systemctl', 'restart', 'deploy-manager'], check=True)
print('Dodeca route added; Caddy validated and reloaded; idle manager restarted.')
