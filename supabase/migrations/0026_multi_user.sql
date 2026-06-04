-- 0026 — Multi-user foundation (spec 026, Phase 1). ADDITIVE + non-breaking: new tables only.
-- The per-user `user_id` columns on workflow tables + RLS land in Phase 2 alongside the query
-- threading, so existing single-user behavior is untouched until auth is configured.

create table if not exists app_user (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  name       text,
  created_at timestamptz not null default now()
);

-- the legacy/system user: existing single-user data + the app with AUTH_ENABLED=off map here.
insert into app_user (id, email, name)
  values ('00000000-0000-0000-0000-000000000001', 'local@lot', 'Local (single-user)')
  on conflict (id) do nothing;

-- per-user connector tokens (Gmail / Google Calendar / enrichment). Tokens are stored ENCRYPTED
-- (CONNECTOR_SECRET) by the app — never plaintext. Nothing here sends; it's the credential store.
create table if not exists connector (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_user(id) on delete cascade,
  kind          text not null,                         -- gmail | gcal | enrichment
  access_token  text,                                  -- encrypted
  refresh_token text,                                  -- encrypted
  expires_at    timestamptz,
  status        text not null default 'disconnected',  -- disconnected | connected | error
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, kind)
);
drop trigger if exists connector_touch on connector;
create trigger connector_touch before update on connector
  for each row execute function set_updated_at();
