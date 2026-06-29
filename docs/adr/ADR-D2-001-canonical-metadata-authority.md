# ADR-D2-001 — Canonical Metadata Authority

**Status:** Accepted
**Type:** Architecture ADR
**Version:** 1.1
**Last Updated:** 2026-06-29
**Owner:** Architect
**Related ADR:** ADR-004 (Source of Canonical Truth — operative Human Acceptance and Enrichment Copilot); ADR-006 (Discovery Copilot Architecture — source extraction vs Discovery)
**Amendment:** Clarification only — A1 (ADR-001 supersession; operative authority ADR-004 Enrichment Copilot; Bootstrap prototype historical). No Decision changed.

**A1 Historical Note:** ADR-001 is **Superseded** by ADR-004. Operative enrichment
 and Human Acceptance semantics are governed by ADR-004. References to "LLM Bootstrap"
 as authority or immediate-persist catalog generation are **historical** (Option A
 assessment and pre-ADR-004 context). Tier 3 draft assistance and Enrichment outputs
 align with ADR-004 Copilot workflow, not ADR-001 Bootstrap architecture.

---

## What

This ADR establishes the authoritative source architecture for the three canonical
metadata layers required by Raree Show Runtime Truth v1:

```
Characters       — who appears in the work
Locations        — where the work takes place
Chapter Catalog  — the complete ordered chapter list
```

This ADR explicitly does **not** govern:

```
Scene generation
Portrait generation
Image caption generation
Scene image generation
```

Those remain within the **Enrichment Copilot** scope defined by **ADR-004**
 (descriptions, quotes, scene summaries, image captions). ADR-001 Bootstrap is
 **Superseded** — historical only.

---

## Why

### Evidence Chain

EAR-D2-013 through EAR-D2-015 form a complete evidence chain establishing that
LLM-generated metadata cannot serve as Runtime Truth:

**EAR-D2-013** — Scene-level recall unreliable.
Scene segmentation, chapter attribution, and event accuracy all fail at
production-required thresholds.

**EAR-D2-014** — Bootstrap prompt constraints structurally cap recall.
Characters and Locations suffer structural recall failure (~35–50%) due to
the `5–8 characters / 3–5 locations` hard limits. Chapter Catalog fails
for complex long-form works (73-chapter AGOT structure).

**EAR-D2-015** — Removing prompt constraints reveals a deeper knowledge problem.
Exhaustive recall improves recall to ~97% but drops precision to ~65–96%.
Root causes identified as non-fixable via prompt engineering:

1. **Training data fusion** — LLM knowledge merges source text, adaptations
   (films, series, games), and fan-created content. These cannot be
   cleanly separated at inference time.

2. **Book boundary instability** — For series works, the model cannot
   reliably distinguish characters appearing in Book 1 vs Book 2+.
   (AGOT → ACOK character contamination demonstrated.)

3. **Adaptation contamination** — Characters from film/TV adaptations
   are indistinguishable from source text characters.
   (Azog-in-The-Hobbit case: Peter Jackson character presented as
   Tolkien Book canon.)

4. **Chapter catalog degradation at scale** — 73-chapter POV-structured
   works exceed reliable model memory for exact count and interleaving
   order. Even the auditor-LLM could not reproduce the correct sequence
   without error.

### Runtime Truth Requirements

Raree Show Runtime Truth v1 requires:

```
Chapter Catalog → Progress Graph
               → Reading Progress
               → Scene Mapping
               → Narrative Navigation

Characters     → Scene Indexing
               → Character Arc Graph
               → Filter and Search

Locations      → Scene Indexing
               → Map Rendering
               → Navigation Graph
```

These downstream systems require:

```
Characters:  Precision = 100%, Recall ≥ 95%
Locations:   Precision = 100%, Recall ≥ 95%
Chapter:     Count = 100%, Title = 100%, Order = 100%
```

Any error in these layers propagates silently through all downstream consumers.

---

## Decision Candidates

### Option A — LLM Bootstrap as Authority Source

