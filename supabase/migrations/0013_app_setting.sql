-- Migration 0013 — app_setting: a tiny key/value store for app-level prefs (spec 005/006).
-- Powers the "auto-refresh when stale" automation: a weekly data update fires on app load if the
-- data is older than a week — so Nate never has to remember to run anything.
begin;

create table app_setting (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- default: auto-refresh ON (it'll update weekly whenever the app is opened)
insert into app_setting (key, value) values ('auto_refresh', '{"enabled": true}')
  on conflict (key) do nothing;

commit;
