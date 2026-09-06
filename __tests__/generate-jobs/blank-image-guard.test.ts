import { describe, expect, it } from "vitest";

import {
  assessBlankFromLumaSamples,
  assessBlankImageBuffer,
} from "@/lib/ai/image/blankImageGuard";
import { Z_IMAGE_TURBO_CAPABILITY } from "@/lib/ai/image/rendererCapability";
import {
  buildAvatarNegativePrompt,
  buildAvatarPrompt,
  detectGenderCue,
  scrubConflictingGenderTokens,
  AVATAR_NEGATIVE_PROMPT,
} from "@/lib/prompts/avatar";

describe("buildAvatarPrompt", () => {
  it("keeps a short Local-friendly prompt without blank-canvas filler in positive", () => {
    const prompt = buildAvatarPrompt("Jean", "tall soldier");
    expect(prompt).toMatch(/Jean/);
    expect(prompt).toMatch(/tall soldier/);
    expect(prompt.toLowerCase()).not.toMatch(/plain empty/);
    expect(prompt.toLowerCase()).not.toMatch(/seamless backdrop/);
    expect(prompt.toLowerCase()).not.toMatch(/not a blank canvas/);
    expect(prompt.length).toBeLessThan(400);
  });

  it("promotes operator revision and scrubs Lady from subject when male", () => {
    const prompt = buildAvatarPrompt(
      "Gared",
      "Gared holds the title of Lady and is a member of House Stark.\n\n[操作员修改意见] 性别不对，他是个男的。"
    );
    const overrideIdx = prompt.indexOf("OPERATOR OVERRIDE");
    expect(overrideIdx).toBeGreaterThanOrEqual(0);
    expect(prompt).toMatch(/Male character portrait of Gared/i);
    expect(prompt).toMatch(/adult male man/i);
    expect(prompt.toLowerCase()).not.toMatch(/\blady\b/);
    expect(prompt).toMatch(/House Stark/);
  });

  it("asks for waist-up body and costume, not a lone floating head", () => {
    const prompt = buildAvatarPrompt("Jean", "tall soldier");
    expect(prompt).toMatch(/waist-up/i);
    expect(prompt).toMatch(/costume visible/i);
    expect(prompt.toLowerCase()).not.toMatch(/one head, one neck/);
    expect(prompt.toLowerCase()).not.toMatch(/head-and-shoulders bust/);
  });

  it("promotes CRITICAL visual identity before biographical subject", () => {
    const prompt = buildAvatarPrompt(
      "Guan Yu",
      "Sworn brother of Liu Bei.\n\n[视觉身份] FACE: red face, long beard. COSTUME: green battle robe. PROP: Green Dragon Crescent Blade."
    );
    const criticalIdx = prompt.indexOf("CRITICAL visual identity");
    const appearanceIdx = prompt.indexOf("red face");
    const bioIdx = prompt.indexOf("Sworn brother");
    expect(prompt).toContain("CRITICAL visual identity");
    expect(criticalIdx).toBeGreaterThanOrEqual(0);
    expect(appearanceIdx).toBeGreaterThan(criticalIdx);
    expect(bioIdx).toBeGreaterThan(appearanceIdx);
  });

  it("keeps PROP when visual identity is overlong and SUMMARY-first", () => {
    const prompt = buildAvatarPrompt(
      "Cao Cao",
      `Chancellor of Wei.\n\n[视觉身份] SUMMARY: astute young military commander of Wei, pragmatic and sharp-eyed, extra court politics filler.
FACE: determined sharp eyes, chiseled jawline, neat dark hair tied back in a high topknot, subtle natural skin texture with pores.
COSTUME: functional dark leather and steel-plated lamellar shoulder guards over a deep green military tunic, practical bronze-trimmed belt.
PROP: rolled military strategy bamboo scroll held in hand.
STYLE: semi-realistic digital painting, textured painterly brushwork, cinematic character concept art.`
    );
    expect(prompt).toMatch(/bamboo|scroll/i);
    expect(prompt).toMatch(/COSTUME:/);
    const critical = prompt.slice(
      prompt.indexOf("CRITICAL visual identity"),
      prompt.indexOf("Character portrait")
    );
    expect(critical.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.appearanceMaxChars + 80
    );
  });

  it("truncates long biographical description", () => {
    const longBio = `${"He served the realm for many years. ".repeat(20)}ENDMARK`;
    const prompt = buildAvatarPrompt("Ned", longBio);
    expect(prompt).not.toMatch(/ENDMARK/);
    expect(prompt).toMatch(/…/);
  });

  it("injects work convention before visual identity", () => {
    const prompt = buildAvatarPrompt(
      "Will",
      "[视觉身份]\nFACE: pale. COSTUME: black wool cloak.",
      "ERA: medieval wool. FORBID: modern military, olive drab."
    );
    expect(prompt).toMatch(/medieval wool/);
    expect(prompt).not.toMatch(/Work look/);
    expect(prompt).not.toMatch(/olive drab/);
    expect(prompt.indexOf("medieval wool")).toBeLessThan(
      prompt.indexOf("CRITICAL visual identity")
    );
    expect(prompt).toMatch(/black wool cloak/);
  });
});

