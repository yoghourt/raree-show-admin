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
