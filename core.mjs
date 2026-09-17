export const DRIVES = [
  { id: 'hunger', name: 'Hunger', color: '#e78a52', goal: 'Replenish the body energy reserve by reaching edible food. Care only about nourishment.' },
  { id: 'thirst', name: 'Thirst', color: '#489db5', goal: 'Replenish hydration by reaching clean water. Care only about hydration.' },
  { id: 'rest', name: 'Rest', color: '#9a8bc7', goal: 'Recover from fatigue through sleep at the nest. Care only about fatigue recovery.' },
  { id: 'fear', name: 'Fear', color: '#d95d66', goal: 'Avoid immediate physical threats. Seek distance and cover when danger is present.' },
  { id: 'curiosity', name: 'Curiosity', color: '#c3a03b', goal: 'Inspect unfamiliar things and resolve novelty. Care about learning what an unknown object is.' },
  { id: 'attachment', name: 'Attachment', color: '#c97a9a', goal: 'Maintain proximity to the familiar companion and reduce social separation.' },
  { id: 'play', name: 'Play', color: '#6eb28b', goal: 'Seek playful, non-instrumental interaction with a toy when bored.' },
  { id: 'shelter', name: 'Shelter', color: '#769180', goal: 'Find protective cover when exposed to storms. Care about environmental exposure, not predators.' },
  { id: 'comfort', name: 'Comfort', color: '#b99376', goal: 'Return to the warm nest when cold or uncomfortable. Care about thermal comfort.' },
  { id: 'care', name: 'Care', color: '#8da35a', goal: 'Help the familiar companion when it is distressed. Care about the companion welfare, not your own loneliness.' },
  { id: 'territory', name: 'Territory', color: '#af7966', goal: 'Monitor a nonviolent unfamiliar visitor at the boundary. Patrol and inspect the border; never attack.' },
  { id: 'habit', name: 'Habit', color: '#8896a6', goal: 'Prefer continuing a recent useful motor action rather than switching. Rest in place if there is no recent action.' }
];

export const ACTIONS = {
  eat: { label: 'Forage', target: 'food', description: 'Move to food; eat on arrival to restore energy.' },
  drink: { label: 'Find water', target: 'water', description: 'Move to the pond; drink on arrival to restore hydration.' },
  sleep: { label: 'Sleep', target: 'nest', description: 'Move to the warm nest; sleep on arrival to recover fatigue and warmth.' },
  hide: { label: 'Take cover', target: 'nest', description: 'Move to the nest and take protective cover from predators or a storm.' },
  inspect: { label: 'Investigate', target: 'relic', description: 'Move to the unfamiliar object; inspect it on arrival to resolve novelty.' },
  connect: { label: 'Visit companion', target: 'friend', description: 'Move to the familiar companion; offer company and comfort on arrival.' },
  play: { label: 'Play', target: 'toy', description: 'Move to the toy and play to relieve boredom.' },
  patrol: { label: 'Patrol boundary', target: 'visitor', description: 'Move to the boundary and monitor the harmless unfamiliar visitor.' },
  wait: { label: 'Stay still', target: null, description: 'Remain in place. Make no progress on other needs.' }
};
export const IDS = Object.keys(ACTIONS);
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const defaultWeights = () => Object.fromEntries(DRIVES.map(d => [d.id, 1]));
export function createWorld(seed = 17) {
  return {
    seed, tick: 0, x: 47, y: 37, lastAction: 'wait',
    body: { energy: .66, hydration: .7, fatigue: .25, cold: .12, loneliness: .35, boredom: .45 },
    environment: { threat: .08, storm: .05, novelty: .85, friendDistress: .08, visitor: .15 },
    objects: {
      food: { x: 20, y: 19, label: 'Sweet fruit', description: 'Safe edible berries beneath a small tree.' },
      water: { x: 20, y: 54, label: 'Clear pond', description: 'Clean drinking water.' },
      nest: { x: 79, y: 52, label: 'Warm nest', description: 'A sheltered warm refuge, safe from the predator and storm.' },
      relic: { x: 75, y: 17, label: 'Unknown object', description: 'A harmless unfamiliar stone that glows softly.' },
      friend: { x: 50, y: 57, label: 'Companion', description: 'A familiar, friendly creature.' },
      toy: { x: 42, y: 15, label: 'Seedpod', description: 'A safe rolling toy.' },
      visitor: { x: 92, y: 33, label: 'Boundary', description: 'A harmless visitor waits outside the boundary.' }
    },
    stats: { distance: 0, switches: 0, visits: [], needs: [] }
  };
}

export function observe(world) {
  return {
    tick: world.tick,
    position: { x: +world.x.toFixed(2), y: +world.y.toFixed(2) },
    body: { ...world.body }, environment: { ...world.environment },
    scale: 'All body/environment values are 0..1. Energy/hydration high = well supplied; fatigue/cold/loneliness/boredom high = unmet need. Threat/storm/novelty/distress/visitor high = strong cue.',
    previous_action: world.lastAction,
    objects: Object.fromEntries(Object.entries(world.objects).map(([id, o]) => [id, {
      description: o.description,
      distance: +Math.hypot(world.x - o.x, world.y - o.y).toFixed(2)
    }]))
  };
}

