-- Migration 0020 — dedupe distilled concepts (spec 016 code-review).
-- storeArtifacts routes a 'concept' artifact to knowledge_note; without a unique key, an updated
-- concept inserted a duplicate row every re-ingest. Add a unique index on (title, source) so the
-- on-conflict upsert works. Distilled concepts always carry a non-null title + source; legacy
-- null-title KB notes are unaffected (NULLs are distinct in a unique index).

create unique index if not exists knowledge_note_title_source_uidx
  on knowledge_note (title, source);
