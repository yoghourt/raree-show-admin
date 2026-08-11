/**
 * Match Discovery character/location candidates against existing work catalog.
 */

export function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findExistingByName<T extends { name: string; tsid: string }>(
  name: string,
  catalog: T[]
): T | undefined {
  const key = normalizeEntityName(name);
  if (!key) return undefined;
  return catalog.find((item) => normalizeEntityName(item.name) === key);
}

/** Placeholder Expression environments that are not real place cues. */
export function isPlaceholderEnvironment(environment: string): boolean {
  const key = normalizeEntityName(environment);
  return !key || key === "unspecified place";
}

/**
 * Match a Discovery environment cue to Work Archive locations.
 * Exact name first; else longest archive name contained in (or containing) the cue.
 * Example: "Winterfell courtyard, snow" → Winterfell.
 */
export function findLocationByEnvironmentCue<
  T extends { name: string; tsid: string },
>(environment: string, catalog: T[]): T | undefined {
  if (isPlaceholderEnvironment(environment)) return undefined;
  const exact = findExistingByName(environment, catalog);
  if (exact) return exact;

  const envKey = normalizeEntityName(environment);
  let best: T | undefined;
  let bestLen = 0;
  for (const item of catalog) {
    const nameKey = normalizeEntityName(item.name);
    // Avoid matching single-char noise; archive place names are usually ≥2.
    if (nameKey.length < 2) continue;
    if (envKey.includes(nameKey) || nameKey.includes(envKey)) {
      if (nameKey.length > bestLen) {
        best = item;
        bestLen = nameKey.length;
      }
    }
  }
  return best;
}
