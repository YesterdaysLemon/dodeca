import {readFile,writeFile} from 'node:fs/promises';
let sha=process.env.GITHUB_SHA;
if(!sha){const head=(await readFile('.git/HEAD','utf8')).trim();if(head.startsWith('ref: ')){const ref=head.slice(5);try{sha=(await readFile('.git/'+ref,'utf8')).trim();}catch{const packed=await readFile('.git/packed-refs','utf8');sha=packed.split('\n').find(l=>l.endsWith(' '+ref))?.split(' ')[0];}}else sha=head;}
if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('No exact Git revision available');
await writeFile('build-sha',sha+'\n');