**Description:**
Use GPT / Claude / Gemini / DeepSeek output as the canonical source for
Characters, Locations, and Chapter Catalog.

**Assessment:**

```
Precision:                 65–96% (work-dependent)
Recall:                    35–97% (prompt-dependent)
Runtime Truth Compatible:  NO
Runtime Stability:         LOW (changes with model versions and sampling)
User Friction:             LOW
Engineering Complexity:    LOW (already implemented)
Runtime Cost:              LOW-MEDIUM ($0.001–0.01 per work)
Legal Risk:                LOW (factual extraction, no text reproduction)
Scalability:               HIGH (any work, any language)
```

**Failure modes (confirmed by EAR evidence):**

- Adaptation contamination is not detectable at inference time.
- Book boundary errors cannot be corrected without external ground truth.
- Chapter count/order errors degrade silently, not loudly.
- Precision cannot simultaneously reach 100% with recall ≥ 95% for any
  known prompt design.

**Verdict: REJECTED as Runtime Truth source.**

Option A remains valid for LLM Enrichment (descriptions, quotes, summaries,
image captions). It is not valid as a Canonical Metadata Authority.

---

### Option B — External Metadata API Sources

**Description:**
Use publicly available structured metadata APIs as the authority source.

**Candidate evaluation:**

#### Open Library API (openlibrary.org)
- **Chapter Catalog:** Available via `works/{OLID}/editions` and ToC fields.
  Coverage: ~60–75% for popular English-language works. ToC data quality varies.
  Many editions lack structured chapter lists.
- **Characters:** NOT available. Open Library is a bibliographic catalog, not
  a narrative database.
- **Locations:** NOT available.
- **Data Authority:** HIGH (library catalog, ISBN-linked, edition-specific).
- **API Stability:** HIGH (Internet Archive backed, CC0 licensed data).
- **Legal Risk:** NONE (CC0 bibliographic metadata).

#### Google Books API
- **Chapter Catalog:** Available via `volumes/{volumeId}` `tableOfContents`
  field for some editions. Coverage comparable to Open Library.
- **Characters:** NOT available.
- **Locations:** NOT available.
- **Data Authority:** HIGH for bibliographic data.
- **API Stability:** MEDIUM (Google may deprecate or rate-limit).
- **Legal Risk:** LOW (bibliographic metadata only).

#### ISBN Metadata (ISBNdb, Nielsen, etc.)
- **Chapter Catalog:** Rarely available. ISBNdb does not include ToC.
- **Characters / Locations:** NOT available.
- **Verdict:** Insufficient scope for this use case.

#### Wikipedia / Wikidata
- **Chapter Catalog:** Available via Wikidata `P747`/`P527` for some works.
  Coverage inconsistent. Many novels lack structured chapter data in Wikidata.
- **Characters:** Available for major works via fictional character entities
  (`Q3658341` pattern). Coverage: HIGH for blockbusters (HP, LOTR, ASOIAF),
  LOW for mid-tier works. Data quality: MEDIUM (structured but community-edited).
- **Locations:** Sparse. Most fictional locations lack dedicated Wikidata entries.
- **Data Authority:** MEDIUM. Wikidata is structured but editable by anyone.
  It is NOT an authoritative source — it is a community-maintained source.
- **Legal Risk:** CC BY-SA (attribution required).

#### Fandom Wiki
- **Chapter Catalog:** Available for major franchises.
- **Characters:** Comprehensive for major franchises.
- **Locations:** Available for major franchises.
- **Data Authority:** LOW. Fandom is explicitly community-maintained fan content.
  It cannot be treated as Runtime Truth. It can be used as enrichment reference only.
- **Legal Risk:** HIGH. Fandom content is CC BY-SA; scraping beyond stated
  terms of service creates legal exposure.

**⚠️ Critical Distinction:**

```
Authority Source     ≠     Community-maintained Source

Open Library, Google Books  →  Authority Source (bibliographic)
Wikidata                    →  Semi-authoritative (structured, editable)
Wikipedia, Fandom           →  Community-maintained (NOT Authority Source)

Fandom MUST NOT be used as Runtime Truth.
Fandom MAY be used as LLM enrichment input (non-canonical, non-indexed).
```

