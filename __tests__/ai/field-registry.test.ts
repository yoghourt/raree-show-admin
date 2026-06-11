/**
 * Unit tests — lib/ai/field-registry.ts
 *
 * Verifies:
 *   - AC-26: field routing derived purely from registry metadata
 *   - AC-27: adding a field to registry requires no routing code change
 *   - AC-29: asset fields always excluded (FC-03)
 *   - AC-15: scope fields absent from suggestable results
 *   - RT-INV-08: empty-field filter gate
 */

import { describe, it, expect } from "vitest";
import {
  FIELD_REGISTRY,
  getSuggestableFields,
  getEffectiveRoute,
  getClassification,
  getScopeFields,
  getAssetFields,
} from "@/lib/ai/field-registry";

// ---------------------------------------------------------------------------
// FIELD_REGISTRY shape assertions
// ---------------------------------------------------------------------------

describe("FIELD_REGISTRY — Appendix A completeness", () => {
  it("registers all three entity types", () => {
    expect(Object.keys(FIELD_REGISTRY)).toEqual(
      expect.arrayContaining(["character", "location", "scene"])
    );
  });

  it("character registry contains required fields with correct classification", () => {
    const charReg = FIELD_REGISTRY.character;
    expect(charReg["name"].classification).toBe("scope");
    expect(charReg["house"].classification).toBe("canonical");
    expect(charReg["description"].classification).toBe("narrative");
    expect(charReg["signatureQuote"].classification).toBe("narrative");
    expect(charReg["portraitUrl"].classification).toBe("asset");
  });

  it("location registry contains required fields with correct classification", () => {
    const locReg = FIELD_REGISTRY.location;
    expect(locReg["name"].classification).toBe("scope");
    expect(locReg["region"].classification).toBe("canonical");
    expect(locReg["description"].classification).toBe("narrative");
    expect(locReg["map_focus_x"].classification).toBe("asset");
    expect(locReg["map_focus_y"].classification).toBe("asset");
  });

  it("scene registry contains required fields with correct classification", () => {
    const sceneReg = FIELD_REGISTRY.scene;
    expect(sceneReg["chapter_title"].classification).toBe("scope");
    expect(sceneReg["chapter_number"].classification).toBe("canonical");
    expect(sceneReg["title"].classification).toBe("narrative");
    expect(sceneReg["summary"].classification).toBe("narrative");
    expect(sceneReg["story_images_v2"].classification).toBe("asset");
  });
});

// ---------------------------------------------------------------------------
// getEffectiveRoute — FC-03 asset always excluded
// ---------------------------------------------------------------------------

describe("getEffectiveRoute — FC-03 asset permanent exclusion", () => {
  it("excludes asset fields regardless of stored copilot_route", () => {
    // portraitUrl is asset — must always be excluded
    expect(getEffectiveRoute("character", "portraitUrl")).toBe("excluded");
    expect(getEffectiveRoute("location", "map_focus_x")).toBe("excluded");
    expect(getEffectiveRoute("location", "map_focus_y")).toBe("excluded");
    expect(getEffectiveRoute("scene", "story_images_v2")).toBe("excluded");
  });

  it("excludes scope fields", () => {
    expect(getEffectiveRoute("character", "name")).toBe("excluded");
    expect(getEffectiveRoute("location", "name")).toBe("excluded");
    expect(getEffectiveRoute("scene", "chapter_title")).toBe("excluded");
  });

  it("returns fact for canonical fields", () => {
    expect(getEffectiveRoute("character", "house")).toBe("fact");
    expect(getEffectiveRoute("location", "region")).toBe("fact");
    expect(getEffectiveRoute("scene", "chapter_number")).toBe("fact");
  });

  it("returns narrative for narrative fields", () => {
    expect(getEffectiveRoute("character", "description")).toBe("narrative");
    expect(getEffectiveRoute("character", "signatureQuote")).toBe("narrative");
    expect(getEffectiveRoute("location", "description")).toBe("narrative");
    expect(getEffectiveRoute("scene", "title")).toBe("narrative");
    expect(getEffectiveRoute("scene", "summary")).toBe("narrative");
  });

  it("returns excluded for unregistered fields (system fields)", () => {
    expect(getEffectiveRoute("character", "id")).toBe("excluded");
    expect(getEffectiveRoute("character", "tsid")).toBe("excluded");
    expect(getEffectiveRoute("character", "workId")).toBe("excluded");
    expect(getEffectiveRoute("character", "createdAt")).toBe("excluded");
  });
});

