import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {get} from 'node:http';
const probe=(url,host)=>new Promise((resolve,reject)=>get(url,{headers:{Host:host}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
test('HTTP boundary exposes public assets, blocks files and foreign API calls',async()=>{
  const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'18788',TYPESAFE_API_KEY:'',DATA_DIR:await mkdtemp(join(tmpdir(),'dodeca-http-'))},stdio:['ignore','pipe','pipe']});
  try{
    await Promise.race([once(proc.stdout,'data'),once(proc,'exit').then(()=>{throw new Error('Server exited during startup');})]);
    const base='http://127.0.0.1:18788';
    assert.equal((await fetch(base+'/healthz')).status,200);
    assert.equal(await probe(base+'/healthz','127.0.0.1:3201'),200);
    assert.equal(await probe(base+'/healthz','foreign.example'),403);
    assert.equal((await fetch(base+'/',{method:'HEAD'})).status,200);
    assert.equal((await fetch(base+'/.git/config')).status,404);
    assert.equal((await fetch(base+'/provider.mjs')).status,404);
    assert.equal((await fetch(base+'/api/decide',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.example'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/decide',{method:'POST',headers:{'Content-Type':'text/plain',Origin:base},body:'{}'})).status,415);
    assert.equal((await fetch(base+'/api/decide',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'!json'})).status,400);
    assert.ok((await fetch(base+'/vendor/OrbitControls.js').then(r=>r.text())).includes("from './three.module.js'"));
  }finally{proc.kill();await once(proc,'exit');}
});
