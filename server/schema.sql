CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,          -- stored lower-case
  password_hash  text NOT NULL,                 -- scrypt$N$r$p$salt$hash (per-user random salt)
  name           text NOT NULL,
  business_name  text NOT NULL,
  phone          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

-- Session cookie holds a random token; only its SHA-256 is stored here.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- One row per upload. The current document for a (user, type) is the row with superseded_at IS NULL.
CREATE TABLE IF NOT EXISTS documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_ref  text,
  doc_type_id      text NOT NULL,
  status           text NOT NULL CHECK (status IN ('accepted', 'review', 'rejected')),
  file_name        text NOT NULL,
  mime             text NOT NULL,
  size_bytes       integer NOT NULL,
  storage_path     text NOT NULL,          -- relative to the repo root, e.g. storage/documents/<user>/<id>.jpg
  sha256           text NOT NULL,
  model            text,
  quality_score    integer,
  verification     jsonb,
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  superseded_at    timestamptz
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS preview_path text;   -- JPEG snapshot (first page for PDFs)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS documents_current_uq ON documents (user_id, doc_type_id) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id, uploaded_at DESC);

-- A guided application. facts = intake answers, info = Form A/B details. Documents are per user (see documents).
CREATE TABLE IF NOT EXISTS applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  step        text NOT NULL DEFAULT 'intake',
  facts       jsonb NOT NULL DEFAULT '{}',
  info        jsonb NOT NULL DEFAULT '{}',
  transcript  jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  ready_at    timestamptz
);
CREATE INDEX IF NOT EXISTS applications_user_idx ON applications (user_id, created_at DESC);

-- Layered intake interpreter: model interpretations of typed answers, reused when the same answer comes again.
-- key = prompt version + question + offered options + normalised text; token_sig matches reworded duplicates.
CREATE TABLE IF NOT EXISTS intake_answer_cache (
  key          text PRIMARY KEY,
  question_id  text NOT NULL,
  options_sig  text NOT NULL,
  text_norm    text NOT NULL,
  token_sig    text NOT NULL,
  result       jsonb NOT NULL,             -- { choice: [...], facts: {...}, reply }
  model        text,
  hits         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_hit_at  timestamptz
);
CREATE INDEX IF NOT EXISTS intake_answer_cache_sig_idx ON intake_answer_cache (question_id, options_sig, token_sig);

-- "Talk to an expert" requests from the dashboard Support page. The operations team works them from here.
CREATE TABLE IF NOT EXISTS support_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic         text NOT NULL,
  message       text NOT NULL,
  contact_via   text NOT NULL DEFAULT 'call',
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requests_user_idx ON support_requests (user_id, created_at DESC);

-- Password reset links: only the SHA-256 of the token is stored; single use, short-lived.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id, created_at DESC);

