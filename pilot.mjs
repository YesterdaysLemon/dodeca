import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {JevProvider} from './provider.mjs';
import {createWorld,observe,defaultWeights,arbitrate,scriptedEvaluation} from './core.mjs';
const root=new URL('./',import.meta.url),config=JSON.parse(await readFile(new URL('config/pilot.json',root),'utf8'));
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),directory=new URL(`results/pilot-${stamp}/`,root);
await mkdir(directory,{recursive:true});
const hashes={};for(const file of ['config/pilot.json','preregister.md','core.mjs','provider.mjs','pilot.mjs'])hashes[file]=createHash('sha256').update(await readFile(new URL(file,root))).digest('hex');
const git=(args)=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();}catch{return 'unavailable';}};
const manifest={startedAt:new Date().toISOString(),config,hashes,commit:git(['rev-parse','HEAD']),gitStatus:git(['status','--porcelain']),node:process.version,platform:process.platform};
await writeFile(new URL('manifest.json',directory),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
const provider=new JevProvider({key:process.env.TYPESAFE_API_KEY,directory:new URL('receipts/',directory),...config});delete process.env.TYPESAFE_API_KEY;
const rows=[];let status='complete',error=null;
for(const scene of config.cases){
  const world=createWorld();world.body={energy:1,hydration:1,fatigue:0,cold:0,loneliness:0,boredom:0,...scene.body};
  world.environment={threat:0,storm:0,novelty:0,friendDistress:0,visitor:0,...scene.environment};
  const state=observe(world);for(const obj of Object.values(state.objects))obj.distance=15;
  const variants=[{id:'default',expected:scene.expected??null},...(scene.interventions??[]).map(i=>({id:i.drive,drive:i.drive,expected:i.expected}))];
  for(const variant of variants){
    const weights=defaultWeights();if(variant.drive)weights[variant.drive]=4;
    try{
      const response=await provider.evaluate(state,weights);
      const options={inertia:config.inertia,previous:'wait'};
      const actions={committee:arbitrate(response,weights,options).action,single:response.single.choice,rules:arbitrate(scriptedEvaluation(state),weights,options).action,shuffled:arbitrate(response,weights,{...options,shuffle:true}).action};
      rows.push({case:scene.id,kind:variant.drive?'intervention':scene.kind,variant:variant.id,expected:variant.expected,actions,receiptId:response.receiptId,latencyMs:response.latencyMs,usage:response.usage,model:response.model});
      await writeFile(new URL('rows.json',directory),JSON.stringify(rows,null,2)+'\n');
      console.log(JSON.stringify({case:scene.id,variant:variant.id,actions,expected:variant.expected}));
    }catch(err){status='incomplete';error=err.message;break;}
  }
  if(status==='incomplete')break;
}
const metrics={};
for(const condition of config.conditions){
  metrics[condition]={};for(const [name,kind] of [['controls','control'],['interventions','intervention']]){
    const group=rows.filter(r=>r.kind===kind),n=group.length,k=group.filter(r=>r.expected.includes(r.actions[condition])).length;
    const z=1.96,ph=n?k/n:0,den=1+z*z/(n||1),mid=(ph+z*z/(2*(n||1)))/den,half=z*Math.sqrt(ph*(1-ph)/(n||1)+z*z/(4*(n||1)**2))/den;
    metrics[condition][name]={correct:k,total:n,rate:n?k/n:null,wilson95:n?[Math.max(0,mid-half),Math.min(1,mid+half)]:null};
  }
  metrics[condition].pairedFlips=config.cases.filter(c=>c.kind==='conflict').filter(c=>{const r=rows.filter(r=>r.case===c.id&&r.kind==='intervention');return r.length===2&&r[0].actions[condition]!==r[1].actions[condition];}).length;
}
const latencies=rows.map(r=>r.latencyMs).sort((a,b)=>a-b);
const summary={status,error,run:directory.pathname.split('/').filter(Boolean).pop(),metrics,models:[...new Set(rows.map(r=>r.model))],requests:provider.requests,inputTokens:provider.inputTokens,outputTokens:provider.outputTokens,
  estimatedCostUsd:provider.inputTokens*.042/1e6,medianLatencyMs:latencies.length?latencies[Math.floor(latencies.length/2)]:null,
  capabilityGate:metrics.committee.controls.rate>=config.controlGate&&metrics.single.controls.rate>=config.controlGate,
  boundedHypothesis:status==='complete'&&metrics.committee.controls.rate>=config.controlGate&&metrics.single.controls.rate>=config.controlGate&&metrics.committee.interventions.correct>metrics.shuffled.interventions.correct?'supported_on_authored_cases_only':'not_supported_or_incomplete',
  limitations:'Authored numeric states; no random sample, training, matched compute, semantic OOD, or closed-loop performance comparison.'};
await writeFile(new URL('summary.json',directory),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
await writeFile(new URL('results/latest-summary.json',root),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));if(status!=='complete')process.exitCode=1;
