# IMPLEMENT-SCC-001 — Level 3 Route Ownership Sunset (Deferred)

**Status:** **Not authorized** · Bookkeeping only  
**Date:** 2026-08-08  
**Prerequisite:** L2-A / L2-B stable in production-adjacent use · separate Architect ADR/SPEC sequence

---

## Intent (future only)

```text
Retire Reading Route as a carrier of narrative character/location ownership.
```

Includes (when authorized):

* Remove or null-authority `scenes.character_ids` / `scenes.location_id`  
* Historical migration / backfill into Scene Context where needed  
* Optional Context addressing (requires its own ADR — not implied here)  
* Broad Admin IA centered on Context  

---

## Explicit non-authorization

```text
❌ Not granted by Option A / SCC-S1 / L2-A Prepared
❌ Must not be smuggled into Level 2 slices
❌ Must not delete Route columns under L2-A allowlist
```

---

## Why deferred

ADR-012 and SPEC-SCC-001 freeze ownership semantics first.  
SCC-S1 proves Context can sit on delivery.  
L2-A (when granted) stops new pollution.  
Physical sunset of legacy Route fields is a **migration program**, not a contract fix.

---

## Refs

```text
docs/spikes/adr-012-batch-attach-pollution-resolution.md
docs/spikes/implement-scc-001-l2a-context-ownership-authority.md
docs/adr/012-scene-context-runtime-boundary.md
```
