# Intake automaton: moving it to the backend

## Where it runs today

The automaton lives in `src/lib/intakeQuestions.js` and is shared by both sides:

- **Server:** `server/applicationsService.js` already imports it and is the authority for saved applications (`applyTap`, `mergeInterpretation`, `reconcile`). The typed-answer interpreter runs on the server too.
- **Client:** `IntakeStep.jsx` runs `nextQuestion` in the browser to decide what to show. The landing chat (`LandingChat.jsx`) runs the whole automaton in the browser: `applyTap`, `nextQuestion` and `eligibilityFromFacts`.
- **Bundle:** the full rule set ships in `dist/assets/index-*.js`. You can find "Only my vehicles" in it.

## Why that won't scale

1. **The rules are code.** Each question's `relevant`, `options` and `apply` is a JavaScript function. So every new kind of business (exporters, 100% export units, nutraceuticals, capacity limits) needs a developer to edit it, and the frontend has to be rebuilt and redeployed.
2. **Two copies can disagree.** A browser still holding an old bundle can show a question the server no longer asks, or work out a different licence.
3. **Rule changes break open applications.** An application saved halfway through has no record of which rule version it was answered under. When the rules change, it can land in a state the new rules don't expect.
4. **The rules are public.** Anyone can read the full decision logic in the bundle. That's minor, but it is a product asset.
5. **The rules can't be edited as data.** An admin page for rules, or promoting learned answers into rules, needs rules that can be stored and edited. Code can't be.

## What to do, in two phases

### Phase 1: make the server the only engine

- Add `POST /api/intake/step`. It takes the current answers plus the new tap or typed text. It returns the updated answers, the next question already rendered (title, hint, options with their labels and examples), the summary rows and the eligibility result.
- The landing chat calls it without login, rate-limited like `/api/intake/interpret` is today. The dashboard uses the application endpoints it already has.
- The client becomes a renderer: it shows what the server sends. `intakeQuestions.js` leaves the frontend bundle, and each tap costs one small round trip. Keep the engine a pure module with no database access, so `check-intake.mjs` can still test every path directly.
- Phase 1 is mostly moving code around, with low risk, and it fixes problems 2 and 4 straight away.

### Phase 2: turn the rules into data

- Move questions, options, conditions and licence rules out of JavaScript functions into a versioned rule file. Conditions become simple expressions, for example `{"all": [{"has": ["activities", "make"]}, {"eq": ["place", "street"]}]}`. A small interpreter evaluates them.
- Stamp each application with the rule version it was answered under. Existing applications keep their version, and new ones get the latest.
- Before any new version goes live, `check-intake.mjs` runs over it. That's the safety net for anyone adding business types without a developer.
- Rules start as a file under `config/`. Moving them into the database with an admin editor can wait until someone other than us edits rules.

**Cost:** a phone on a slow network waits briefly after each tap. Showing the tap as selected straight away and loading the next question in the background covers most of it.

## Recommendation

Do Phase 1 now, since it's small and fixes the real problems. Phase 2 is worth doing just before the first batch of new business types, because designing the rule format around real new cases will get it right.

## Automaton + graph: the model for Phase 2

We can't list every kind of food business in one go. But what keeps growing is the kinds of business, not the conversation. So the model splits in two.

### 1. A small, fixed automaton for the conversation

It runs the flow and nothing else: pick the next unanswered question, take an answer, check for contradictions, confirm, and reach a verdict. It has few states, and they don't change when we learn about a new business.

### 2. A graph of food-business knowledge that grows over time

- **Nodes:** kinds of business (restaurant, dairy, exporter, nutraceutical maker), activities (cook, make, sell, import), premises types, thresholds (turnover, milk litres a day, oil tonnes a day), licence types and documents.
- **Edges:**
  - *is a:* a cloud kitchen is a kind of cook-and-serve business.
  - *needs a fact:* a dairy needs its daily milk capacity. The edge carries the question that asks for it.
  - *forces:* an exporter always needs a Central Licence.
  - *requires document:* an importer needs its IEC.
  - *unlikely with:* a combination the user should be asked to confirm.

The automaton reads the graph. The questions to ask are the facts needed by the nodes the user has matched so far. A new kind of business is a new node with its edges. It needs no new code, and existing paths don't change.

Most of this already exists in the code, spread across functions: the activity-to-business mapping in `sanitizeFacts` ("is a"), `hasCentralOverride` ("forces Central"), `RULES` ("implied by" and "unlikely with") and `requiredDocuments` ("requires document").

### Plan for an incomplete graph

The graph will always be missing something, so it needs an explicit **unknown** outcome. If the user's description (or the model's reading of it) doesn't reach a known node, the conversation hands over to an expert, says so honestly, and logs the case. Those logs become the list of nodes to add next.

Today the model always forces text into one of the four activity buckets. For an exporter or a supplement maker, that can confidently give the wrong licence. This is the biggest correctness risk right now.

### Guardrails

- **The verdict is fixed and checkable.** The licence comes from the "forces" edges and the turnover and capacity thresholds, in a fixed order where Central beats State and State beats Registration. The model only maps free text to nodes. It never decides the licence.
- **The "is a" and "forces" edges have no cycles**, so the verdict doesn't depend on the order they're read in.
- **`check-intake.mjs` walks the graph.** It fails on any path that has no verdict or two conflicting verdicts, and on any question that can't be reached. New nodes are merged only after it passes.
- **No graph database.** At dozens to low hundreds of nodes, a versioned JSON file under `config/` is enough, and it's easy to review.

### Effect on the phases

Phase 1 is unchanged: move the engine to the server. In Phase 2 the rule file becomes "automaton + graph" instead of a flat list of questions, and the unknown → expert handover is built in from the start. Exporters and nutraceuticals are the first two nodes to try the format on.
