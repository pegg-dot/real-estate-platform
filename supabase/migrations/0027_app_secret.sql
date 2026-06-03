-- 0027 — app_secret (spec 027): tiny server-side key/value store for hashed secrets.
-- First use: the operator's command-runner passcode (scrypt hash, never plaintext). Additive.
create table if not exists app_secret (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
