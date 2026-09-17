# Dodeca pilot 01 — twelve drives, one body

Registered 2026-09-16 before live Jev calls for this experiment. Status: exploratory mechanism pilot. Owner: Alireza; implementation: Codex. This standalone project has its own protocol and repository.

## Claim and losing result

The design hypothesis is that independent semantic advisers, coupled through a transparent weighted motor selector, provide inspectable selective behavioral control. On eight authored high-weight conflict interventions, the committee should choose the action serving the increased drive more often than a control that rotates advisers' action distributions across drive identities. Failure to beat that rotation control, or a failed basic capability gate, leaves the mechanism unsupported even in this toy setting.

The single holistic Jev decision is an equally important rival: matching or losing to it supplies no performance advantage for decomposition. A scripted controller is the strongest simple baseline on this numeric world; it may match or exceed the model. A gain in an arithmetic intervention is not evidence that the model learned modularity or that there are twelve internal brains.

## Frozen design

`config/pilot.json` fixes four basic control states and four conflict states. Each conflict is evaluated at default weights and at each of two competing drives raised from 1 to 4. Every other weight stays 1. Total: 16 requests, 25 questions per request (12 action choices, 12 pressure scores, 1 holistic choice). All see the same observation and action menu. Individual questions are instructed to ignore weights; the holistic question sees their values and every drive's description.

Conditions: committee, holistic single question, explicit numeric rules, and committee with action distributions cyclically reassigned by five drive positions while pressures and weights retain their identities. The same Jev response supplies committee, single, and shuffled decisions. No additional sampling, retries, selected seeds, or tuning. This is state- and request-matched; it is **not token/compute-matched** between 24 questions and one question. Sharing one request does not make those costs equal. No speed or cost superiority claim.

Action selector: sum each adviser's action probabilities weighted by its pressure (score / 4) and user weight, divide by total pressure-weight, choose argmax in fixed action order. All-zero weight means wait. Frozen pilot inertia is zero. Interactive simulation adds an explicit 0.04 previous-action bonus. Confidence is displayed, not multiplied into motivational force. Weighted Jensen-Shannon disagreement summarizes the adviser distributions; it is not consciousness or felt conflict.

## Outcomes

- Capability gate: committee and holistic decision must each pass at least 3/4 basic controls.
- Primary: fraction of the 8 high-weight interventions choosing the prospectively specified target action; report all four conditions.
- Secondary: paired flip count across four conflict pairs; raw pressures, preferences, and failure cases; latency, input/output tokens, and model revision.
- Report exact counts and Wilson intervals descriptively. These are authored, dependent cases, not a random population sample; intervals do not support generalization. Default-weight conflict decisions have no accuracy label.
- Pilot has no learning, train/test split, hidden benchmark, physical power telemetry, or external validation. Scores are synthetic target compatibility, not welfare or intelligent behavior quality.
- Object descriptions are the model's semantic input, but these cases primarily expose numeric needs. A semantic OOD test and matched closed-loop trajectories would be the next evidence step, not established by this pilot.

## Stop and provenance

At most 20 API attempts and 300,000 reported input tokens, 20 seconds per attempt, serial requests, no automatic retry. Stop on an API/schema failure and mark the run incomplete. Complete the fixed table even if its early decisions are unfavorable. Store each full synthetic request, response, hash, UTC timestamp, and latency. Freeze config, protocol, and source SHA-256 plus Git state before receiving any result. Preserve each run under a unique directory; `latest-summary.json` is only a derived pointer for the UI.

Sources: [API](https://docs.typesafe.ai/api), [Choice](https://docs.typesafe.ai/primitives/choice), [Confidence](https://docs.typesafe.ai/confidence), accessed 2026-09-16. TypeSafe pricing used only for an estimated token cost: $0.042 / million input tokens; not an account billing receipt. Keys stay in the loopback backend's memory and never enter requests' state, browser code, or receipts.
