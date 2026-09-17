# Dodeca & Point

[Enter the habitat](https://dodeca.alirezaafshan.com/) · [Alireza's Galaxy](https://alirezaafshan.com/) · [Field notes](report.md)

Two inhabitants share a bright, strange 3D wilderness. Resources are abundant but scattered. **Dodeca** combines twelve competing motivational advisers. **Point** makes one holistic decision. Both have the same action menu, physiology, and movement rules.

Jev supplies probabilistic judgments. The simulation supplies the body, memory, changing needs, terrain, motor actions, and vote aggregation. The twelve advisers are independent questions to the same model, not independently trained brains. No consciousness claim is made.

## Visit

Drag to orbit and scroll to zoom. Follow either inhabitant. Open Dodeca to inspect its drives and adjust shared priority weights. Add a discovery, a cold front, or a call for companionship. Select **Live Jev** for real model decisions, or **Local preview** for explicitly scripted rules. Play advances the world; Step advances one decision. The world pauses when the tab is hidden. Export downloads the current session's bounded history.

The world contains fruit groves, clear ponds, warm nests, play objects, levitating mineral formations, grass, flowering trees, drifting clouds, and floating rock gardens. All geometry is procedural original code. Three.js is MIT licensed. Resources replenish; this prototype studies selection and travel, not scarcity. Movement does not yet avoid trunks and rocks, and there is no learned memory or shared persistent simulation across visitors.

## Run

Node 22+:

```sh
npm ci
npm test
npm run check
npm start
```

Open `http://127.0.0.1:8788`. Without a key, the local preview works. On Alireza's enrolled Windows host, `./launch.ps1` consumes exactly `typesafeai-tinkering-key` / `API Key` from the Viewer-only Proton gateway and starts the server. The key never enters browser code, Git, or API receipts. On another host, inject `TYPESAFE_API_KEY` into the Node process through that host's own credential mechanism.

## Mechanism

Each drive gets a Choice over nine motor actions and a Score over five motivational-pressure levels. Dodeca selects the largest summed `weight × pressure × action_probability`, normalized by total drive strength, plus a visible-design previous-action bonus of 0.04 in the interactive world. The pilot disables that bonus. Confidence measures uncertainty and is not treated as motivational strength. Point receives all twelve goals and shared weights in one Choice. They perceive the same types of information but occupy different locations.

The live Dodeca request currently contains the 24 adviser questions plus one unused holistic comparison question; Point's independent observation uses one question. Costs are not matched. Each public viewer has their own local world state.

## Evidence

The frozen [pilot protocol](preregister.md) used 16 requests on authored numeric need states. Dodeca matched 8/8 target interventions, Point 7/8, rules 8/8, and shuffled adviser identities 0/8. Both Jev controllers passed 4/4 basic controls. This supports controllability on these authored cases; it does not show an advantage over rules or general intelligence. Raw synthetic requests and responses, source hashes, and measured token/latency receipts are in `results/`.

## Hosting

Docker runs on Alireza's existing VPS through Deploy Manager: public port 3200 and candidate 3201, both host-loopback-only, internal port 8080. `/healthz` reports exact source revision. The API validates state, enforces same-site origins, limits request size and rate, and permits one model call at a time.

The shared live allowance is at most 160 requests and 600,000 input tokens per deployed instance; failed requests reserve a conservative token amount. An atomic ledger under `runtime-data` survives process/container restarts. A newly created release container starts its own allowance. Local preview remains available when the allowance is exhausted. The token rate used in the report is a published estimate, not an account billing receipt.

The encrypted Proton agent enrollment stays on Windows. Only the specifically authorized TypeSafe service credential is provisioned into the VPS root-only runtime env file. Deployment webhook secrets are separate. `deployment/` records the additive fleet specification and narrow operator helpers; secrets are never committed.

## Next question

Can modular semantic advisers outperform equally budgeted holistic and scripted controls when descriptions change the meaning of a resource, while numeric cues and motor physics stay fixed? The present world is an inspectable starting point for that test.
