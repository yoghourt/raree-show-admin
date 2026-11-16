/**
 * Unit tests — Wikipedia connector title order and context rejection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SourceProfile } from "@/lib/ai/evidence-types";
import { liveWikipediaRetrieve } from "@/lib/ai/connectors/wikipedia-connector";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const asoiafProfile: SourceProfile = {
  profileId: "asoiaf-profile",
  kind: "public_franchise",
  displayName: "ASOIAF",
  workPattern: "asoiaf",
  wikipediaSearchContext: "A Song of Ice and Fire",
  tier2Enabled: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function wikiResponse(page: Record<string, unknown> | null) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      query: {
        pages: {
          "1": page ?? { missing: "" },
        },
      },
    }),
  };
}

function requestedTitle(url: string): string {
  return new URL(url).searchParams.get("titles") ?? "";
}

describe("liveWikipediaRetrieve", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("rejects a same-name page whose lead does not mention the search context", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const title = requestedTitle(url);
      if (title === "The Wall A Song of Ice and Fire") {
        return wikiResponse(null);
      }
      if (title === "The Wall") {
        return wikiResponse({
          title: "The Wall",
          extract:
            "The Wall is the eleventh studio album by the English rock band Pink Floyd.",
          fullurl: "https://en.wikipedia.org/wiki/The_Wall",
        });
      }
      throw new Error(`unexpected title ${title}`);
    });

    const result = await liveWikipediaRetrieve({
      entityType: "location",
      scopeFieldValue: "The Wall",
      profile: asoiafProfile,
      connectorId: "wikipedia-en",
      baseUrl: "https://en.wikipedia.org",
    });

    expect(mockFetch.mock.calls.map((call) => requestedTitle(String(call[0])))).toEqual([
      "The Wall A Song of Ice and Fire",
      "The Wall",
    ]);
    expect(result.items).toHaveLength(0);
    expect(result.diagnostics[0]?.code).toBe("NO_MATCH");
    expect(result.diagnostics[0]?.message).toBe(
      "Wikipedia page did not match search context"
    );
  });

  it("accepts a bare title when the lead mentions the search context", async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const title = requestedTitle(url);
      if (title === "Bran Stark A Song of Ice and Fire") {
        return wikiResponse(null);
      }
      if (title === "Bran Stark") {
        return wikiResponse({
          title: "Bran Stark",
          extract:
            "Brandon Stark is a fictional character in the A Song of Ice and Fire series of fantasy novels.",
          fullurl: "https://en.wikipedia.org/wiki/Bran_Stark",
        });
      }
      throw new Error(`unexpected title ${title}`);
    });

    const result = await liveWikipediaRetrieve({
      entityType: "character",
      scopeFieldValue: "Bran Stark",
      profile: asoiafProfile,
      connectorId: "wikipedia-en",
      baseUrl: "https://en.wikipedia.org",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sourceRef.label).toBe("Wikipedia: Bran Stark");
    expect(result.diagnostics).toHaveLength(0);
  });

  it("keeps the bare-title hit when no search context is set", async () => {
    mockFetch.mockResolvedValue(
      wikiResponse({
        title: "The Wall",
        extract: "The Wall is the eleventh studio album by Pink Floyd.",
        fullurl: "https://en.wikipedia.org/wiki/The_Wall",
      })
    );

    const result = await liveWikipediaRetrieve({
      entityType: "location",
      scopeFieldValue: "The Wall",
      profile: { ...asoiafProfile, wikipediaSearchContext: null },
      connectorId: "wikipedia-en",
      baseUrl: "https://en.wikipedia.org",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(requestedTitle(String(mockFetch.mock.calls[0]?.[0]))).toBe("The Wall");
    expect(result.items).toHaveLength(1);
  });
});
