# TODO

## Document ownership check (deferred - keep off while testing with borrowed/sample documents)

Verify that an uploaded document really belongs to the person/business submitting the application.

- The verifier already extracts fields per document type (`extract` in `config/document-types.json`, e.g. `holder_name`, `owner_name`, `firm_name`, `company_name`, `entity_name`) and stores them in `documents.verification -> extracted`.
- Compare those against the registered user (`users.name`, `users.business_name`) and the application form data (applicant name, FBO name, legal name, address) with fuzzy matching (case, initials, honorifics, transliteration, "Pvt Ltd" variants).
- Decide per document type which field must match (identity -> holder name; premise -> owner or occupant; IEC -> firm name; etc.) and add it to `config/document-types.json`.
- Outcome: mismatch -> `review` (officer check) or `rejected`, with a user-facing reason. Make strictness configurable, and add a config switch to disable the check for testing.
- Consider address matching for address/premise proofs, and cross-document consistency (same name across identity, address, premise).

## Other open items

- Email verification (no 2FA for now). Password reset is done; it needs `config/mail.json` (SMTP) to actually deliver emails.
- Key rotation for document encryption (a key id in the file header would allow re-encrypting under a new key).
- Real payment gateway: replace the test checkout in `server/paymentsService.js` and confirm payments via the gateway's webhook, not the browser.
- Password-protected PDFs (e.g. e-Aadhaar) are stored as uploaded, still encrypted; the password is never stored. The submission engine will need an unlocked copy: decide whether to store an unlocked version (encrypted at rest) or ask the user for the password during the ops call.
- PDFs longer than 4 pages: only the first 4 are sent for verification (`MAX_PDF_PAGES` / `MAX_PAGES`); the full PDF is still stored.
- Documents are stored per user, not per application: a second application reuses the user's current documents. Link documents to applications once users can have several at once.
- Robotic submission engine (separate module): picks up applications with status `ready`; the ops team calls the user for OTP and fee payment.
- Landing page "Talk to an expert" / "Ask an expert" buttons go to sign-up; signed-in users can send requests from Support. Add a public phone/WhatsApp number or an enquiry form for visitors.
- Operations view: expert requests (`support_requests`) and ready applications are only in the database. The team needs a screen to see them, update request status (open / in progress / closed) and record filing progress, so the dashboard's "What happens next" can move past "Filing call".
- Funnel analytics: log when each application step is reached (photos → intake → summary → details → documents → forms → ready) to measure drop-off and whether photo-first reduces abandonment.

## Intake engine: automaton + graph experiment (current focus)

Background and reasoning: `automata-next.md`. This is built and tested in **`~/fssai-intake-lab`** (step 1 design: `DESIGN.md` there), outside the portal. Nothing in the portal UI changes until it has proved itself.

Decisions (2026-09-25):
- **Every step that uses an LLM runs on the backend.** The browser only renders what the server sends.
- **A small, fixed automaton runs the conversation**: next question, contradictions, confirmation, verdict. **A growing graph holds knowledge about food businesses**: kinds of business, activities, premises, thresholds, licences, documents, and the edges between them (is a, needs a fact, forces, requires document, unlikely with).
- **Known unknowns:** any answer that reaches no known node is handed to an expert and logged, never forced into the nearest bucket.
- **The licence is decided by fixed rules, never by a model.** Models only map free text to nodes.
- The graph is a versioned JSON file. No graph database.
- Leave the UI alone for now.