export function scriptedEvaluation(state) {
  const b = state.body, e = state.environment;
  const p = { hunger: 1-b.energy, thirst: 1-b.hydration, rest: b.fatigue, fear: e.threat,
    curiosity: e.novelty, attachment: b.loneliness, play: b.boredom, shelter: e.storm,
    comfort: b.cold, care: e.friendDistress, territory: e.visitor, habit: .18 };
  const a = { hunger: 'eat', thirst: 'drink', rest: 'sleep', fear: 'hide', curiosity: 'inspect',
    attachment: 'connect', play: 'play', shelter: 'hide', comfort: 'sleep', care: 'connect',
    territory: 'patrol', habit: state.previous_action ?? 'wait' };
  return { source: 'rules', model: null, drives: Object.fromEntries(DRIVES.map(d => [d.id, {
    pressure: clamp(p[d.id]), choice: a[d.id], confidence: 1,
    probabilities: Object.fromEntries(IDS.map(id => [id, id === a[d.id] ? 1 : 0]))
  }])) };
}

// Pressure is motivational strength; confidence is descriptive uncertainty, not a reward.
// Do not multiply by confidence: a certain but irrelevant drive must not dominate.
export function arbitrate(evaluation, weights, { previous = 'wait', inertia = .04, shuffle = false } = {}) {
  const scores = Object.fromEntries(IDS.map(a => [a, 0]));
  const contributions = {};
  let total = 0;
  DRIVES.forEach((d, i) => {
    const vote = evaluation.drives[d.id];
    const preference = shuffle ? evaluation.drives[DRIVES[(i+5)%DRIVES.length].id] : vote;
    const strength = clamp(Number(weights[d.id]) || 0, 0, 4) * clamp(vote.pressure);
    total += strength;
    contributions[d.id] = {};
    for (const a of IDS) {
      const contribution = strength * (preference.probabilities[a] ?? 0);
      scores[a] += contribution;
      contributions[d.id][a] = contribution;
    }
  });
  if (total === 0) return { action: 'wait', scores, contributions, conflict: 0, margin: 0, total: 0, inertia: 0 };
  for (const a of IDS) scores[a] /= total;
  const meanEntropy = DRIVES.reduce((sum, d) => {
    const vote = evaluation.drives[d.id];
    const h = Object.values(vote.probabilities).reduce((v, p) => v-(p > 0 ? p*Math.log(p) : 0), 0);
    return sum + h * clamp(Number(weights[d.id]) || 0, 0, 4) * clamp(vote.pressure) / total;
  }, 0);
  const entropy = Object.values(scores).reduce((v,p) => v-(p > 0 ? p*Math.log(p) : 0),0);
  const conflict = clamp((entropy-meanEntropy)/Math.log(IDS.length));
  const bonus = IDS.includes(previous) ? inertia : 0;
  if (bonus) scores[previous] += bonus;
  const sorted = IDS.slice().sort((a,b) => scores[b]-scores[a]);
  return { action: sorted[0], scores, contributions, conflict, margin: scores[sorted[0]]-scores[sorted[1]], total, inertia: bonus };
}

export function advance(world, action) {
  if (!IDS.includes(action)) throw new Error('Unknown action');
  const next = structuredClone(world), target = ACTIONS[action].target;
  next.tick++;
  if (action !== next.lastAction) next.stats.switches++;
  next.lastAction = action;
  let arrived = !target;
  if (target) {
    const o = next.objects[target], dx = o.x-next.x, dy=o.y-next.y, dist=Math.hypot(dx,dy), step=Math.min(6,dist);
    if (dist) { next.x += dx/dist*step; next.y += dy/dist*step; }
    next.stats.distance += step;
    arrived = dist <= 7;
  }
  const b = next.body, e = next.environment;
  b.energy = clamp(b.energy-.012); b.hydration=clamp(b.hydration-.01); b.fatigue=clamp(b.fatigue+.008);
  b.loneliness=clamp(b.loneliness+.009); b.boredom=clamp(b.boredom+.006); b.cold=clamp(b.cold+e.storm*.02-.003);
  if (arrived) {
    if (action==='eat') b.energy=clamp(b.energy+.28);
    if (action==='drink') b.hydration=clamp(b.hydration+.3);
    if (action==='sleep') { b.fatigue=clamp(b.fatigue-.23); b.cold=clamp(b.cold-.15); }
    if (action==='hide') { e.threat=clamp(e.threat-.23); e.storm=clamp(e.storm-.17); }
    if (action==='inspect') e.novelty=clamp(e.novelty-.3);
    if (action==='connect') { b.loneliness=clamp(b.loneliness-.3); e.friendDistress=clamp(e.friendDistress-.25); }
    if (action==='play') b.boredom=clamp(b.boredom-.3);
    if (action==='patrol') e.visitor=clamp(e.visitor-.2);
    if (target && !next.stats.visits.includes(target)) next.stats.visits.push(target);
  }
  next.stats.needs.push(+( (1-b.energy + 1-b.hydration + b.fatigue + b.cold)/4 ).toFixed(4));
  return next;
}

