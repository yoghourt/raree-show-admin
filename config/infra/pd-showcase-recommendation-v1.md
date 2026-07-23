# Public Domain Showcase Recommendation v1

**Status:** Authorized recommendation (Deployment / Content)  
**Path:** `config/infra/pd-showcase-recommendation-v1.md`  
**Authority:** Architect · ROI Decision Package v1  
**Date:** 2026-07-19  
**Constraint:** Canon **subset** only — **no full-text ingest** in this phase  
**Policy:** ADR-010 Content Track 1 · GoT **not** a public showcase dataset

---

## Objective

Select Raree Show’s first formal **public** showcase dataset to:

* eliminate public IP risk (vs protected franchise IP)  
* maximize portfolio / interview value  
* produce Runtime Evidence quickly via a high-value canon subset  

---

## Evaluation Criteria (1–5)

| Criterion | Meaning |
| --------- | ------- |
| Legal Safety | Public-domain posture; pin-able text edition; low derivative ambiguity |
| Portfolio Value | International interviewer recognizability; story worth telling in 30s |
| AI Demonstration Value | Stresses discovery, ensemble, long-arc structure, consistency knobs |
| Visual Demonstration Value | Memorable characters/places/scenes; gen-AI “screenshot wow”; identity diversity |
| Engineering Cost | Effort to stand up a **subset** (not full novel) — **lower score = harder** |

Scoring note: **Engineering Cost is inverted in the numeric column** (5 = cheapest / fastest subset).  
Composite = equal weight mean of the five scores (replaceable weighting later).

---

## Candidates

1. Les Misérables  
2. Romance of the Three Kingdoms（《三国演义》）  
3. Pride and Prejudice  
4. Sherlock Holmes (selected short stories)  
5. Journey to the West（《西游记》） — supplemental candidate  

---

## Evaluation Matrix

| Work | Legal | Portfolio | AI Demo | Visual | Eng (ease) | Composite | Rank |
| ---- | ----:| --------:| ------:| -----:| ---------:| --------:| ---:|
| **Les Misérables** | 5 | 5 | 5 | 4 | 3 | **4.4** | **1** |
| **Romance of the Three Kingdoms** | 5 | 3 | 5 | 5 | 3 | **4.2** | **2** |
| Journey to the West | 5 | 3 | 4 | 5 | 3 | **4.0** | 3 |
| Pride and Prejudice | 5 | 5 | 3 | 2 | 5 | **4.0** | 4 |
| Sherlock Holmes (shorts) | 5 | 4 | 2 | 3 | 5 | **3.8** | 5 |

### Scoring rationale (summary)

**Les Misérables**  
* Legal: English PD translations widely available (pin Gutenberg / equivalent).  
* Portfolio: Near-universal Western recognition; serious literary brand.  
* AI Demo: Large ensemble, class geography, multi-arc (Valjean / Javert / barricade).  
* Visual: Strong set-pieces (prison, Paris streets, barricade, Cosette); slightly less “armor epic” flash than 三国.  
* Eng: Medium — need curated cast/locs/scenes; full text deferred.

**Romance of the Three Kingdoms**  
* Legal: Chinese original PD; pin a specific edition.  
* Portfolio: Weaker instant recognition for many international interviewers; excellent for CN/Asia.  
* AI Demo: Faction graph, generals, geography — peak structural demo.  
* Visual: **Highest** — armor, banners, distinct faces, landscapes.  
* Eng: Medium for subset; dangerous if scope expands to “full epic.”

**Pride and Prejudice**  
* Legal / Portfolio: Excellent.  
* AI / Visual: Social interiors and balls tend to **homogenize** under gen-AI; weak Image Runtime first showcase.  
* Eng: Easiest subset — but wrong primary for visual product narrative.

**Sherlock Holmes**  
* Fast vertical slice; limited ensemble / long-arc stress → poor Mission fit as *first* formal showcase.

**Journey to the West**  
* Visual/AI strong; portfolio overlap with 三国 for international audiences; keep as replaceable alternate, not v1 primary.

---

## Ranking

