/**
 * Deterministic text helpers for the Granularity Gate.
 * Cross-script (zh heading vs en title) matching is intentionally NOT claimed.
 */

const EN_STOP = new Set(
  [
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "at",
    "for",
    "from",
    "with",
    "after",
    "before",
    "then",
    "than",
    "this",
    "that",
    "their",
    "they",
    "his",
    "her",
    "its",
    "into",
    "upon",
    "over",
    "under",
    "as",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "has",
    "had",
    "have",
    "does",
    "did",
    "do",
    "not",
    "no",
    "but",
    "however",
    "when",
    "where",
    "who",
    "whom",
    "which",
    "while",
    "during",
    "against",
    "between",
    "among",
    "through",
    "about",
    "into",
    "only",
    "also",
    "new",
    "first",
    "major",
    "newly",
    "formed",
    "official",
    "imperial",
  ].map((w) => w.toLowerCase())
);

export function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const HEADING_LINE_PATTERN =
  "^\\s*(\\d+)\\s*[.、.)．]\\s*(?:\\*\\*)?([^\\n*]+?)(?:\\*\\*)?\\s*$";

export function headingBlocksFromSource(
  sourceText: string
): Array<{ index: number; title: string; body: string }> {
  const re = new RegExp(HEADING_LINE_PATTERN, "gm");
  const matches = [...sourceText.matchAll(re)];
  const seen = new Set<number>();
  const blocks: Array<{ index: number; title: string; body: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const index = Number(m[1]);
    const title = normalizeWs(m[2] ?? "");
    if (!title || !Number.isFinite(index) || seen.has(index)) continue;
    seen.add(index);
    const start = (m.index ?? 0) + m[0].length;
    const end = matches[i + 1]?.index ?? sourceText.length;
    blocks.push({
      index,
      title,
      body: sourceText.slice(start, end).trim(),
    });
  }
  return blocks.sort((a, b) => a.index - b.index);
}

export function extractHeadings(
  sourceText: string
): Array<{ index: number; title: string }> {
  return headingBlocksFromSource(sourceText).map(({ index, title }) => ({
    index,
    title,
  }));
}

export function splitSentences(text: string): string[] {
  return normalizeWs(text)
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function contentTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
  return raw.filter((t) => t.length >= 2 && !EN_STOP.has(t));
}

export function tokenSet(text: string): Set<string> {
  return new Set(contentTokens(text));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** English-like proper-name spans: "Liu Bei", "Mount Daxing", "Yellow Turbans". */
export function extractProperNames(text: string): string[] {
  const names = new Set<string>();
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1]!.trim();
    if (EN_STOP.has(name.split(/\s+/)[0]!.toLowerCase()) && !name.includes(" ")) {
      continue;
    }
    if (name.length < 3) continue;
    names.add(name);
  }
  return [...names];
}

export function coverageRatio(needle: string, haystack: string): number {
  const n = tokenSet(needle);
  const h = tokenSet(haystack);
  if (n.size === 0) return 1;
  let hit = 0;
  for (const t of n) if (h.has(t)) hit += 1;
  return hit / n.size;
}
