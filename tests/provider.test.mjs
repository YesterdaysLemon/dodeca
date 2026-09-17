import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {JevProvider} from '../provider.mjs';
import {observe,createWorld,defaultWeights,IDS} from '../core.mjs';
test('provider reserves quota before failure and restores it across restart',async()=>{
  const dir=pathToFileURL((await mkdtemp(join(tmpdir(),'dodeca-test-')) )+'/');
  const settings={key:'synthetic-test-credential',directory:new URL('receipts/',dir),budgetPath:new URL('budget.json',dir),maxRequests:1};
  const original=globalThis.fetch;let count=0;
  globalThis.fetch=async(url,options)=>{count++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.ok(!options.body.includes(settings.key));return new Response('private upstream error',{status:429});};
  try{
    const p=new JevProvider(settings);await assert.rejects(()=>p.evaluate(observe(createWorld()),defaultWeights()),/HTTP 429/);
    assert.equal(p.requests,1);assert.ok(p.inputTokens>0);
    const next=new JevProvider(settings);assert.equal(next.requests,1);await assert.rejects(()=>next.evaluate(observe(createWorld()),defaultWeights()),/limit/);assert.equal(count,1);
    const saved=await readFile(settings.budgetPath,'utf8');assert.ok(!saved.includes(settings.key));
  }finally{globalThis.fetch=original;}
});
test('single-decision mode sends just one question and reconciles token reservation',async()=>{
  const dir=pathToFileURL((await mkdtemp(join(tmpdir(),'dodeca-test-')) )+'/'),original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{assert.deepEqual(Object.keys(JSON.parse(options.body).questions),['single']);return Response.json({model:'test',answers:{single:{type:'choice',choice:'wait',confidence:1,probabilities:Object.fromEntries(IDS.map(k=>[k,k==='wait'?1:0]))}},usage:{input_tokens:123,output_tokens:20}});};
  try{const p=new JevProvider({key:'synthetic',directory:dir});const result=await p.evaluate(observe(createWorld()),defaultWeights(),{singleOnly:true});assert.equal(result.single.choice,'wait');assert.equal(p.inputTokens,123);}finally{globalThis.fetch=original;}
});
