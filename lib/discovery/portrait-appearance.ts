/**
 * Fold Character Archive visual cues into portrait description at enqueue time.
 * Renderer still receives a prompt string only (SPEC-CHAR-001).
 */

import type { CharacterArchive } from "@/lib/discovery/character-archive";
import {
  formatArchiveForPortrait,
  parseCharacterArchive,
} from "@/lib/discovery/character-archive";
import { listDiscoveryReviewSnapshotsForWork } from "@/lib/discovery/review-session-storage";
import type { CharacterCandidateFields } from "@/lib/discovery/propose-types";
import { getEffectiveFields } from "@/lib/discovery/review-state";
import { mergeAppearanceIntoDescription } from "@/lib/prompts/avatar";

function roleKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function archiveFromFields(
  fields: CharacterCandidateFields | undefined
): CharacterArchive | null {
  if (!fields) return null;
  const parsed = parseCharacterArchive(fields.characterArchive);
  return parsed.ok ? parsed.value : null;
}

/** Recover Role archive still sitting in this tab's Discovery Review snapshots. */
export function lookupCharacterArchiveFromReviewSnapshots(
  workId: string,
  characterName: string
): CharacterArchive | null {
  const needle = roleKey(characterName);
  if (!needle) return null;
  for (const snapshot of listDiscoveryReviewSnapshotsForWork(workId)) {
    for (const item of snapshot.reviewItems ?? []) {
      if (item.candidate.candidateType !== "character") continue;
      const fields = getEffectiveFields(item) as CharacterCandidateFields;
      const name = roleKey(
        (typeof fields.name === "string" && fields.name.trim()) ||
          item.candidate.displayName ||
          ""
      );
      if (name !== needle) continue;
      const archive = archiveFromFields(fields);
      if (archive) return archive;
    }
    for (const candidate of snapshot.candidates ?? []) {
      if (candidate.candidateType !== "character") continue;
      const fields = candidate.fields as CharacterCandidateFields;
      const name = roleKey(
        (typeof fields.name === "string" && fields.name.trim()) ||
          candidate.displayName ||
          ""
      );
      if (name !== needle) continue;
      const archive = archiveFromFields(fields);
      if (archive) return archive;
    }
  }
  return null;
}

/**
 * If a Review snapshot still has archive cues for this name, fold them into
 * description. Existing `[视觉身份]` blocks are replaced when new cues exist.
 */
export function descriptionWithArchiveAppearance(
  workId: string,
  characterName: string,
  description: string
): string {
  const archive = lookupCharacterArchiveFromReviewSnapshots(
    workId,
    characterName
  );
  const appearance = formatArchiveForPortrait(archive);
  if (!appearance) return description;
  return mergeAppearanceIntoDescription(description, appearance);
}