describe("scrubConflictingGenderTokens", () => {
  it("removes Lady when cue is male", () => {
    expect(
      scrubConflictingGenderTokens("Lady of House Stark", "male")
    ).not.toMatch(/lady/i);
  });
});

describe("detectGenderCue", () => {
  it("reads Chinese male correction", () => {
    expect(detectGenderCue("性别不对，他是个男的。")).toBe("male");
  });
});

describe("buildAvatarNegativePrompt", () => {
  it("adds female rejects when revision asserts male", () => {
    const neg = buildAvatarNegativePrompt(
      "Lady of House Stark\n\n[操作员修改意见] 他是个男的"
    );
    expect(neg).toMatch(/woman/);
    expect(neg).toMatch(/lady/);
  });

  it("adds appearance-driven rejects for red face and crescent weapons", () => {
    const neg = buildAvatarNegativePrompt(
      "Bio\n\n[视觉身份] FACE: red face, long beard. PROP: Green Dragon Crescent Blade."
    );
    expect(neg).toMatch(/pale face/);
    expect(neg).toMatch(/western straight sword/);
    expect(neg).toMatch(/clean shaven/);
  });
});

describe("AVATAR_NEGATIVE_PROMPT", () => {
  it("includes blank-canvas rejects", () => {
    expect(AVATAR_NEGATIVE_PROMPT).toMatch(/blank canvas/);
    expect(AVATAR_NEGATIVE_PROMPT).toMatch(/solid white/);
  });

  it("rejects floating-head crops", () => {
    expect(AVATAR_NEGATIVE_PROMPT).toMatch(/floating head/);
    expect(AVATAR_NEGATIVE_PROMPT).toMatch(/head only/);
    expect(AVATAR_NEGATIVE_PROMPT).toMatch(/cropped at neck/);
  });
});

describe("assessBlankFromLumaSamples", () => {
  it("flags near-white flat canvases", () => {
    const samples = Uint8Array.from({ length: 64 * 64 }, () => 250);
    const a = assessBlankFromLumaSamples(samples, 64, 64);
    expect(a.blank).toBe(true);
    expect(a.reason).toBe("near_white_flat");
  });

  it("flags near-black flat canvases", () => {
    const samples = Uint8Array.from({ length: 64 * 64 }, () => 5);
    const a = assessBlankFromLumaSamples(samples, 64, 64);
    expect(a.blank).toBe(true);
    expect(a.reason).toBe("near_black_flat");
  });

  it("passes varied content", () => {
    const samples = Uint8Array.from({ length: 64 * 64 }, (_, i) =>
      i % 2 === 0 ? 40 : 200
    );
    const a = assessBlankFromLumaSamples(samples, 64, 64);
    expect(a.blank).toBe(false);
  });

  it("skips tiny stubs", () => {
    const samples = Uint8Array.from([255]);
    const a = assessBlankFromLumaSamples(samples, 1, 1);
    expect(a.blank).toBe(false);
    expect(a.reason).toBe("skipped_tiny");
  });
});

describe("assessBlankImageBuffer", () => {
  it("rejects a solid white png", async () => {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const a = await assessBlankImageBuffer(bytes);
    expect(a.blank).toBe(true);
    expect(a.reason).toBe("near_white_flat");
  });

  it("accepts a high-contrast png", async () => {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 30, g: 30, b: 30 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 64,
              height: 64,
              channels: 3,
              background: { r: 220, g: 180, b: 140 },
            },
          })
            .png()
            .toBuffer(),
          left: 32,
          top: 32,
        },
      ])
      .png()
      .toBuffer();

    const a = await assessBlankImageBuffer(bytes);
    expect(a.blank).toBe(false);
  });
});
