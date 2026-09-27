"""Activate the reviewed additive Dodeca registration without replacing fleet config."""
import json
import pathlib
import subprocess
import urllib.request

with urllib.request.urlopen('http://127.0.0.1:9019/api/releases', timeout=10) as response:
    releases = json.load(response)['releases']
if any(job['status'] in ('running', 'queued') for job in releases):
    raise SystemExit('The shared release lane is busy; activation stopped.')
# Caddy keeps one file per site: the Caddyfile imports sites/*.caddy, and
# /etc/caddy is a git repository. Dodeca's route is only its own file.
caddyfile = '/etc/caddy/Caddyfile'
site = pathlib.Path('/etc/caddy/sites/dodeca.alirezaafshan.com.caddy')
if not site.parent.is_dir():
    raise SystemExit('No /etc/caddy/sites: Caddy is not in the one-file-per-site layout.')
if any('dodeca.alirezaafshan.com' in p.read_text() for p in [pathlib.Path(caddyfile), *site.parent.glob('*.caddy')]):
    raise SystemExit('Dodeca route already exists; inspect before changing.')
site.write_text('dodeca.alirezaafshan.com {\n    encode zstd gzip\n    reverse_proxy 127.0.0.1:3200\n}\n')
check = subprocess.run(['caddy', 'validate', '--config', caddyfile, '--adapter', 'caddyfile'], capture_output=True)
if check.returncode:
    site.unlink()
    raise SystemExit('Caddy validation failed; the new site file was removed.')
subprocess.run(['git', '-C', '/etc/caddy', 'add', str(site)], check=True)
subprocess.run(['git', '-C', '/etc/caddy', 'commit', '-q', '-m', 'Add dodeca.alirezaafshan.com'], check=True)
subprocess.run(['systemctl', 'reload', 'caddy'], check=True)
subprocess.run(['systemctl', 'restart', 'deploy-manager'], check=True)
print('Dodeca route added; Caddy validated and reloaded; idle manager restarted.')
