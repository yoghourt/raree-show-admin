/**
 * AWOIAF Tier-1 connector — retrieves page evidence via MediaWiki API (no field extraction).
 */

import type {
  ConnectorRetrieveInput,
  EvidenceDiagnostic,
  EvidenceItem,
} from "@/lib/ai/evidence-types";

const CONNECTOR_ID = "awoiaf";
const TIMEOUT_MS = 12_000;
/** MediaWiki API etiquette — no cookie/CF bypass (Architect Ruling D2-003). */
const USER_AGENT =
  "RareeShowAdmin/1.0 (https://github.com/raree-show-admin; Source Connector D2-003) mediawiki-api-request";

function articleTitle(scopeFieldValue: string): string {
  return scopeFieldValue.trim().replace(/ /g, "_");
}

function isCloudflareChallenge(body: string): boolean {
  return (
    body.includes("Just a moment") ||
    body.includes("cf-challenge") ||
    body.includes("challenges.cloudflare.com")
  );
}

function buildFetchHeaders(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

/** Pull character infobox wikitext block for normalize-evidence. */
export function extractInfoboxWikitextExcerpt(wikitext: string): string {
  const start = wikitext.search(/\{\{Infobox/i);
  if (start === -1) {
    return wikitext.slice(0, 4000).trim();
  }
  return wikitext.slice(start, start + 8000).trim();
}

type MwRevision = {
  slots?: { main?: { "*"?: string } };
  "*"?: string;
};

type MwPage = {
  title?: string;
  missing?: string;
  fullurl?: string;
  revisions?: MwRevision[];
};

type MwQueryResponse = {
  query?: {
    pages?: Record<string, MwPage>;
  };
};

/** MediaWiki 1.32+ slots vs legacy revisions[0]['*']. */
export function getRevisionWikitext(revision: MwRevision | undefined): string {
  if (!revision) return "";
  const fromSlots = revision.slots?.main?.["*"]?.trim();
  if (fromSlots) return fromSlots;
  return revision["*"]?.trim() ?? "";
}

async function fetchMwQuery(
  apiUrl: string,
  signal: AbortSignal,
  fetchHeaders: Record<string, string>
): Promise<
  | { ok: true; json: MwQueryResponse }
  | { ok: false; reason: string; code: EvidenceDiagnostic["code"] }
> {
  const res = await fetch(apiUrl, {
    signal,
    headers: fetchHeaders,
  });
  const rawBody = await res.text();

  if (!res.ok) {
    const cfNote =
      res.status === 403
        ? " — validate Tier-1 live in Staging/Production (§8.2); local 403 is not an architectural defect"
        : "";
    return {
      ok: false,
      code: res.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE",
      reason: `AWOIAF API HTTP ${res.status}${cfNote}`,
    };
  }

  if (isCloudflareChallenge(rawBody)) {
    return {
      ok: false,
      code: "UNAVAILABLE",
      reason:
        "AWOIAF blocked by Cloudflare — use SOURCE_CONNECTOR_MODE=mock locally or validate live Tier-1 in Staging",
    };
  }

  try {
    return { ok: true, json: JSON.parse(rawBody) as MwQueryResponse };
  } catch {
    return {
      ok: false,
      code: "PARSE_ERROR",
      reason: "AWOIAF API returned non-JSON",
    };
  }
}

function pageFromResponse(json: MwQueryResponse): MwPage | null {
  const pages = json.query?.pages ?? {};
  return Object.values(pages)[0] ?? null;
}

async function resolveAwoiafPage(
  base: string,
  title: string,
  signal: AbortSignal
): Promise<
  | { page: MwPage; wikitext: string }
  | { error: EvidenceDiagnostic }
> {
  const fetchHeaders = buildFetchHeaders();
  const common = {
    action: "query",
    format: "json",
    titles: title,
    redirects: "1",
    prop: "revisions|info",
    rvprop: "content",
    inprop: "url",
  };

  // Modern MediaWiki (slots)
  const slotsParams = new URLSearchParams({
    ...common,
    rvslots: "main",
  });
  const slotsResult = await fetchMwQuery(
    `${base}/api.php?${slotsParams}`,
    signal,
    fetchHeaders
  );
  if (!slotsResult.ok) {
    return {
      error: {
        connectorId: CONNECTOR_ID,
        code: slotsResult.code,
        message: slotsResult.reason,
      },
    };
  }

  let page = pageFromResponse(slotsResult.json);
  let wikitext = getRevisionWikitext(page?.revisions?.[0]);

  // Legacy API (no rvslots) — some installs return content only here
  if (page && !page.missing && !wikitext) {
    const legacyParams = new URLSearchParams(common);
    const legacyResult = await fetchMwQuery(
      `${base}/api.php?${legacyParams}`,
      signal,
      fetchHeaders
    );
    if (legacyResult.ok) {
      const legacyPage = pageFromResponse(legacyResult.json);
      const legacyText = getRevisionWikitext(legacyPage?.revisions?.[0]);
      if (legacyText) {
        page = legacyPage ?? page;
        wikitext = legacyText;
      }
    }
  }

  if (!page || page.missing !== undefined) {
    return {
      error: {
        connectorId: CONNECTOR_ID,
        code: "NO_MATCH",
        message: `No AWOIAF article for title "${title}"`,
      },
    };
  }

  if (!wikitext) {
    return {
      error: {
        connectorId: CONNECTOR_ID,
        code: "NO_MATCH",
        message: "AWOIAF article has no wikitext in API response",
      },
    };
  }

  return { page, wikitext };
}

export async function liveAwoiafRetrieve(
  input: ConnectorRetrieveInput
): Promise<{ items: EvidenceItem[]; diagnostics: EvidenceDiagnostic[] }> {
  const diagnostics: EvidenceDiagnostic[] = [];
  const title = articleTitle(input.scopeFieldValue);
  const base = input.baseUrl.replace(/\/$/, "");
  const pageUrl = `${base}/index.php/${encodeURIComponent(title)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resolved = await resolveAwoiafPage(base, title, controller.signal);
    if ("error" in resolved) {
      diagnostics.push(resolved.error);
      if (process.env.SOURCE_CONNECTOR_DEBUG === "1") {
        console.warn("[awoiaf]", resolved.error.message);
      }
      return { items: [], diagnostics };
    }

    const { page, wikitext } = resolved;

    if (page.title?.toLowerCase().includes("disambiguation")) {
      diagnostics.push({
        connectorId: CONNECTOR_ID,
        code: "NO_MATCH",
        message: "Disambiguation page rejected",
      });
      return { items: [], diagnostics };
    }

    const excerpt = extractInfoboxWikitextExcerpt(wikitext);
    const url = page.fullurl ?? pageUrl;

    const item: EvidenceItem = {
      tier: 1,
      connectorId: CONNECTOR_ID,
      sourceRef: {
        tier: 1,
        label: input.profile.displayName
          ? `${input.profile.displayName} — AWOIAF`
          : "A Wiki of Ice and Fire",
        url,
        excerpt: excerpt.slice(0, 2000),
      },
      excerpt: excerpt.slice(0, 4000),
      retrievedAt: new Date().toISOString(),
      matchConfidence: "high",
    };

    if (process.env.SOURCE_CONNECTOR_DEBUG === "1") {
      console.info("[awoiaf] matched", {
        title: page.title,
        excerptLen: excerpt.length,
      });
    }

    return { items: [item], diagnostics };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    diagnostics.push({
      connectorId: CONNECTOR_ID,
      code: message.includes("abort") ? "TIMEOUT" : "UNAVAILABLE",
      message,
    });
    return { items: [], diagnostics };
  } finally {
    clearTimeout(timer);
  }
}
