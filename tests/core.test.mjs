import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DRIVES,IDS,defaultWeights,createWorld,observe,scriptedEvaluation,arbitrate,advance,questionsFor,parseResponse,validateInput} from '../core.mjs';
test('resources require travel before replenishing; motor steps are bounded',()=>{
  let w=createWorld();w.body.energy=.1;const next=advance(w,'eat');
  assert.ok(next.body.energy<w.body.energy);assert.ok(Math.abs(next.stats.distance-6)<1e-8);assert.equal(w.tick,0);
  for(let i=0;i<10;i++)w=advance(w,'eat');assert.ok(w.body.energy>.7);
});
test('all muted drives produce wait, not an arbitrary first action',()=>{
  const votes=scriptedEvaluation(observe(createWorld()));const weights=Object.fromEntries(DRIVES.map(d=>[d.id,0]));
  assert.equal(arbitrate(votes,weights,{previous:'eat'}).action,'wait');
});
test('selective intervention flips a competing action and preserves unrelated vote',()=>{
  const w=createWorld();w.body={energy:.95,hydration:.95,fatigue:0,cold:0,loneliness:0,boredom:0};w.environment={threat:.7,novelty:.7,storm:0,friendDistress:0,visitor:0};
  const votes=scriptedEvaluation(observe(w)),copy=structuredClone(votes),weights=defaultWeights();weights.fear=4;
  assert.equal(arbitrate(votes,weights,{inertia:0}).action,'hide');weights.fear=1;weights.curiosity=4;
  assert.equal(arbitrate(votes,weights,{inertia:0}).action,'inspect');assert.deepEqual(votes,copy);
});
test('model confidence does not become motivational weight',()=>{
  const votes=scriptedEvaluation(observe(createWorld())),weights=defaultWeights(),a=arbitrate(votes,weights);
  for(const v of Object.values(votes.drives))v.confidence=0;
  assert.equal(arbitrate(votes,weights).action,a.action);
});
test('numeric state sanitizer drops extra instructions and rejects NaN or missing objects',()=>{
  const state=observe(createWorld());state.prompt='unrelated';const clean=validateInput(state,defaultWeights());assert.equal(clean.state.prompt,undefined);
  state.body.energy=NaN;assert.throws(()=>validateInput(state,defaultWeights()));
});
test('questions contain drive meaning explicitly and baseline includes all goals',()=>{
  const q=questionsFor(observe(createWorld()),defaultWeights());assert.equal(Object.keys(q.questions).length,25);
  for(const d of DRIVES){assert.ok(q.questions[d.id+'_action'].instructions.includes(d.goal));assert.ok(q.questions.single.instructions.includes(d.goal));assert.equal(Object.keys(q.questions[d.id+'_action'].criteria).length,IDS.length);}
});
test('model response validation accepts complete distributions and rejects invalid scores',()=>{
  const vote={type:'choice',choice:'wait',confidence:1,probabilities:Object.fromEntries(IDS.map(id=>[id,id==='wait'?1:0]))};
  const raw={model:'test',answers:{single:vote}};
  for(const d of DRIVES){raw.answers[d.id+'_action']=vote;raw.answers[d.id+'_pressure']={type:'score',score:2};}
  assert.equal(parseResponse(raw).drives.hunger.pressure,.5);
  assert.equal(parseResponse({model:'test',answers:{single:vote}},{singleOnly:true}).single.choice,'wait');
  raw.answers.hunger_pressure.score=5;assert.throws(()=>parseResponse(raw));
});
test('500 simulated steps keep physiological state finite and in range',()=>{
  let world=createWorld();for(let i=0;i<500;i++){world=advance(world,IDS[i%IDS.length]);for(const x of Object.values(world.body))assert.ok(Number.isFinite(x)&&x>=0&&x<=1);}
});
