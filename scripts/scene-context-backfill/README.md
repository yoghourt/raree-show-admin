# Scene Context historical backfill (IMPLEMENT-SCC-001-L3-B)

Additive backfill: `frame_provenance_v1` → `scene_contexts_v1`.

**Does not** write Route membership (columns dropped in L3-C).

## Prerequisites

- Migration `docs/supabase/migrations/20260808000000_scene_contexts_v1.sql` applied
- `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `SCENE_CONTEXT_WORK_ALLOWLIST` (required match unless `--force`)

## Usage

```bash
# Dry-run (default)
npx tsx scripts/scene-context-backfill/run.ts --workId=<work-uuid>

# Single route
npx tsx scripts/scene-context-backfill/run.ts --workId=<work-uuid> --routeTsid=scene_xxx

# Apply writes
npx tsx scripts/scene-context-backfill/run.ts --workId=<work-uuid> --apply
```