**Coverage Gap Assessment:**

```
Chapter Catalog:  ~60–75% coverage via Open Library / Google Books
                  Primarily English-language, popular works
                  Unknown for non-English or obscure titles

Characters:       ~0% via authoritative APIs
                  Wikidata: ~30–40% for blockbusters, ~5% for mid-tier

Locations:        ~0% via authoritative APIs
                  Wikidata: ~10–20% for major franchises only
```

Option B **cannot provide Characters or Locations** from any authoritative source
at production-useful coverage. It can provide Chapter Catalog for a subset of works.

**Assessment:**

```
Precision:                 HIGH for covered works, undefined for uncovered
Recall:                    HIGH for covered works, 0% for uncovered
Runtime Truth Compatible:  PARTIAL (Chapter Catalog only, limited coverage)
Runtime Stability:         MEDIUM-HIGH (API dependency)
User Friction:             LOW
Engineering Complexity:    MEDIUM (API integration, edition matching, fallback logic)
Runtime Cost:              LOW (API free tiers sufficient for most use cases)
Legal Risk:                LOW (bibliographic metadata CC0/open)
Scalability:               LOW-MEDIUM (coverage degrades for non-English/obscure works)
```

**Verdict: REJECTED as sole authority source.**

Option B MAY be used as a supplementary source for Chapter Catalog where coverage
exists. It cannot be the primary authority source for Characters and Locations.

---

### Option C — User-Supplied Source Extraction

**Description:**
User uploads the source file (EPUB / TXT / PDF / Markdown).
The runtime extracts Characters, Locations, and Chapter Catalog from the
actual text via NLP/NER pipeline.

**Technical basis:**

```
EPUB:  Structured spine defines chapter order exactly.
       NCX/Nav document provides chapter titles with 100% accuracy.
       No inference required.

TXT:   Regex / heuristic chapter detection.
       Accuracy depends on formatting consistency.

PDF:   PDF bookmarks (outline tree) provide chapter structure.
       Body text requires OCR pipeline for unstructured PDFs.

NER:   spaCy / LLM-assisted NER for character and location extraction
       from full text. Precision ~98%, Recall ~90–95% at chapter level.
```

**Assessment:**

```
Precision:                 ~99% (EPUB spine), ~95–98% (NER)
Recall:                    ~98% (EPUB chapters), ~90–95% (NER characters/locations)
Runtime Truth Compatible:  YES — source of truth is the actual published text
Runtime Stability:         HIGH (no external dependency once file is processed)
User Friction:             HIGH — user must supply and upload source file
Engineering Complexity:    HIGH — EPUB parser, PDF extractor, NER pipeline,
                           deduplication, canonical name resolution
Runtime Cost:              MEDIUM-HIGH — LLM-assisted NER for full novel
                           is $0.05–0.50 per work depending on length
Legal Risk:                HIGH — server-side storage of copyrighted content
                           creates reproduction liability.
                           File must be processed and discarded, not stored.
                           Processing itself may be defensible under fair use
                           in some jurisdictions, but not universally.
Scalability:               HIGH for works the user can provide.
                           Zero coverage for works the user cannot provide.
```

**Legal Risk Detail:**

```
Processing a user-uploaded copyrighted EPUB/PDF:

Risk 1: Server-side storage = reproduction
  Mitigation: Process in memory, never persist the source file.

Risk 2: Derivative works from extraction
  Mitigation: Extract structure only (titles, names) — not narrative text.
  Extracting chapter titles and character names from an index or spine
  is factual extraction, not creative reproduction. Strongest fair use argument.

Risk 3: User uploads content they do not own
  Mitigation: Terms of service requiring user to confirm ownership/license.
  Platform is not liable for user-submitted content under DMCA safe harbor.

Net assessment: Legal risk is MANAGEABLE with correct architecture.
  → Process in memory only
  → Never store source files
  → Extract structural metadata only (not narrative prose)
  → Terms of service user attestation
```

