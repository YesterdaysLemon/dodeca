import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
for(const p of ['core.mjs','provider.mjs','server.mjs','pilot.mjs','web/app.mjs','web/world.mjs'])execFileSync(process.execPath,['--check',p],{stdio:'inherit'});
for(const p of ['web/index.html','web/style.css','web/icon.svg','web/social.png','web/llms.txt','web/sitemap.xml','web/robots.txt','results/latest-summary.json'])await readFile(p);
console.log('Source syntax and release assets checked.');