1. **Les Misérables** — international primary showcase  
2. **Romance of the Three Kingdoms** — visual / Chinese / complexity co-track  
3. Journey to the West — alternate visual PD  
4. Pride and Prejudice — text/relations MVP only (not image-first)  
5. Sherlock Holmes — technical slice only  

---

## Recommended Showcase (v1)

| Role | Work | Locale posture |
| ---- | ---- | -------------- |
| **Public primary (international)** | **Les Misérables** | English PD translation **pinned** in Deployment |
| **Public co-track (visual / ZH)** | **Romance of the Three Kingdoms** | Chinese original edition **pinned** |
| **Not public default** | Game of Thrones / ASOIAF | Track 2 internal only (if retained at all) |

**Why this pair:** Portfolio + AI Demo favor Les Mis as the story you *tell*; Visual Demo favors 三国 as the images you *show*. Engineering stays bounded via **canon subsets** on both.

---

## Canon Subset Proposal (no full-text ingest)

### Track L — Les Misérables (primary)

**Pinned text source (Deployment):** Project Gutenberg English text of *Les Misérables* (Hugo; Wilbour or equivalent PD translation — record exact edition URL/hash when ingested).

| Entity type | Count | Proposed members (editable) |
| ----------- | ----:| --------------------------- |
| Characters | 8 | Jean Valjean, Javert, Fantine, Cosette, Marius, Éponine, Thenardier, Enjolras |
| Locations | 6 | Digne, Toulon (bagne), Paris — Gorbeau, Rue Plumet, Barricade (Chanel / Corinth), Petit-Picpus |
| Showcase scenes | 8–10 | Candlesticks mercy; Fantine’s fall; Cosette in the wood; Javert’s pursuit; Barricade night; Sewers; Javert’s leap; Wedding garden (optional) |
| Portrait accepts | ≤ 24 | 8 characters × up to 3 consistent variants |
| Scene frames | ≤ 20 | 2 frames × ~10 scenes max |

**Out of scope v1:** full chapter catalog, all revolutionary students, complete convent arc.

### Track T — Three Kingdoms (visual co-track)

**Pinned text source (Deployment):** A single PD 《三国演义》 edition (record publisher/year or digital hash).

| Entity type | Count | Proposed members (editable) |
| ----------- | ----:| --------------------------- |
| Characters | 8 | 刘备, 关羽, 张飞, 诸葛亮, 曹操, 周瑜, 貂蝉, 吕布 |
| Locations | 6 | 桃园, 虎牢关, 隆中, 赤壁, 许昌, 成都 |
| Showcase scenes | 8–10 | 桃园结义; 三英战吕布; 三顾茅庐; 草船借箭; 赤壁火攻; 过五关 (optional single gate); 空城计 |
| Portrait accepts | ≤ 24 | same budget shape as Track L |
| Scene frames | ≤ 20 | same |

**Out of scope v1:** full 120 chapters, complete roster, map of all provinces.

### Shared Runtime Evidence goals

Both subsets should exercise:

* Work → characters / locations / scenes graph  
* Image Port draft → accept + `reference_strategy` on 3+ characters  
* Public-safe asset permanence (no Track 2 franchise art)  

---

## Explicit non-goals (this phase)

* Full novel ingest / embedding backfill of entire text  
* Replacing cloud image Production Default  
* Publishing GoT-derived assets publicly  
* Schema changes for “house” or Westeros-specific fields  

---

## Follow-ups (new decisions if needed)

1. Operator pins exact PD edition URLs in Deployment env/docs.  
2. Replace GOT-flavored **test fixtures** with Les Mis / 三国 names (engineering hygiene; separate small PR).  
3. Optional: P&P as a *non-image* onboarding tutorial work later.

---

## Decision Freeze (content)

| Item | Status |
| ---- | ------ |
| Public Domain as formal showcase route | **Frozen** |
| GoT as public showcase | **Rejected** |
| v1 primary + visual co-track | **Les Misérables + Three Kingdoms subsets** |
| Full-text ingest | **Not authorized** this phase |
