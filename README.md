# FSSAI Online — Portal Frontend (mockup)

React + Vite + Tailwind SPA with a small Node API (auth, document upload/verification) backed by PostgreSQL.

## Run

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. `npm run build` produces a production bundle in `dist/`; `npm run preview` serves it locally.

## Notes

- Auth: email + password registration/login (`/api/auth/*`), scrypt salted hashes, server-side sessions in an HttpOnly cookie, failed-login throttling. No 2FA yet.
- Access: the server listens on the VPN interface only (`vite.config.js`) and accepts only the `fssai.photovault.live` host; HTTPS is terminated by Caddy on the VPN master, which must send `X-Forwarded-Proto: https`.
- Config: `config/database.json` (PostgreSQL + repo-relative `storageDir`), `config/llm-provider.json` (vision model), `config/document-types.json` (per-document questions).
- Application flow (`/dashboard/apply`, the first screen after login): photo-first (ID + electricity bill, read by the vision model to pre-fill details), then tap-first intake, licence summary, details, documents, auto-filled Form A/B, then ready for submission. Questions live in `src/lib/intakeQuestions.js`. Licence, form, field and document rules live in `src/lib/applicationPlan.js` (uses `eligibility.js`), and the same code runs on client and server. The LLM only turns free-text answers into facts or option ids.
- Intake automaton (`src/lib/intakeQuestions.js`): follows the workflow chart (`fssai_registration_flow_chart.png`). Each question declares when it is relevant, and its options depend on earlier answers (a manufacturer is never offered a street cart). Changing an answer runs `reconcile`, which clears later answers that no longer fit. `node scripts/check-intake.mjs` walks every tap path, including every "Just checking" branch (about 17,500) and fails on dead ends, loops, missing verdicts or forbidden combinations; add `--tree` to print the tree. Run it after any change to the questions or licence rules.
- Consistency arm (`RULES` in `src/lib/intakeQuestions.js`): *implied* answers are not asked (a home kitchen is one place); *unlikely* combinations (home kitchen or cart above ₹1.5 crore, carts in several states, a cart running a marketplace) raise a "Just checking" question to confirm or change; a typed answer that contradicts an earlier one becomes a conflict ("Earlier you said X, but that sounds like Y"), and one that only adds something asks "Should I add it?". Add a rule to `RULES`; the path checker then walks its branches too.
- Typed answers are read in layers (`server/intakeInterpreter.js`): (1) rules in `src/lib/answerRules.js` (phrase lexicon incl. Hinglish, money like "30k a month", state names), used only when they explain the whole answer; (2) the `intake_answer_cache` table, matched on the exact answer or on the same words in any order; (3) the model, whose result is cached. Bump `PROMPT_VERSION` when the prompt or fact schema changes. The landing chat calls the public `POST /api/intake/interpret`, which uses rules and cache only (never the model) and is limited to 30 requests per minute per IP.
- Dashboard: `/dashboard` sends a user with a completed application (status `ready`) to the Dashboard and everyone else to My Application. Nav: Dashboard, My Application, Premises, Document Vault, Support. All pages read the user's real application and documents. Support saves "Talk to an expert" requests in `support_requests` (topics in `src/lib/supportTopics.js`). Mock-data screens (AI Assistant, Notices, Registrations & Licences, Payments, old dashboard) are archived in `src/archive/`, and their old URLs redirect to the dashboard.
- Landing page: the hero chat runs the same tap-first questions and licence rules in the browser (no login, no model). Answers are kept in `localStorage` and replayed into the user's first application after sign-up; a typed answer is handed over and read by the model at that point. Services shown on the page are listed in `src/lib/services.js`.
- Documents are encrypted at rest (AES-256-GCM, `server/storageCrypto.js`) with the key in `config/secrets/storage.key` (mode 600). **Back that key up separately from `storage/`: without it no stored document can be read.** `node scripts/encrypt-storage.mjs` creates the key on first run and encrypts any plain files; it is safe to re-run.
- Password reset: "Forgot password?" on the sign-in page emails a single-use link valid for 30 minutes (only its hash is stored). Resetting signs the account out everywhere. Emails go through `server/mailer.js`: copy `config/mail.example.json` to `config/mail.json` with SMTP details to send them; until then they are kept in the `email_outbox` table (status `not_configured`) and nothing is delivered.
- Payments: the government fee is paid on the Payments page before an application is submitted. `config/payment.json` has `"mode": "test"`, a dummy checkout (UPI / card / net banking, with a switch to simulate a failure) where no money moves; `serviceFeeRupees` adds our fee if set. The server computes amounts and allows one successful payment per application.
- Security headers: CSP, anti-framing, no-sniff, referrer policy and HSTS are set in `vite.config.js` (pages) and `server/apiPlugin.js` (API).
- `./reset_all.sh` wipes all users, sessions, applications, documents and stored files.
- Eligibility logic lives in `src/lib/eligibility.js` and mirrors the FSSAI 2026 turnover-threshold flowchart (effective 1 April 2026), including street-vendor deemed registration and mandatory Central Licence overrides (importer / e-commerce / multi-state HO / airport-seaport-railway).
- Brand name/domain are placeholders — edit `src/lib/brand.js` to rename.
