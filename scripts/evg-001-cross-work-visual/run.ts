/**
 * EVG-001 — Cross-work visual experience validation.
 *
 * Same Archive → Expression → Execution Projection → prompt path for
 * Romance of the Three Kingdoms and ASOIAF. No per-work style retuning.
 *
 * R3: Local only. Cloud fallback is disabled. Blank images are recorded
 * as blanks (one Local retry), never as FLUX evidence.
 *
 *   npx tsx scripts/evg-001-cross-work-visual/run.ts
 *   EVG_SKIP_RENDER=1 npx tsx scripts/evg-001-cross-work-visual/run.ts
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { imageGenerate } from "../../lib/ai/capability/imageGenerate";
import {
  foldCharacterArchivesIntoExpression,
  selectActiveCharacterCues,
} from "../../lib/discovery/character-archive";
import {
  expressionToPrompt,
  projectExpressionForDeployment,
  resolveProjectionProfileFromEnv,
  type ProjectionProfile,
} from "../../lib/discovery/execution-projection";
import { assessSceneFaceSafety } from "../../lib/discovery/expression-capability-rules";
import {
  parseRendererExpression,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";
import {
  buildFrameDraftPrompt,
  buildFrameNegativePrompt,
} from "../../lib/prompts/frame-draft";
import {
  ASOIAF_BOUND_PATTERNS,
  FRAMES,
  LETTER_REWRITE_PATTERN,
  LOCATION_SUBSTITUTION_PATTERN,
  MAP_SURVIVAL_PATTERN,
  STYLE_HINT_MARKERS,
  TK_BOUND_PATTERNS,
  WORK_IDENTITY_MARKERS,
  type FrameFixture,
  type WorkId,
} from "./fixtures";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROUND = process.env.EVG_ROUND?.trim() || "r3";
const RESULTS_DIR = path.join(SPIKE_DIR, "results", ROUND);
const LOCAL_ATTEMPTS = Number(process.env.EVG_LOCAL_ATTEMPTS?.trim() || "2") || 2;

type LeakHit = { id: string; where: "environment" | "action" | "prompt" };

type IdentityScore = {
  token: string;
  inCanonical: boolean;
  inProjectedVisual: boolean;
  inLocalPrompt: boolean;
};

type IdentitySlotRow = {
  role: string;
  canonicalVisual: string;
  projectedVisual: string;
  actionPhraseInProjected: boolean;
  namedWeaponInCanonical: boolean;
  namedWeaponInProjected: boolean;
  namedWeaponDowngraded: boolean;
  actionOutranksIdentity: boolean;
};

type FrameRow = {
  id: string;
  workId: WorkId;
  sceneType: FrameFixture["sceneType"];
  label: string;
  caption: string;
  archiveBudget: { role: string; activeCues: string[] }[];
  canonicalExpression: RendererExpression;
  foldedExpression: RendererExpression;
  localProjected: RendererExpression;
  cloudPrompt: string;
  localPrompt: string;
  styleHintsAuthored: boolean;
  styleHintsInLocalPrompt: boolean;
  workIdentityInLocalPrompt: boolean;
  visualEmphasisInLocalPrompt: boolean;
  asoiafBoundLeaks: LeakHit[];
  reverseWorkLeaks: LeakHit[];
  locationSubstituted: boolean;
  mapRewrittenToLetter: boolean;
  identity: IdentityScore[];
  identitySlots: IdentitySlotRow[];
  identityLocalHitRate: number;
  faceSafety: string;
  rendered: boolean;
  ok?: boolean;
  blank?: boolean;
  bytes?: number;
  ms?: number;
  usedFallback?: boolean;
  localAttempts?: number;
  pngRel?: string;
  error?: string;
};

const ACTION_PHRASE_RE =
  /\b(looking|standing|seated|sitting|reaching|turning|reading|facing|walking|leaning|holding|bowed|profile)\b/i;
const GENERIC_WEAPON_RE =
  /\b(blade|glaive|spear|halberd|greatsword|sword|bow|staff)\b/i;
const IDENTITY_BODY_OR_COSTUME_RE =
  /\b(face|beard|robe|cloak|gown|armor|armour|fur|hair)\b/i;

function parseExpr(raw: RendererExpression, label: string): RendererExpression {
  const result = parseRendererExpression(raw);
  if (!result.ok) throw new Error(`${label}: ${result.errors.join("; ")}`);
  return result.value;
}

function collectLeaks(
  workId: WorkId,
  environment: string,
  action: string,
  prompt: string
): LeakHit[] {
  const patterns =
    workId === "three-kingdoms" ? ASOIAF_BOUND_PATTERNS : TK_BOUND_PATTERNS;
  const hits: LeakHit[] = [];
  for (const { id, pattern } of patterns) {
    if (pattern.test(environment)) hits.push({ id, where: "environment" });
    if (pattern.test(action)) hits.push({ id, where: "action" });
    if (pattern.test(prompt)) hits.push({ id, where: "prompt" });
  }
  return hits;
}

function isNamedWeaponPhrase(part: string): boolean {
  const words = part.trim().split(/\s+/).filter(Boolean);
  return GENERIC_WEAPON_RE.test(part) && words.length >= 2;
}

function identitySlotForRole(
  role: string,
  canonicalVisual: string,
  projectedVisual: string
): IdentitySlotRow {
  const namedInCanonical = canonicalVisual
    .split(",")
    .map((p) => p.trim())
    .some(isNamedWeaponPhrase);
  const namedInProjected = projectedVisual
    .split(",")
    .map((p) => p.trim())
    .some(isNamedWeaponPhrase);
  const genericOnly =
    GENERIC_WEAPON_RE.test(projectedVisual) && !namedInProjected;
  const identityCanonical = IDENTITY_BODY_OR_COSTUME_RE.test(canonicalVisual);
  const identityProjected = IDENTITY_BODY_OR_COSTUME_RE.test(projectedVisual);
  const actionInProjected = ACTION_PHRASE_RE.test(projectedVisual);
  return {
    role,
    canonicalVisual,
    projectedVisual,
    actionPhraseInProjected: actionInProjected,
    namedWeaponInCanonical: namedInCanonical,
    namedWeaponInProjected: namedInProjected,
    namedWeaponDowngraded: namedInCanonical && !namedInProjected && genericOnly,
    actionOutranksIdentity:
      actionInProjected && identityCanonical && !identityProjected,
  };
}

function identityScores(
  frame: FrameFixture,
  cloud: string,
  projectedBlob: string,
  local: string
): IdentityScore[] {
  return frame.identityTokens.map((token) => {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return {
      token,
      inCanonical: re.test(cloud),
      inProjectedVisual: re.test(projectedBlob),
      inLocalPrompt: re.test(local),
    };
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function assessBlank(
  pngPath: string
): Promise<{ blank: boolean; mean: number; std: number }> {
  try {
    const sharp = (await import("sharp")).default;
    const buf = readFileSync(pngPath);
    const { data } = await sharp(buf)
      .resize(64, 64, { fit: "inside" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (const v of data) sum += v;
    const mean = sum / data.length;
    let vsum = 0;
    for (const v of data) vsum += (v - mean) ** 2;
    const std = Math.sqrt(vsum / data.length);
    return {
      blank: std <= 14 && mean >= 245,
      mean: Number(mean.toFixed(1)),
      std: Number(std.toFixed(1)),
    };
  } catch {
    return { blank: false, mean: -1, std: -1 };
  }
}

function analyzeFrame(
  frame: FrameFixture,
  profile: ProjectionProfile
): Omit<
  FrameRow,
  | "rendered"
  | "ok"
  | "blank"
  | "bytes"
  | "ms"
  | "usedFallback"
  | "localAttempts"
  | "pngRel"
  | "error"
> {
  const canonical = parseExpr(frame.expression, frame.id);
  const folded = foldCharacterArchivesIntoExpression(
    canonical,
    frame.roles.map((r) => ({ name: r.name, archive: r.archive }))
  );
  const localProjected = projectExpressionForDeployment(folded, "local");
  const cloudPrompt = expressionToPrompt(folded, "cloud");
  const localPrompt = buildFrameDraftPrompt({
    caption: frame.caption,
    routeTitle: frame.routeTitle,
    rendererExpression: folded,
    projectionProfile: profile,
  });

  const asoiafBoundLeaks =
    frame.workId === "three-kingdoms"
      ? collectLeaks(
          "three-kingdoms",
          localProjected.environment,
          localProjected.action,
          localPrompt
        )
      : [];
  const reverseWorkLeaks =
    frame.workId === "asoiaf"
      ? collectLeaks(
          "asoiaf",
          localProjected.environment,
          localProjected.action,
          localPrompt
        )
      : [];
  const authoredMap = MAP_SURVIVAL_PATTERN.test(
    `${canonical.environment} ${canonical.action}`
  );
  const mapRewrittenToLetter =
    frame.workId === "three-kingdoms" &&
    authoredMap &&
    !MAP_SURVIVAL_PATTERN.test(
      `${localProjected.environment} ${localProjected.action}`
    ) &&
    LETTER_REWRITE_PATTERN.test(
      `${localProjected.environment} ${localProjected.action}`
    );
  const locationSubstituted =
    frame.workId === "three-kingdoms" &&
    LOCATION_SUBSTITUTION_PATTERN.test(localProjected.environment);

  const projectedBlob = [
    ...localProjected.characters.map((c) => c.visual),
    localProjected.environment,
    localProjected.action,
  ].join(" | ");
  const identity = identityScores(frame, cloudPrompt, projectedBlob, localPrompt);
  const identitySlots = canonical.characters.map((ch, i) =>
    identitySlotForRole(
      ch.role,
      ch.visual,
      localProjected.characters[i]?.visual ?? ""
    )
  );
  const localHits = identity.filter((s) => s.inLocalPrompt).length;
  const sceneBlob = `${canonical.environment} ${canonical.action} ${canonical.composition}`;

  return {
    id: frame.id,
    workId: frame.workId,
    sceneType: frame.sceneType,
    label: frame.label,
    caption: frame.caption,
    archiveBudget: frame.roles.map((r) => ({
      role: r.name,
      activeCues: selectActiveCharacterCues(
        r.archive,
        undefined,
        sceneBlob
      ).activeCues,
    })),
    canonicalExpression: canonical,
    foldedExpression: folded,
    localProjected,
    cloudPrompt,
    localPrompt,
    styleHintsAuthored: Boolean(canonical.styleHints),
    styleHintsInLocalPrompt:
      Boolean(canonical.styleHints) &&
      STYLE_HINT_MARKERS[frame.workId].test(localPrompt),
    workIdentityInLocalPrompt: WORK_IDENTITY_MARKERS[frame.workId].test(localPrompt),
    visualEmphasisInLocalPrompt: Boolean(
      canonical.visualEmphasis &&
        localPrompt.toLowerCase().includes("visual emphasis:")
    ),
    asoiafBoundLeaks,
    reverseWorkLeaks,
    locationSubstituted,
    mapRewrittenToLetter,
    identity,
    identitySlots,
    identityLocalHitRate:
      identity.length === 0 ? 0 : Number((localHits / identity.length).toFixed(2)),
    faceSafety: assessSceneFaceSafety(folded).safety_status,
  };
}

function pinFallbackToPrimaryProvider(): void {
  const primary =
    process.env.IMAGE_CREATOR_ACCEPT_PROVIDER?.trim() || "localai";
  process.env.IMAGE_CREATOR_ACCEPT_FALLBACK = primary;
}

async function generateLocalOnly(args: {
  frame: FrameFixture;
  prompt: string;
  seed: number;
  size: number;
  outPng: string;
}): Promise<{
  ok: boolean;
  blank: boolean;
  bytes?: number;
  usedFallback: boolean;
  localAttempts: number;
  error?: string;
}> {
  let lastError: string | undefined;
  let lastBlank = false;
  let lastBytes: number | undefined;

  for (let attempt = 1; attempt <= LOCAL_ATTEMPTS; attempt++) {
    try {
      console.info("[evg-001] generate", {
        id: args.frame.id,
        attempt,
        of: LOCAL_ATTEMPTS,
      });
      const candidate = await imageGenerate({
        surface: "creator",
        assetSlot: "scene_frame",
        clientJobId: `evg-001-${ROUND}-${args.frame.id}-a${attempt}`,
        prompt: args.prompt,
        negativePrompt: buildFrameNegativePrompt(args.frame.caption, {
          castCount: args.frame.expression.characters.length,
        }),
        seed: args.seed,
        size: { width: args.size, height: args.size },
      });
      if (candidate.usedFallback) {
        lastError = "provider contamination: usedFallback=true (Cloud path)";
        lastBlank = false;
        console.error("[evg-001] refuse fallback", args.frame.id);
        continue;
      }
      await writeFile(args.outPng, candidate.bytes);
      const blank = await assessBlank(args.outPng);
      lastBytes = candidate.bytes.length;
      lastBlank = blank.blank;
      if (blank.blank) {
        lastError = `blank canvas (Local attempt ${attempt})`;
        console.warn("[evg-001] blank", args.frame.id, { attempt });
        continue;
      }
      return {
        ok: true,
        blank: false,
        bytes: candidate.bytes.length,
        usedFallback: false,
        localAttempts: attempt,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn("[evg-001] local attempt failed", {
        id: args.frame.id,
        attempt,
        error: lastError.slice(0, 200),
      });
    }
  }

  return {
    ok: false,
    blank: lastBlank,
    bytes: lastBytes,
    usedFallback: false,
    localAttempts: LOCAL_ATTEMPTS,
    error: lastError?.slice(0, 500) ?? "Local generation failed",
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  pinFallbackToPrimaryProvider();
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.EVG_LOCAL_MAX_EDGE?.trim() || "512";

  const skipRender = process.env.EVG_SKIP_RENDER?.trim() === "1";
  const skipExisting = process.env.EVG_SKIP_EXISTING?.trim() === "1";
  const seed = Number(process.env.EVG_SEED?.trim() || "42") || 42;
  const size = Number(process.env.EVG_SIZE?.trim() || "512") || 512;
  const idFilter = process.env.EVG_FRAMES?.trim();
  const frames = idFilter
    ? FRAMES.filter((f) =>
        idFilter
          .split(",")
          .map((s) => s.trim())
          .includes(f.id)
      )
    : FRAMES;
  const profile = resolveProjectionProfileFromEnv();

  await mkdir(RESULTS_DIR, { recursive: true });

  console.info("[evg-001] start", {
    grant: "EVG-001-R3",
    round: ROUND,
    frames: frames.map((f) => f.id),
    render: frames.filter((f) => f.render).map((f) => f.id),
    profile,
    skipRender,
    provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
    fallback: process.env.IMAGE_CREATOR_ACCEPT_FALLBACK,
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL,
  });

  const rows: FrameRow[] = [];

  for (const frame of frames) {
    const analyzed = analyzeFrame(frame, profile);
    const row: FrameRow = { ...analyzed, rendered: false };

    const shouldRender = !skipRender && frame.render;
    if (!shouldRender) {
      rows.push(row);
      console.info("[evg-001] analyzed", {
        id: frame.id,
        leaks: row.asoiafBoundLeaks.map((l) => `${l.id}@${l.where}`),
        reverseLeaks: row.reverseWorkLeaks.map((l) => `${l.id}@${l.where}`),
        locationSubstituted: row.locationSubstituted,
        mapRewrittenToLetter: row.mapRewrittenToLetter,
        workIdentityInLocalPrompt: row.workIdentityInLocalPrompt,
        visualEmphasisInLocalPrompt: row.visualEmphasisInLocalPrompt,
        identityLocalHitRate: row.identityLocalHitRate,
        actionOutranksIdentity: row.identitySlots.filter(
          (s) => s.actionOutranksIdentity
        ).map((s) => s.role),
        namedWeaponDowngraded: row.identitySlots.filter(
          (s) => s.namedWeaponDowngraded
        ).map((s) => s.role),
      });
      continue;
    }

    const outPng = path.join(RESULTS_DIR, `${frame.id}.png`);
    const pngRel = path.relative(SPIKE_DIR, outPng);

    if (skipExisting && (await exists(outPng))) {
      const blank = await assessBlank(outPng);
      rows.push({
        ...row,
        rendered: true,
        ok: !blank.blank,
        blank: blank.blank,
        bytes: readFileSync(outPng).length,
        ms: 0,
        usedFallback: false,
        localAttempts: 0,
        pngRel,
        error: blank.blank ? "blank canvas (existing file)" : undefined,
      });
      console.info("[evg-001] skip render", frame.id);
      continue;
    }

    const started = Date.now();
    const generated = await generateLocalOnly({
      frame,
      prompt: row.localPrompt,
      seed,
      size,
      outPng,
    });
    rows.push({
      ...row,
      rendered: Boolean(generated.bytes),
      ok: generated.ok,
      blank: generated.blank,
      bytes: generated.bytes,
      ms: Date.now() - started,
      usedFallback: generated.usedFallback,
      localAttempts: generated.localAttempts,
      pngRel: generated.bytes ? pngRel : undefined,
      error: generated.error,
    });
    if (generated.ok) {
      console.info("[evg-001] done", {
        id: frame.id,
        ms: Date.now() - started,
        attempts: generated.localAttempts,
      });
    } else {
      console.error("[evg-001] fail", frame.id, generated.error?.slice(0, 200));
    }
  }

  const tkRows = rows.filter((r) => r.workId === "three-kingdoms");
  const asRows = rows.filter((r) => r.workId === "asoiaf");
  const summary = {
    grant: "EVG-001-R3",
    round: ROUND,
    generatedAt: new Date().toISOString(),
    provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
    fallbackPinnedTo: process.env.IMAGE_CREATOR_ACCEPT_FALLBACK,
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL,
    projectionProfile: profile,
    seed,
    size,
    skipRender,
    cloudFallbackDisabled: true,
    counts: {
      frames: rows.length,
      threeKingdoms: tkRows.length,
      asoiaf: asRows.length,
      tkAsoiafBoundLeakFrames: tkRows.filter((r) => r.asoiafBoundLeaks.length > 0)
        .length,
      reverseLeakFrames: asRows.filter((r) => r.reverseWorkLeaks.length > 0)
        .length,
      tkMapRewritten: tkRows.filter((r) => r.mapRewrittenToLetter).length,
      tkLocationSubstituted: tkRows.filter((r) => r.locationSubstituted).length,
      workIdentityMissing: rows.filter((r) => !r.workIdentityInLocalPrompt)
        .length,
      visualEmphasisDropped: rows.filter(
        (r) =>
          r.canonicalExpression.visualEmphasis && !r.visualEmphasisInLocalPrompt
      ).length,
      actionOutranksIdentity: rows.filter((r) =>
        r.identitySlots.some((s) => s.actionOutranksIdentity)
      ).length,
      namedWeaponDowngraded: rows.filter((r) =>
        r.identitySlots.some((s) => s.namedWeaponDowngraded)
      ).length,
      usedFallback: rows.filter((r) => r.usedFallback).length,
      localBlanks: rows.filter((r) => r.blank).length,
    },
    rows,
  };

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );

  console.info("[evg-001] complete", summary.counts);
}

main().catch((err) => {
  console.error("[evg-001] fatal", err);
  process.exit(1);
});