**Verdict: APPROVED as primary authority source for Runtime Truth v1.**

---

## Comparison Matrix

| Dimension | Option A — LLM Bootstrap | Option B — External APIs | Option C — User-Supplied |
|-----------|--------------------------|--------------------------|--------------------------|
| Precision | ~65–96% | ~95%+ (covered) / undefined (uncovered) | ~95–99% |
| Recall | ~35–97% | ~60–75% (chapters) / ~0% (chars/locs) | ~90–98% |
| Runtime Truth Compatible | ❌ NO | ⚠️ PARTIAL (chapters only) | ✅ YES |
| Runtime Stability | LOW (model drift) | MEDIUM-HIGH (API) | HIGH (file-based) |
| User Friction | LOW | LOW | HIGH |
| Engineering Complexity | LOW | MEDIUM | HIGH |
| Runtime Cost | LOW-MEDIUM | LOW | MEDIUM-HIGH |
| Legal Risk | LOW | LOW | MANAGEABLE (see detail) |
| Scalability | HIGH | LOW-MEDIUM | HIGH (user-dependent) |

---

## Decision

### APPROVED: Option C — User-Supplied Source Extraction as Primary Authority

with Option B as a supplementary Chapter Catalog source.

```
Runtime Truth v1 — Canonical Metadata Authority Architecture

┌──────────────────────────────────────────────────────────────────┐
│  Tier 1: User-Supplied Source (PRIMARY — Runtime Truth)          │
│                                                                  │
│  Input:  EPUB (preferred) / TXT / PDF                            │
│  Output: Chapter Catalog (from spine/NCX, exact)                 │
│          Characters (from NER pipeline, ~95-98%)                 │
│          Locations  (from NER pipeline, ~90-95%)                 │
│                                                                  │
│  Authority: Highest — derived from the actual published text     │
│  Legal:    Process-only, no storage, structural extraction only  │
└──────────────────────────────────────────────────────────────────┘
           ↑ user uploads → runtime extracts → discards file
           ↓ when Tier 1 not available

┌──────────────────────────────────────────────────────────────────┐
│  Tier 2: External Bibliographic API (SUPPLEMENTARY)              │
│                                                                  │
│  Source:  Open Library / Google Books                            │
│  Output:  Chapter Catalog ONLY (~60-75% coverage)               │
│           Characters: NOT available                              │
│           Locations:  NOT available                              │
│                                                                  │
│  Authority: High (library catalog)                               │
│  Used when: Tier 1 unavailable AND work is indexed               │
└──────────────────────────────────────────────────────────────────┘
           ↓ when neither Tier 1 nor Tier 2 available

┌──────────────────────────────────────────────────────────────────┐
│  Tier 3: Manual Entry (FALLBACK)                                 │
│                                                                  │
│  Admin manually enters Characters, Locations, Chapter Catalog    │
│  via existing admin CRUD screens.                                │
│  Enrichment Copilot (ADR-004) MAY assist as non-authoritative draft input.      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Enrichment Copilot (ADR-004) — Enrichment only (NOT Runtime Truth)       │
│                                                                  │
│  Uses: Canonical entity list from Tier 1/2/3 as input           │
│  Output: Descriptions, Quotes, Scene Summaries, Image Captions   │
│                                                                  │
│  Does NOT produce: Character names, Location names,              │
│                    Chapter titles, Counts, Ordering              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Rationale

### Why not Option A

Option A is the cheapest path but the EAR evidence chain is unambiguous:
LLM knowledge cannot satisfy `Precision = 100%` for any canonical metadata layer.
The failure is structural (training data fusion) and cannot be resolved by
prompt engineering. Accepting Option A as Runtime Truth means accepting
silent errors in Progress Graph, Scene Mapping, and Narrative Navigation.
The architectural cost of correcting those downstream errors exceeds the
cost of building Option C.

### Why not Option B alone

Option B has two hard limitations:

1. **Characters and Locations are not available** from any authoritative public API.
   Only Fandom-class community wikis have this data, and Fandom is explicitly
   disqualified as an authority source.

2. **Chapter Catalog coverage is ~60–75%**, meaning 25–40% of works on the
   platform would have no canonical chapter data and would fall back to non-Tier-1
   draft assistance — which is exactly the failure case this ADR exists to prevent.

Option B is retained as a Tier 2 supplementary source for Chapter Catalog
where indexed editions are available, reducing user friction for covered works.

### Why Option C

Option C is the only path that:

1. Has a clear, reproducible precision/recall ceiling approaching 100%.
2. Derives from the actual published text, not from knowledge approximations.
3. Scales to any work in any language regardless of external API coverage.
4. Has manageable legal exposure under process-only, no-storage architecture.

The primary cost is user friction (file upload) and engineering complexity
(EPUB/NER pipeline). These are acceptable costs given the alternatives.

---

## Implementation Constraints

### What this ADR mandates

1. Chapter Catalog MUST be derived from Tier 1 (EPUB spine/NCX) or Tier 2
   (bibliographic API) before Enrichment Copilot may use it as context.

2. Characters and Locations obtained via non-Tier-1 draft assistance MUST be flagged as
   `source: "llm_draft"` and require human confirmation before being treated
   as Runtime Truth until Tier 1 NER pipeline is implemented.

3. The Enrichment suggest pipeline (ADR-004 / SPEC-D2-002) remains valid for narrative
   field enrichment (descriptions, quotes, scene summaries). It MUST NOT be used as the
   source of canonical entity names or chapter titles.

4. Source files MUST NOT be persisted server-side. EPUB/TXT/PDF processing
   must be entirely in-memory with no intermediate storage.

5. Fandom and fan wikis MUST NOT be used as structured data sources for any
   canonical metadata layer.

### What this ADR does not mandate

This ADR does not mandate a specific implementation timeline for the
Tier 1 NER pipeline. Until the pipeline is implemented:

- Tier 3 manual entry with optional draft assistance remains the operative mechanism.
- Human confirmation per ADR-004 Decision 2 is the quality gate.
- The system operates in a pre-Runtime-Truth state.

This ADR establishes the architectural direction. The transition from
pre-Runtime-Truth to Runtime Truth v1 occurs when the Tier 1 pipeline ships.

---

## Consequences

### Positive

- Runtime Truth v1 will have a clear, achievable accuracy path.
- Downstream systems (Progress Graph, Scene Mapping) can trust canonical metadata.
- Legal exposure is bounded and manageable.
- The architecture scales to any language and any work.

### Negative

- User friction increases. Users must supply source files for Tier 1 accuracy.
- Engineering complexity increases. EPUB parser + NER pipeline is non-trivial.
- Not all users will have or be able to supply source files.
  These users remain on Tier 3 manual entry with optional draft assistance indefinitely.

### Neutral

- Enrichment Copilot (ADR-004) retains the enrichment role previously described as
  LLM Bootstrap Enrichment Layer — a better-fit use of LLM capabilities for narrative fields.
- Open Library / Google Books integration adds moderate engineering work
  for partial Chapter Catalog coverage improvement.

---

## Evidence References

```
EAR-D2-013  Scene-level recall evaluation
EAR-D2-014  Bootstrap prompt constraint analysis
EAR-D2-015  LLM knowledge ceiling audit
ADR-001     Assisted Work Bootstrap Pipeline (Superseded — historical)
ADR-004     Source of Canonical Truth (operative Human Acceptance and Enrichment)
ADR-006     Discovery Copilot Architecture (Discovery vs Tier extraction)
```

---

## Supersedes / Modifies

ADR-001 is **Superseded** by ADR-004. The following amendment block is retained
 for audit continuity only.

This ADR modifies the scope of ADR-001:

> ADR-001, Section "Input Boundary":
> "No external source material is introduced."
>
> ADR-D2-001 amendment:
> External source material (EPUB/TXT/PDF) MAY be introduced for
> Canonical Metadata extraction ONLY.
> Source material extraction is a separate pipeline. Operative enrichment and
> Human Acceptance are governed by ADR-004, not ADR-001 Bootstrap architecture.