-- Every email the portal sends. The body is kept only until it is sent (it can contain a reset link).
CREATE TABLE IF NOT EXISTS email_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email    text NOT NULL,
  subject     text NOT NULL,
  body_text   text,
  status      text NOT NULL CHECK (status IN ('sent', 'failed', 'not_configured')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

-- Payments. mode 'test' = the dummy checkout (no money moves). Amounts in paise.
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  purpose         text NOT NULL DEFAULT 'govt_fee',
  items           jsonb NOT NULL,
  amount_paise    integer NOT NULL CHECK (amount_paise >= 0),
  currency        text NOT NULL DEFAULT 'INR',
  method          text NOT NULL,
  status          text NOT NULL CHECK (status IN ('paid', 'failed')),
  mode            text NOT NULL DEFAULT 'test',
  reference       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_paid_uq ON payments (application_id, purpose) WHERE status = 'paid';

-- Intake graph version an application was answered under (config/intake/graph.v<N>.json). An application from
-- an older version starts its intake again on the current one.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS graph_version integer;

-- Landing-page intake chat before sign-up. The id is a random token held by the browser; the first
-- application after sign-up takes over the answers (claimed_by), so nothing is asked twice.
CREATE TABLE IF NOT EXISTS intake_sessions (
  id             text PRIMARY KEY,
  facts          jsonb NOT NULL DEFAULT '{}',
  transcript     jsonb NOT NULL DEFAULT '[]',
  graph_version  integer NOT NULL,
  ip             text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  claimed_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at     timestamptz
);

-- Review log for the intake: typed answers and how they were read, the silent reviewer's answers,
-- "Is this right?" ratings, errors. Text is redacted (phone, email, Aadhaar, PAN) before it is stored.
CREATE TABLE IF NOT EXISTS intake_events (
  id              bigserial PRIMARY KEY,
  at              timestamptz NOT NULL DEFAULT now(),
  kind            text NOT NULL,
  application_id  uuid,
  session_id      text,
  step            text,
  text            text,
  detail          jsonb
);
CREATE INDEX IF NOT EXISTS intake_events_at_idx ON intake_events (at DESC);

-- Roles: customers sign up on the site; ops team members and the admin are created on the CLI
-- (scripts/ops.mjs). A deactivated account can't sign in and its sessions stop working.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (role IN ('customer', 'ops', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A password-protected PDF is stored as uploaded (the password is never stored); ops asks for it when filing.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pdf_encrypted boolean NOT NULL DEFAULT false;

-- Operations: one case per paid application, worked by the ops team.
CREATE TABLE IF NOT EXISTS cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'new',
  assignee_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  arn             text,              -- FoSCoS application reference number, once filed
  licence_number  text,
  session_at      timestamptz,       -- the filing session with the customer
  session_link    text,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE cases ADD CONSTRAINT cases_status_chk CHECK (status IN
    ('new', 'in_review', 'needs_customer', 'ready_to_file', 'session_scheduled', 'filed', 'with_fssai', 'granted', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases (status, opened_at DESC);

-- Everything that happens to a case, including who opened which document: the audit log and the timeline.
CREATE TABLE IF NOT EXISTS case_events (
  id        bigserial PRIMARY KEY,
  case_id   uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  at        timestamptz NOT NULL DEFAULT now(),
  actor_id  uuid REFERENCES users(id) ON DELETE SET NULL,   -- null: the system or the customer
  kind      text NOT NULL,
  detail    jsonb
);
CREATE INDEX IF NOT EXISTS case_events_case_idx ON case_events (case_id, at);

-- Applications paid before cases existed get one (idempotent).
INSERT INTO cases (application_id, user_id, opened_at)
  SELECT p.application_id, p.user_id, min(p.created_at) FROM payments p WHERE p.status = 'paid' GROUP BY p.application_id, p.user_id
  ON CONFLICT (application_id) DO NOTHING;

-- Case track: 'filing' (paid applications); 'expert' comes with the expert workflow (TODO.md).
ALTER TABLE cases ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'filing';

-- Ops review of a document, on top of the AI check: 'approved' or 'rejected' (with a note for the customer).
-- It overrides the AI either way. A new upload is a new row, so it starts unreviewed.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ops_status text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ops_note text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ops_reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ops_reviewed_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL;  -- set when ops uploaded it

-- Expert role (2026-09-27): works expert-service orders; created on the CLI like ops accounts.
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_chk;
  ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (role IN ('customer', 'ops', 'admin', 'expert'));
END $$;

-- Expert services (config/services.json): a customer buys a service or asks for a quote. Paid orders and
-- quote requests appear in the expert queue; only experts take them. amount_due is what the customer
-- still has to pay (the purchase itself, an expert's quote, or a top-up), GST included, in paise.
CREATE TABLE IF NOT EXISTS service_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref               text NOT NULL UNIQUE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id        text NOT NULL,
  service_name      text NOT NULL,
  section_id        text,
  kind              text NOT NULL CHECK (kind IN ('buy', 'quote')),
  quantity          integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 50),
  unit              text,
  brief             text,
  status            text NOT NULL CHECK (status IN
                      ('awaiting_payment', 'quote_requested', 'quoted', 'new', 'in_progress', 'awaiting_customer', 'completed', 'cancelled')),
  amount_due_paise  integer CHECK (amount_due_paise IS NULL OR amount_due_paise > 0),
  due_items         jsonb,
  due_kind          text,        -- 'purchase' | 'quote' | 'topup'
  due_note          text,
  assignee_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  paid_at           timestamptz, -- first payment
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_orders_user_idx ON service_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_orders_status_idx ON service_orders (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS order_events (
  id        bigserial PRIMARY KEY,
  order_id  uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  at        timestamptz NOT NULL DEFAULT now(),
  actor_id  uuid REFERENCES users(id) ON DELETE SET NULL,   -- null: the system or the customer
  kind      text NOT NULL,
  detail    jsonb
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, at);

-- Payments can be for an application (government fee) or an expert-service order.
ALTER TABLE payments ALTER COLUMN application_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE;
DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT payments_target_chk CHECK (application_id IS NOT NULL OR order_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Checkouts sent to the payment gateway (Cashfree). One row per gateway order: what it was for, the amount we
-- asked for, and how it ended. A payment row is written only when the gateway confirms the money (return page
-- or signed webhook, both re-checked with the gateway's API).
CREATE TABLE IF NOT EXISTS gateway_orders (
  id              text PRIMARY KEY,                 -- our order_id at the gateway (MFL-...)
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  uuid REFERENCES applications(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES service_orders(id) ON DELETE CASCADE,
  items           jsonb NOT NULL,
  amount_paise    integer NOT NULL CHECK (amount_paise > 0),
  mode            text NOT NULL,                    -- 'sandbox' | 'live'
  status          text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'expired')),
  session_id      text,
  payment_id      uuid REFERENCES payments(id) ON DELETE SET NULL,
  gateway_payment jsonb,                            -- the gateway's payment record (ids, method, bank reference)
  note            text,                             -- e.g. paid twice: refund needed
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gateway_orders_target_chk CHECK ((application_id IS NULL) <> (order_id IS NULL))
);
CREATE INDEX IF NOT EXISTS gateway_orders_user_idx ON gateway_orders (user_id, created_at DESC);

-- The FoSCoS checklist of a case: the file the ops team will upload to each FoSCoS document slot (FoSCoS takes one
-- file per slot), or the slot marked not applicable. slot = the graph's document id (config/intake/documents.json).
-- Files are stored encrypted like documents; source_document_id is set when the customer's own copy was used.
CREATE TABLE IF NOT EXISTS case_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  slot                text NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('file', 'na')),
  note                text,                             -- why not applicable, or a note on the file
  file_name           text,
  mime                text,
  size_bytes          integer,
  storage_path        text,
  sha256              text,
  source_document_id  uuid REFERENCES documents(id) ON DELETE SET NULL,
  added_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at            timestamptz NOT NULL DEFAULT now(),
  superseded_at       timestamptz,
  CONSTRAINT case_files_file_chk CHECK (kind = 'na' OR storage_path IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS case_files_current_uq ON case_files (case_id, slot) WHERE superseded_at IS NULL;