Steps, in order:
1. **Design the automaton to fit the graph.** *Design reviewed; **M1 done 2026-09-25**: `~/fssai-intake-lab` engine + `graph.v1.json` match the portal on all 17,574 paths (lockstep parity, ~600k typed merges, mutation tests). **M2 done 2026-09-25**: `graph.v2.json` licenses by FoSCoS Kind of Business (39 kinds, place rules, fees, documents, head-office task, expert handover); all 251,564 walked paths pass, and 27 scenario cases pass, including the portal's known errors. Expert review questions are listed in the lab's `DESIGN.md` §9. Next: M3 (convert the production cache into records).* The design document covers the automaton's states, the graph file format with node and edge types, and one shared record format for an interpreted answer: `{ step, known_facts, text, text_norm, lang, targets, negatives, unknown, facts, source, model, graph_version, prompt_version, status }`. The automaton looks answers up in these records, CLM trains on them, and steps 2 and 3 produce them. Review the design before writing any code.
2. **Semantic layer over the production LLM cache.** Convert `intake_answer_cache` entries (keyed to today's question and option IDs, prompt `v3`) into records keyed by graph node. Group reworded duplicates, flag cases where the same text got different interpretations, mark frequently hit phrases as candidates for the lexicon, and strip personal details (names, numbers, addresses) before anything is used as data. Keep real answers mainly as the **test set**.
3. **LLM loop to fill the cache for each step.** Run planner → reviewer per automaton step to generate ways people phrase each answer: Hinglish, typos, very short answers, mixed activities, and deliberate **no-match** examples. Every edge cites a source (the Licensing & Registration Regulations 2011 texts in `~/fssai/data`). The loop writes versioned staging files, **never the live cache**. Only reviewed records are promoted.
   - **Sources follow three trust levels** (`DESIGN.md` §2.2a): A is the `~/fssai` corpus, B is official websites, C is the general web. Licence and threshold edges need level A to become final. Level C is used only for descriptions and phrasings.
   - **Web research uses `~/kbagent`** (Tavily + Obscura on `:7001`), with these changes:
     - return structured evidence `{url, quote, fetched_at, sha256}` instead of a Markdown answer, so each claim is backed by a quote, not just a URL;
     - per-level domain allowlists;
     - save every fetched page by hash so the sources can be reproduced;
     - search the corpus (`~/fssai/data/text`) before the web;
     - never send user text from records to Tavily.
   - Official documents found on the web go into the corpus through the `~/fssai` collection pipeline.
   - **Licensing sources come from FoSCoS, not the `~/fssai` corpus** (the corpus holds laws and regulations only). The key source is the 2026 Kind of Business eligibility table, now in `~/fssai-intake-lab/sources/`. Also saved there: the FoSCoS Guidance Document (use the `_Latest` version), the guide for KoB structure and filing process. The other FoSCoS manuals (exporters, importers, e-commerce, nutraceuticals, list of documents required) are listed in `sources/foscos-assets.txt`. Add them to the `~/fssai` corpus through its pipeline so they become level A.
   - The full FoSCoS manual set is cached in `documents/`. The lab's derived text is in `~/fssai-intake-lab/sources/foscos/`. The scanned document list for each kind of business (March 2021 order) is transcribed there with the local Qwen vision model (`tools/transcribe.py`); it is the source for the required-documents edges. Compare it with the portal's `config/document-types.json` / `requiredDocuments` once the graph exists.
   - **The live portal disagrees with that table** (`DESIGN.md` §2.2a):
     - It shows a State Licence fee of ₹2,000; the table says ₹5,000.
     - It misses the "always Central" categories: exporters, 100% EOU, nutraceuticals, proprietary and non-specified food, Ayurveda aahara, radiation processing.
     - It uses the wrong bands for caterers (State up to ₹50 Cr, with no Registration), hotels (by star rating) and clubs or canteens.
     - Decide whether to patch the portal now or wait for the lab.

Also planned:
- An **independent CLI tool** to exercise the decision automaton: walk all paths, run test businesses, show verdicts. It extends `scripts/check-intake.mjs`.
- **CLM** (Contrastive-LM/CLM-v0.1-8B) as the fast matcher of text to nodes, with the step 1–3 records as its training data. Add an explicit "none of these" candidate or a calibrated score threshold. Train its heads on embeddings from the exact encoder build that will serve it. Compare it against the current interpreter on real answers, measuring accuracy, latency and how often it correctly returns unknown.
- The first new nodes to try the format on are exporters and nutraceuticals.
- **After** it proves efficacious: move the engine into the portal backend (Phase 1 in `automata-next.md`), then change the UI.
- Later, and not now: the FSSAI law-domain adapter (expert opinion, artwork verification), and expert sign-off on licence edges.

Machines:
- Local 3090, `:7001` vLLM `qwen3.8-27b` (base is fine for now; key in `VLLM_API_KEY`). It is the planner, and steps 1–2 need only this.
- Spark `10.8.0.4`, `:8001` `qwen3.8-flash-next` (~177B). It is the reviewer. Pilot training lives in `~/disk/fssai-pilot`.
- CLM runs locally (stop `:7001` first, since the 3090 has no room for both) or on Spark.
- **Never use `10.8.0.5`**: it is the production document checker.

## FoSCoS filing: survey done, document cross-check next

Survey (2026-09-25): `~/fssai-robot/docs/FOSCOS_SURVEY.md` + `FOSCOS_SURVEY_ADDENDUM.md`.
- **Automatable up to the human gates:** route, kind of business, Form A/B, uploads, tracking.
- **Needs a person:**
  - CAPTCHA: the FSM or ops operator;
  - OTPs, Aadhaar e-Sign, the final declaration and payment: the **business owner**;
  - authority queries: the FSM together with the owner.
- **Filing on someone's behalf is allowed only through a certified Food Safety Mitra** (Guidance FAQ Q10). The FSM's number goes on each application, and FSM charges are capped (₹100 per registration, ₹500 per licence filing). **Decide the FSM and pricing model with the expert.**
- **Document cross-check** (a post-check in our workflow, before the robot or an FSM files). For the chosen route, state and kinds of business, compare three lists and block filing on any gap:
  - what we collected;
  - what our graph requires (`graph.v2` `requires_doc`, the March 2021 order);
  - what FoSCoS actually asks for: its public document pages (`/document-required/SL`, `/document-required/CL`, the registration list) and, when the robot reaches it, the live upload step of the application, including state-specific "other documents".

  Check the live file limits (type; size 2/3/5 MB across sources, so trust the live page) at the same time.
- A logged-in look around the dashboard, drafts and the upload step, with a person solving the CAPTCHA, can wait (test credentials in `creds`, git-ignored).

## Intake automaton & layered answers

- **Bug (found converting the cache, 2026-09-25), fix before more real users:** `intake_answer_cache` stores the model's whole `facts` object. The model copies facts from the session's "Known facts so far" into it (for example, cached facts for "no but we have 3 outlets in goa" include `activities`, `place`, `implied` and `description: "I cook from home"` from that user's earlier answers). The cache key is question + options + text only, so **the next user who types the same text gets the previous user's facts merged into their application** (spurious conflicts, silent wrong fills, and a privacy leak). Fix: when caching, keep only the `choice` and the facts the text itself states (drop `description`, `implied`, `kob`, `importer`, and any key the prompt's known facts supplied). Or split the prompt so the model returns facts from the text alone. Then bump `PROMPT_VERSION` so existing entries are not reused.
- **Bug (found in the cache-fill pilot, 2026-09-25):** `normalizeText` in `src/lib/answerRules.js` keeps only `a-z0-9`, so any answer typed in Devanagari normalises to `""`. In the pilot, 38 of 41 Hindi-script answers became an empty cache key. Such answers never hit the cache (`interpretCheap` returns null on an empty key), and after a model call they are all stored under the same empty-text key for that question. Fix: keep Unicode letters and digits (`/[^\p{L}\p{M}\p{N}.'\s]/gu`), as `~/fssai-intake-lab/loop/records.mjs` does, and bump `PROMPT_VERSION` so old keys are not reused.

- Several premises (decided 2026-09-25): each extra premises is a new licensing task that runs the whole loop again, seeded with business-wide facts. A multi-state business also gets a Head Office task (`~/fssai-intake-lab/DESIGN.md` §11.4). Build it in the lab first.
- Kinds of business the workflow chart does not cover yet: exporters / merchant exporters, 100% EOUs, health supplements / nutraceuticals and other non-specified foods, and capacity thresholds (dairy, meat, oil). Add them as options or questions once the rules are confirmed; `scripts/check-intake.mjs` will show any path they break.
- Have an FSSAI expert review which premises are allowed per activity (`place` options): e.g. hub outlets only for cooking or retail, vehicles-only only for transporters.
- Promote learned answers into rules: review frequent `intake_answer_cache` entries (by `hits`) and add their phrases to `LEXICON` in `src/lib/answerRules.js`, so they need neither the cache nor the model. An admin page for this would help.
- The cache stores the normalised typed text; if users type personal details, consider not caching answers that contain names, numbers or addresses.
- Let the model help author consistency rules: the set of answer combinations is finite, so run the model once over the combinations `scripts/check-intake.mjs` produces, ask it to flag implausible ones, and review its suggestions as new `RULES` (then no model is needed at run time).

## Email relay (parked)

- Plan: send portal email through Brevo from the `deploy` machine (VPN 10.8.0.7; public IPv4 is on Brevo's allowed-IP list, IPv6 is not). `~/sendmail_brevo.py` there is rewritten to send one transactional email via Brevo's API, reading `BREVO_API_key` from `~/.profile` and forcing IPv4; the original is `~/sendmail_brevo.py.orig`.
- Status: a test code email to kaushpraj06@gmail.com was accepted by Brevo, but delivery has an issue, not yet investigated. The only verified Brevo sender is toystech.in@gmail.com. Sending "from" a Gmail address through Brevo often fails DMARC or lands in spam, so first check Brevo's transactional logs and verify a sender on our own domain.
- Next, once delivery works: run it as a relay API on deploy (VPN interface only, shared token, rate limit, systemd) and point `server/mailer.js` at it.
