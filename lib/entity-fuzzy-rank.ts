import Fuse from "fuse.js"

import type { EntityOption } from "@/components/entity/types"

type Ranked = { opt: EntityOption; tier: number; fuseScore: number }

/**
 * Client-side ranking: exact label → substring label → fuzzy (Fuse) → alias/id match.
 */
export function rankEntityOptions(
  query: string,
  options: EntityOption[]
): EntityOption[] {
  const q = query.trim()
  if (!q) {
    return [...options]
  }

  const ql = q.toLowerCase()
  const direct: Ranked[] = []
  const seen = new Set<string>()

  for (const opt of options) {
    const ll = opt.label.toLowerCase()
    let tier: number | null = null
    if (ll === ql) {
      tier = 0
    } else if (ll.includes(ql)) {
      tier = 1
    } else {
      const als = opt.aliases ?? []
      if (
        als.some((a) => a.toLowerCase().includes(ql)) ||
        opt.id.toLowerCase().includes(ql)
      ) {
        tier = 3
      }
    }
    if (tier !== null) {
      direct.push({ opt, tier, fuseScore: 0 })
      seen.add(opt.id)
    }
  }

  const remainder = options.filter((o) => !seen.has(o.id))
  const fuse = new Fuse(remainder, {
    keys: [
      { name: "label", weight: 2 },
      { name: "id", weight: 0.5 },
      {
        name: "aliases",
        weight: 1,
        getFn: (item: EntityOption) => (item.aliases ?? []).join(" "),
      },
    ],
    threshold: 0.42,
    ignoreLocation: true,
    includeScore: true,
  })

  const fuzzyRanked: Ranked[] = fuse.search(q).map((r) => ({
    opt: r.item,
    tier: 2,
    fuseScore: r.score ?? 1,
  }))

  const merged = [...direct, ...fuzzyRanked]
  merged.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier
    }
    return a.fuseScore - b.fuseScore
  })

  return merged.map((m) => m.opt)
}
