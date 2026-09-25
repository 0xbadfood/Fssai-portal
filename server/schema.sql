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
