/**
 * Unit tests — AWOIAF connector helpers
 */

import { describe, it, expect } from "vitest";
import {
  extractInfoboxWikitextExcerpt,
  getRevisionWikitext,
} from "@/lib/ai/connectors/awoiaf-connector";

describe("getRevisionWikitext", () => {
  it("reads slots.main format", () => {
    expect(
      getRevisionWikitext({
        slots: { main: { "*": "|House=[[House Stark]]" } },
      })
    ).toBe("|House=[[House Stark]]");
  });

  it("reads legacy revisions[*] format", () => {
    expect(
      getRevisionWikitext({
        "*": "{{Infobox character|House=Stark}}",
      })
    ).toBe("{{Infobox character|House=Stark}}");
  });
});

describe("extractInfoboxWikitextExcerpt", () => {
  it("slices infobox block", () => {
    const text = "Lead\n{{Infobox character|Name=Arya|House=Stark}}\nMore";
    expect(extractInfoboxWikitextExcerpt(text)).toContain("Infobox character");
  });
});
