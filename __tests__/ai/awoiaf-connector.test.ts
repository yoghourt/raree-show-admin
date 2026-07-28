/**
 * Unit tests — AWOIAF connector helpers
 */

import { describe, it, expect } from "vitest";
import {
  extractEntityContextExcerpt,
  extractInfoboxWikitextExcerpt,
  getRevisionWikitext,
  wikiTitleCandidates,
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

describe("extractEntityContextExcerpt", () => {
  it("includes lead prose after Infobox for narrative grounding", () => {
    const text = `{{Infobox character
|House=[[House Royce]]
|Allegiance=[[Night's Watch]]
}}

'''Waymar Royce''' is a knight of House Royce who joined the Night's Watch.

==History==
He was killed by the Others.
`;
    const excerpt = extractEntityContextExcerpt(text);
    expect(excerpt).toContain("House Royce");
    expect(excerpt).toContain("Night's Watch");
    expect(excerpt).toContain("joined the Night's Watch");
  });
});

describe("wikiTitleCandidates", () => {
  it("strips Ser/Lord honorifics for AWOIAF titles", () => {
    expect(wikiTitleCandidates("Ser Waymar Royce")).toEqual([
      "Waymar_Royce",
      "Ser_Waymar_Royce",
    ]);
    expect(wikiTitleCandidates("Lord Eddard Stark")[0]).toBe("Eddard_Stark");
  });
});
