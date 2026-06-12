/**
 * Wikipedia Tier-2 global connector — retrieves page evidence only.
 */

import type {
  ConnectorRetrieveInput,
  EvidenceDiagnostic,
  EvidenceItem,
} from "@/lib/ai/evidence-types";

const CONNECTOR_ID = "wikipedia-en";
const API_URL = "https://en.wikipedia.org/w/api.php";
const TIMEOUT_MS = 12_000;
const USER_AGENT = "RareeShowAdmin/1.0 (Source Connector D2-003)";

type WikiPage = {
  title?: string;
  extract?: string;
  fullurl?: string;
  missing?: string;
};

type WikiQueryResponse = {
  query?: {
    pages?: Record<string, WikiPage>;
  };
};

async function fetchWikiPage(
  titles: string,
  signal: AbortSignal
): Promise<{ page: WikiPage | null; error?: string }> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "extracts|info",
    exintro: "true",
    explaintext: "true",
    redirects: "1",
    titles,
    inprop: "url",
  });

  const res = await fetch(`${API_URL}?${params}`, {
    signal,
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    return { page: null, error: `Wikipedia HTTP ${res.status}` };
  }

  const json = (await res.json()) as WikiQueryResponse;
  const page = Object.values(json.query?.pages ?? {})[0] ?? null;

  if (!page || page.missing !== undefined || !page.extract?.trim()) {
    return { page: null };
  }

  return { page };
}

function titleCandidates(
  searchTerm: string,
  context: string | null | undefined
): string[] {
  const candidates = [searchTerm];
  if (context) {
    candidates.push(`${searchTerm} ${context}`);
  }
  return candidates;
}

export async function liveWikipediaRetrieve(
  input: ConnectorRetrieveInput
): Promise<{ items: EvidenceItem[]; diagnostics: EvidenceDiagnostic[] }> {
  const diagnostics: EvidenceDiagnostic[] = [];
  const searchTerm = input.scopeFieldValue.trim();
  const context = input.profile.wikipediaSearchContext?.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let resolved: WikiPage | null = null;

    for (const titles of titleCandidates(searchTerm, context)) {
      const { page, error } = await fetchWikiPage(titles, controller.signal);
      if (error) {
        diagnostics.push({
          connectorId: CONNECTOR_ID,
          code: error.includes("429") ? "RATE_LIMITED" : "UNAVAILABLE",
          message: error,
        });
        return { items: [], diagnostics };
      }
      if (page) {
        resolved = page;
        break;
      }
    }

    if (!resolved?.extract?.trim()) {
      diagnostics.push({
        connectorId: CONNECTOR_ID,
        code: "NO_MATCH",
        message: "No Wikipedia page resolved",
      });
      return { items: [], diagnostics };
    }

    if (resolved.title?.toLowerCase().includes("disambiguation")) {
      diagnostics.push({
        connectorId: CONNECTOR_ID,
        code: "NO_MATCH",
        message: "Disambiguation page rejected",
      });
      return { items: [], diagnostics };
    }

    const excerpt = resolved.extract.trim();
    const url =
      resolved.fullurl ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(resolved.title ?? searchTerm)}`;

    const item: EvidenceItem = {
      tier: 2,
      connectorId: CONNECTOR_ID,
      sourceRef: {
        tier: 2,
        label: `Wikipedia: ${resolved.title ?? searchTerm}`,
        url,
        excerpt: excerpt.slice(0, 2000),
      },
      excerpt: excerpt.slice(0, 4000),
      retrievedAt: new Date().toISOString(),
      matchConfidence: "medium",
    };

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