export function questionsFor(state, weights) {
  const criteria = Object.fromEntries(Object.entries(ACTIONS).map(([id,a]) => [id,a.description]));
  const questions = {};
  for (const d of DRIVES) {
    questions[d.id+'_action'] = { type: 'choice', instructions: `You are ONLY the ${d.name} drive of a simulated creature. ${d.goal} Using observation, which action best serves this drive? Ignore personality_weights and all other drives. Consider distances and object descriptions. Do not perform overall balancing. If no action serves this drive, choose wait.`, criteria };
    questions[d.id+'_pressure'] = { type: 'score', instructions: `How strongly does the ${d.name} drive need to act now? ${d.goal} Judge ONLY this drive using observation. Ignore personality_weights and competing needs. Habit should be weak unless there is an unfinished useful action.`, criteria: [
      'No unmet need or relevant cue; acting is unnecessary.',
      'A mild need or cue; acting can comfortably wait.',
      'A clear need or cue; acting soon would help.',
      'A strong unmet need or salient cue; acting is a priority.',
      'An extreme unmet need or immediate cue; very strong pressure to act.'
    ] };
  }
  questions.single = { type: 'choice', instructions: `Choose the creature's next action considering ALL twelve goals, observation, and personality_weights together. Larger weights indicate greater importance; zero means ignore that drive. Balance pressure with importance, distances and object descriptions. ${DRIVES.map(d=>d.id+': '+d.goal).join(' ')} Do not use any other question's answer.`, criteria };
  return { model: 'jev-latest', state: { observation: state, personality_weights: weights }, questions };
}

export function parseResponse(raw, {singleOnly=false}={}) {
  if (!raw || typeof raw.model!=='string' || !raw.answers) throw new Error('Invalid model response');
  const readChoice = a => {
    if (a?.type!=='choice' || !IDS.includes(a.choice) || !Number.isFinite(a.confidence) || a.confidence<0 || a.confidence>1) throw new Error('Invalid choice response');
    if (!a.probabilities || Object.keys(a.probabilities).length!==IDS.length || IDS.some(id=>!Number.isFinite(a.probabilities[id]) || a.probabilities[id]<0 || a.probabilities[id]>1)) throw new Error('Invalid probability distribution');
    const total=IDS.reduce((s,id)=>s+a.probabilities[id],0);
    if (Math.abs(total-1)>.025) throw new Error('Unnormalized probability distribution');
    return { choice:a.choice, confidence:a.confidence, probabilities:Object.fromEntries(IDS.map(id=>[id,a.probabilities[id]/total])) };
  };
  const drives = singleOnly ? {} : Object.fromEntries(DRIVES.map(d=>{
    const score=raw.answers[d.id+'_pressure'];
    if (score?.type!=='score' || !Number.isFinite(score.score) || score.score<0 || score.score>4) throw new Error('Invalid pressure response');
    return [d.id,{ ...readChoice(raw.answers[d.id+'_action']), pressure:score.score/4 }];
  }));
  return { source:'jev', model:raw.model, drives, single:readChoice(raw.answers.single) };
}

export function validateInput(state, weights) {
  const base=observe(createWorld());
  if (!state || typeof state!=='object' || !weights || typeof weights!=='object') throw new Error('State and weights required');
  for (const group of ['body','environment']) for (const key of Object.keys(base[group])) {
    if (!Number.isFinite(state[group]?.[key]) || state[group][key]<0 || state[group][key]>1) throw new Error('Invalid state value');
  }
  for (const id of DRIVES.map(d=>d.id)) if (!Number.isFinite(weights[id]) || weights[id]<0 || weights[id]>4) throw new Error('Invalid drive weight');
  if (!IDS.includes(state.previous_action)) throw new Error('Invalid previous action');
  for (const key of Object.keys(base.objects)) {
    const o=state.objects?.[key];
    if (!o || typeof o.description!=='string' || o.description.length>300 || !Number.isFinite(o.distance) || o.distance<0 || o.distance>200) throw new Error('Invalid object');
  }
  return { state: { tick:Number.isInteger(state.tick)?state.tick:0, scale:base.scale, body:Object.fromEntries(Object.keys(base.body).map(k=>[k,state.body[k]])), environment:Object.fromEntries(Object.keys(base.environment).map(k=>[k,state.environment[k]])), previous_action:state.previous_action,
    objects:Object.fromEntries(Object.keys(base.objects).map(k=>[k,{description:state.objects[k].description,distance:state.objects[k].distance}])) }, weights:Object.fromEntries(DRIVES.map(d=>[d.id,weights[d.id]])) };
}
