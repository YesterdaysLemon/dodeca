import { DRIVES,ACTIONS,IDS,createWorld,observe,scriptedEvaluation,arbitrate,advance,defaultWeights,clamp } from '/core.mjs';
import { Habitat,SITES } from '/world.mjs';
const $=id=>document.getElementById(id);
let habitat;
try{habitat=new Habitat($('world'));}catch{$('loading').innerHTML='<p>This world needs WebGL to grow.</p><p>Try a browser with hardware acceleration enabled.</p>';throw new Error('WebGL initialization failed');}
const initial=()=>{const d=createWorld(),p=createWorld();d.x=44;d.y=35;p.x=56;p.y=37;return {d,p};};
let {d,p}=initial(),weights=defaultWeights(),votes=null,pointVote=null,selected=null,playing=false,busy=false,source='rules',history=[],timer=null;
let overviewAt=performance.now(),hiddenPause=false;
const descriptions=structuredClone(d.objects);
const nearest=(points,w)=>points.reduce((a,b)=>Math.hypot(a[0]-w.x,a[1]-w.y)<=Math.hypot(b[0]-w.x,b[1]-w.y)?a:b);
function sync(){
  for(const [w,other] of [[d,p],[p,d]]){
    for(const [id,points] of Object.entries(SITES)){const [x,y]=nearest(points,w);w.objects[id]={...descriptions[id],x,y};}
    w.objects.friend={...descriptions.friend,x:other.x,y:other.y,description:'The other familiar inhabitant of this world. It can be visited and comforted.'};
  }
}
sync();habitat.setBodies(d,p);
for(const drive of DRIVES){
  const row=document.createElement('div');row.className='drive-row';row.style.setProperty('--drive-color',drive.color);
  row.innerHTML=`<div class="drive-title"><label class="drive-name" for="weight-${drive.id}"><span class="dot"></span>${drive.name}</label><span class="drive-vote" id="vote-${drive.id}">—</span></div><div class="drive-controls"><input id="weight-${drive.id}" type="range" min="0" max="4" step="0.1" value="1" aria-label="${drive.name} weight"><output id="value-${drive.id}">1.0×</output></div><div class="pressure-track" title="Last observed pressure"><i id="pressure-${drive.id}"></i></div>`;
  $('drives').append(row);
  $('weight-'+drive.id).addEventListener('input',e=>{weights[drive.id]=Number(e.target.value);$('value-'+drive.id).textContent=weights[drive.id].toFixed(1)+'×';document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));reconsider();});
}
function meters(id,w){const values=[['E',w.body.energy,'Energy'],['H',w.body.hydration,'Hydration'],['R',1-w.body.fatigue,'Rest']];$(id+'-meters').innerHTML=values.map(([l,n,name])=>`<span class="body-meter" title="${name}: ${Math.round(n*100)}%">${l}<i><em style="width:${n*100}%"></em></i></span>`).join('');}
function renderMind(){
  if(!votes)return;
  for(const drive of DRIVES){const v=votes.drives[drive.id];$('vote-'+drive.id).textContent=ACTIONS[v.choice].label;$('pressure-'+drive.id).style.width=(v.pressure*100)+'%';}
  const choice=arbitrate(votes,weights,{previous:d.lastAction});$('conflict').textContent=Math.round(choice.conflict*100)+'%';
  $('vote-caption').textContent=source==='jev'?'Last Jev observation':'Scripted preview';
}
function reconsider(){
  if(votes){selected=arbitrate(votes,weights,{previous:d.lastAction});$('dodeca-action').textContent='Next vote: '+ACTIONS[selected.action].label;renderMind();}
  $('status').textContent=source==='jev'?'Weights changed. Dodeca’s displayed vote reuses its last observation; both inhabitants reassess on the next step.':'Weights changed for both inhabitants. The next step uses the new balance.';
}
function render(){
  $('tick').textContent=String(d.tick).padStart(3,'0');meters('dodeca',d);meters('point',p);renderMind();
  $('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pause simulation':'Start simulation');
  $('play').disabled=busy&&!playing;$('step').disabled=busy;$('reset').disabled=busy;$('source').disabled=busy;
  document.querySelectorAll('[data-preset], .drive-controls input, .environment-tools button').forEach(el=>el.disabled=busy);
}
async function ask(world,singleOnly){
  const response=await fetch('/api/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:observe(world),weights,singleOnly})});
  const data=await response.json();if(!response.ok)throw new Error(data.error??'Jev request failed.');return data;
}
function localPoint(state){
  // Explicit simple baseline; this is not presented as a Jev answer.
  const e=scriptedEvaluation(state);let best='wait',strength=0;
  for(const drive of DRIVES){const v=e.drives[drive.id],score=v.pressure*weights[drive.id];if(score>strength){strength=score;best=v.choice;}}
  return {choice:best,confidence:1,probabilities:Object.fromEntries(IDS.map(a=>[a,a===best?1:0]))};
}
async function step(){
  if(busy)return;busy=true;render();sync();const before={d:structuredClone(d),p:structuredClone(p)};
  $('status').textContent=source==='jev'?'Jev is listening to twelve drives, then to Point…':'A moment passes in the wilderness.';
  try{
    let dResult,pResult;
    if(source==='jev'){
      dResult=await ask(d,false);pResult=await ask(p,true);votes=dResult;pointVote=pResult.single;
      $('usage').textContent=`${pResult.budget.requests} / ${pResult.budget.maxRequests} live calls · ${((dResult.latencyMs+pResult.latencyMs)/1000).toFixed(2)}s`;
    }else{votes=scriptedEvaluation(observe(d));pointVote=localPoint(observe(p));$('usage').textContent='Local rules · No API calls';}
    selected=arbitrate(votes,weights,{previous:d.lastAction});
    const da=selected.action,pa=pointVote.choice;
    d=advance(d,da);p=advance(p,pa);
    // Replenishing environment: needs and attention still require travel.
    if(d.tick%28===0){d.environment.novelty=clamp(d.environment.novelty+.3);p.environment.novelty=clamp(p.environment.novelty+.3);}
    history.push({tick:d.tick,source,weights:{...weights},before,actions:{dodeca:da,point:pa},votes,pointVote,receipts:source==='jev'?[dResult.receiptId,pResult.receiptId]:[]});
    if(history.length>250)history.shift();
    habitat.setBodies(d,p,votes);
    $('dodeca-action').textContent=ACTIONS[da].label;$('point-action').textContent=ACTIONS[pa].label;
    $('status').textContent=da===pa?`For this moment, they agree: ${ACTIONS[da].label.toLowerCase()}.`:`Dodeca: ${ACTIONS[da].label.toLowerCase()}. Point: ${ACTIONS[pa].label.toLowerCase()}.`;
  }catch(err){playing=false;$('status').textContent=err.message+' The world is paused.';}
  finally{busy=false;render();if(playing)timer=setTimeout(step,source==='jev'?1800:1100);}
}
function setPlaying(value){playing=value;clearTimeout(timer);render();if(playing&&!busy)step();}
$('play').addEventListener('click',()=>setPlaying(!playing));$('step').addEventListener('click',()=>{setPlaying(false);step();});
$('source').addEventListener('change',()=>{setPlaying(false);source=$('source').value;votes=null;pointVote=null;$('vote-caption').textContent=source==='jev'?'Awaiting Jev observation':'Scripted preview';$('status').textContent=source==='jev'?'Live Jev selected. Press play or step to give both inhabitants a decision.':'Local preview selected. Decisions are explicit scripted rules.';$('usage').textContent=source==='jev'?'Bounded live session':'No API calls in preview';});
$('reset').addEventListener('click',()=>{setPlaying(false);({d,p}=initial());votes=null;pointVote=null;history=[];sync();habitat.resetTrails();habitat.setBodies(d,p);$('dodeca-action').textContent='Taking in the world';$('point-action').textContent='Taking in the world';$('status').textContent='The inhabitants return. The live API budget does not reset.';render();});
function showMind(show){$('mind-panel').classList.toggle('hidden',!show);$('open-mind').setAttribute('aria-expanded',String(show));if(show)$('info-panel').classList.add('hidden');}
$('open-mind').addEventListener('click',()=>showMind($('mind-panel').classList.contains('hidden')));$('close-mind').addEventListener('click',()=>showMind(false));
$('about').addEventListener('click',()=>{$('info-panel').classList.toggle('hidden');showMind(false);});$('close-info').addEventListener('click',()=>$('info-panel').classList.add('hidden'));
$('inspect-point').addEventListener('click',()=>focus('point'));
function focus(id){habitat.focus(id);document.querySelectorAll('.camera-tools button').forEach(b=>b.classList.toggle('active',b.id===(id?'follow-'+id:'overview')));}
$('overview').addEventListener('click',()=>focus(null));$('follow-dodeca').addEventListener('click',()=>focus('dodeca'));$('follow-point').addEventListener('click',()=>focus('point'));
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  weights=defaultWeights();const preset=button.dataset.preset;
  if(preset==='curious'){weights.curiosity=4;weights.play=2;weights.fear=.4;}
  if(preset==='timid'){weights.fear=3;weights.shelter=3;weights.comfort=2;weights.curiosity=.3;}
  if(preset==='social'){weights.attachment=3;weights.care=3;weights.play=1.7;}
  DRIVES.forEach(d=>{$('weight-'+d.id).value=weights[d.id];$('value-'+d.id).textContent=weights[d.id].toFixed(1)+'×';});document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b===button));reconsider();
}));
$('new-object').addEventListener('click',()=>{d.environment.novelty=1;p.environment.novelty=1;$('status').textContent='A mineral formation starts humming. Both inhabitants notice something unfamiliar.';});
$('storm').addEventListener('click',()=>{d.environment.storm=.9;p.environment.storm=.9;d.body.cold=clamp(d.body.cold+.25);p.body.cold=clamp(p.body.cold+.25);$('status').textContent='A cold front approaches. Shelter and comfort have something to say.';});
$('call').addEventListener('click',()=>{d.environment.friendDistress=.9;p.environment.friendDistress=.9;$('status').textContent='A call crosses the grass. Each inhabitant hears the other asking for company.';});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'dodeca-session-v1',exportedAt:new Date().toISOString(),history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dodeca-session-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){showMind(false);$('info-panel').classList.add('hidden');}if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();setPlaying(!playing);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){setPlaying(false);$('status').textContent='Paused while this world is out of view.';}});
async function connect(){try{const status=await fetch('/api/status').then(r=>r.json());$('connection').textContent=status.available?'Jev connected · World at rest':'A local living sketch';$('source').querySelector('[value="jev"]').disabled=!status.available;
  const pilot=await fetch('/api/pilot').then(r=>r.json());if(pilot.status==='complete')$('pilot-summary').textContent=`Small authored pilot: Dodeca ${pilot.metrics.committee.interventions.correct}/8, Point ${pilot.metrics.single.interventions.correct}/8 target actions; shuffled adviser control ${pilot.metrics.shuffled.interventions.correct}/8. This is a feasibility check, not a general intelligence result.`;
}catch{$('connection').textContent='Local preview';}}
let lastPaint=0;
function frame(now){requestAnimationFrame(frame);if(document.hidden)return;if(habitat.reduced&&now-lastPaint<65)return;lastPaint=now;habitat.render(now);for(const id of ['dodeca','point']){const pos=habitat.project(id),label=$(id+'-label');label.style.left=pos.x+'px';label.style.top=pos.y+'px';label.style.display=pos.visible?'flex':'none';}}
requestAnimationFrame(frame);render();connect();$('loading').classList.add('hidden');
// Read-only diagnostic hook for proportional browser checks, never credentials.
window.dodecaLab={snapshot:()=>({tick:d.tick,source,playing,busy,history:history.length,weights:{...weights},actions:{dodeca:d.lastAction,point:p.lastAction},webgl:habitat.renderer.info.render,body:{dodeca:{...d.body},point:{...p.body}}})};
