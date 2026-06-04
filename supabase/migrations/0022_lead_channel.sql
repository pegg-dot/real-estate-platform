-- Migration 0022 — channel router output on the lead (spec 015 Part A wiring).
-- routeChannel picks the approach (DTS/DTA/DTR) + method (mail/call/text/door) per lead; persist
-- them so the Leads view can group by channel and the funnel can attribute cost by method.

alter table lead
  add column if not exists approach text,   -- DTS | DTA | DTR
  add column if not exists method   text;   -- mail | call | text | door