// ---------------------------------------------------------------------------
// getSuggestableFields — RT-INV-08, AC-15, AC-22, AC-29
// ---------------------------------------------------------------------------

describe("getSuggestableFields — empty-field filter gate", () => {
  it("returns only fact/narrative fields that are empty (AC-22)", () => {
    const formValues = {
      name: "Arya Stark",      // scope — must be excluded
      house: "",               // canonical/fact — empty → included
      description: "",         // narrative — empty → included
      signatureQuote: "",      // narrative — empty → included
      portraitUrl: "",         // asset — must be excluded even though empty
    };

    const result = getSuggestableFields("character", formValues);
    const fields = result.map((fr) => fr.field);

    expect(fields).toContain("house");
    expect(fields).toContain("description");
    expect(fields).toContain("signatureQuote");
    expect(fields).not.toContain("name");       // AC-15: scope excluded
    expect(fields).not.toContain("portraitUrl"); // AC-29: asset excluded
  });

  it("excludes fields with existing values (RT-INV-08)", () => {
    const formValues = {
      name: "Jon Snow",
      house: "Stark",            // has value — excluded
      description: "",           // empty — included
      signatureQuote: "Winter is coming",  // has value — excluded
      portraitUrl: "https://…",
    };

    const result = getSuggestableFields("character", formValues);
    const fields = result.map((fr) => fr.field);

    expect(fields).toContain("description");
    expect(fields).not.toContain("house");
    expect(fields).not.toContain("signatureQuote");
  });

  it("returns correct copilot_route per field", () => {
    const formValues = {
      house: "",
      description: "",
    };

    const result = getSuggestableFields("character", formValues);
    const houseEntry = result.find((fr) => fr.field === "house");
    const descEntry = result.find((fr) => fr.field === "description");

    expect(houseEntry?.copilot_route).toBe("fact");
    expect(descEntry?.copilot_route).toBe("narrative");
  });

  it("returns empty array when all fields are filled", () => {
    const formValues = {
      name: "Tyrion",
      house: "Lannister",
      description: "A Lannister",
      signatureQuote: "I drink and I know things",
      portraitUrl: "https://…",
    };

    const result = getSuggestableFields("character", formValues);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scope and Asset helper functions
// ---------------------------------------------------------------------------

describe("getScopeFields / getAssetFields", () => {
  it("getScopeFields returns only scope-classified fields", () => {
    const scope = getScopeFields("character");
    expect(scope).toContain("name");
    expect(scope).not.toContain("house");
    expect(scope).not.toContain("portraitUrl");
  });

  it("getAssetFields returns only asset-classified fields", () => {
    const assets = getAssetFields("character");
    expect(assets).toContain("portraitUrl");
    expect(assets).not.toContain("house");
    expect(assets).not.toContain("name");
  });

  it("location scope field is name", () => {
    expect(getScopeFields("location")).toContain("name");
  });

  it("scene scope field is chapter_title", () => {
    expect(getScopeFields("scene")).toContain("chapter_title");
  });
});

// ---------------------------------------------------------------------------
// getClassification — used for Narrative Regenerate eligibility (AC-26)
// ---------------------------------------------------------------------------

describe("getClassification — Narrative Regenerate eligibility (AC-26)", () => {
  it("returns narrative for narrative fields", () => {
    expect(getClassification("character", "description")).toBe("narrative");
    expect(getClassification("character", "signatureQuote")).toBe("narrative");
    expect(getClassification("location", "description")).toBe("narrative");
    expect(getClassification("scene", "title")).toBe("narrative");
    expect(getClassification("scene", "summary")).toBe("narrative");
  });

  it("returns canonical for canonical fields", () => {
    expect(getClassification("character", "house")).toBe("canonical");
    expect(getClassification("location", "region")).toBe("canonical");
    expect(getClassification("scene", "chapter_number")).toBe("canonical");
  });

  it("returns scope for scope fields", () => {
    expect(getClassification("character", "name")).toBe("scope");
    expect(getClassification("location", "name")).toBe("scope");
    expect(getClassification("scene", "chapter_title")).toBe("scope");
  });

  it("returns asset for asset fields", () => {
    expect(getClassification("character", "portraitUrl")).toBe("asset");
    expect(getClassification("location", "map_focus_x")).toBe("asset");
  });

  it("returns undefined for unregistered fields", () => {
    expect(getClassification("character", "unknownField")).toBeUndefined();
  });
});
