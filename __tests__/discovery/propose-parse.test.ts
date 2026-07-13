/**
 * Unit tests — propose LLM output parsing
 */

import { describe, it, expect } from "vitest";

import { normalizeRawCandidate } from "@/lib/discovery/candidate-validate";
import { parseCandidateArray } from "@/lib/discovery/propose-parse";

describe("parseCandidateArray", () => {
  it("parses candidates wrapper object", () => {
    const raw = `{"candidates":[{"displayName":"Arya","summary":"s","fields":{"name":"Arya"}}]}`;
    const items = parseCandidateArray(raw, "character");
    expect(items).toHaveLength(1);
  });

  it("parses markdown-fenced JSON", () => {
    const raw =
      '```json\n{"candidates":[{"displayName":"Winterfell","summary":"s","fields":{"name":"Winterfell"}}]}\n```';
    const items = parseCandidateArray(raw, "location");
    expect(items).toHaveLength(1);
  });

  it("parses type-keyed object from model", () => {
    const raw = `{"characters":[{"displayName":"Robb","summary":"s","fields":{"name":"Robb"}}]}`;
    const items = parseCandidateArray(raw, "character");
    expect(items).toHaveLength(1);
  });

  it("parses single scene object under scenes key", () => {
    const raw = `{"scenes":{"displayName":"Courtyard","summary":"s","fields":{"parentStoryCandidateId":"story-1","chapter_number":1,"title":"Courtyard","summary":"x"}}}`;
    const items = parseCandidateArray(raw, "scene");
    expect(items).toHaveLength(1);
  });

  it("parses scene items without fields wrapper", () => {
    const raw = `{"candidates":[{"displayName":"Feast","summary":"s","parentStoryCandidateId":"story-1","chapter_number":2,"chapter_title":"Catelyn I","title":"The Feast","summary":"Banquet scene."}]}`;
    const items = parseCandidateArray(raw, "scene");
    expect(items).toHaveLength(1);
  });

  it("parses legacy readingRoute key as scene alias", () => {
    const raw = `{"readingRoute":[{"displayName":"Courtyard","summary":"s","fields":{"parentStoryCandidateId":"story-1","chapter_number":1,"title":"Courtyard"}}]}`;
    const items = parseCandidateArray(raw, "scene");
    expect(items).toHaveLength(1);
  });

  it("parses nested data.candidates", () => {
    const raw = `{"data":{"candidates":[{"displayName":"Winterfell","summary":"s","fields":{"name":"Winterfell"}}]}}`;
    const items = parseCandidateArray(raw, "location");
    expect(items).toHaveLength(1);
  });

  it("parses location places string array", () => {
    const raw = `{"places":["临冬城","国王大道"]}`;
    const items = parseCandidateArray(raw, "location");
    expect(items).toHaveLength(2);
  });

  it("returns empty array when model finds nothing", () => {
    const raw = `{"candidates":[]}`;
    const items = parseCandidateArray(raw, "location");
    expect(items).toHaveLength(0);
  });

  it("parses location with place_name alias", () => {
    const raw = `{"candidates":[{"displayName":"Woods","summary":"s","fields":{"place_name":"Woods outside Winterfell"}}]}`;
    const items = parseCandidateArray(raw, "location");
    expect(items).toHaveLength(1);
  });

  it("parses story candidates wrapper", () => {
    const raw = `{"candidates":[{"displayName":"The Royal Visit","summary":"Editorial unit.","fields":{"title":"The Royal Visit","summary":"Prose summary."}}]}`;
    const items = parseCandidateArray(raw, "story");
    expect(items).toHaveLength(1);
  });

  it("parses story_units keyed array", () => {
    const raw = `{"story_units":[{"story_title":"The Royal Visit","story_summary":"Editorial unit covering the royal arrival."}]}`;
    const items = parseCandidateArray(raw, "story");
    expect(items).toHaveLength(1);
  });

  it("parses stories array with nested story object", () => {
    const raw = `{"stories":[{"story":{"title":"The Royal Visit","summary":"Editorial unit."}}]}`;
    const items = parseCandidateArray(raw, "story");
    expect(items).toHaveLength(1);
  });

  it("parses flat story object without candidates wrapper", () => {
    const raw = `{"title":"The Royal Visit","summary":"Editorial unit.","boundaryHint":"Arrival through feast."}`;
    const items = parseCandidateArray(raw, "story");
    expect(items).toHaveLength(1);
  });

  it("parses singular candidate key for story", () => {
    const raw = `{"candidate":{"displayName":"The Royal Visit","summary":"s","fields":{"title":"The Royal Visit","summary":"Editorial unit."}}}`;
    const items = parseCandidateArray(raw, "story");
    expect(items).toHaveLength(1);
  });
});

describe("dedupeCandidates", () => {
  it("removes duplicate names within a type", async () => {
    const { dedupeCandidates } = await import("@/lib/discovery/candidate-validate");
    const duped = [
      {
        candidateId: "1",
        candidateType: "character" as const,
        workId: "w",
        displayName: "Eddard Stark",
        summary: "a",
        fields: { name: "Eddard Stark" },
      },
      {
        candidateId: "2",
        candidateType: "character" as const,
        workId: "w",
        displayName: "Eddard Stark",
        summary: "b",
        fields: { name: "Eddard Stark" },
      },
    ];
    expect(dedupeCandidates(duped)).toHaveLength(1);
  });
});

describe("normalizeRawCandidate optional fields", () => {
  it("ignores invalid confidence instead of rejecting", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Arya Stark",
        summary: "Young Stark.",
        confidence: "high",
        fields: { name: "Arya Stark" },
      },
      "character",
      "work-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidate.confidence).toBeUndefined();
    }
  });

  it("normalizes story_title and story_summary aliases", () => {
    const result = normalizeRawCandidate(
      {
        story_title: "The Royal Visit",
        story_summary: "Editorial unit covering the royal arrival.",
      },
      "story",
      "work-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidate.displayName).toBe("The Royal Visit");
      expect(result.candidate.fields).toMatchObject({
        title: "The Royal Visit",
        summary: "Editorial unit covering the royal arrival.",
      });
    }
  });
});
