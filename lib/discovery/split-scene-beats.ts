/**
 * Deterministic Scene summary → N single-beat drafts for Human Split Scene.
 * Not a silent repair — Human must confirm before replacing the review item.
 */

import { contentTokens, splitSentences } from "@/lib/discovery/granularity-gate/text";

export type SceneBeatDraft = {
  title: string;
  summary: string;
};

function titleFromSummary(summary: string, index: number): string {
  const words = contentTokens(summary).slice(0, 6);
  if (words.length === 0) return `Beat ${index + 1}`;
  const raw = words.join(" ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Split a multi-event Scene summary into editable beat drafts.
 * Prefer sentence boundaries; fall back to a single draft when only one beat.
 */
export function draftSceneBeatsFromSummary(
  summary: string,
  opts?: { titleHint?: string }
): SceneBeatDraft[] {
  const trimmed = summary.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return [{ title: opts?.titleHint?.trim() || "Beat 1", summary: "" }];
  }

  const sentences = splitSentences(trimmed).filter(
    (s) => contentTokens(s).length >= 3
  );

  if (sentences.length <= 1) {
    return [
      {
        title: opts?.titleHint?.trim() || titleFromSummary(trimmed, 0),
        summary: trimmed,
      },
    ];
  }

  return sentences.map((sentence, i) => ({
    title:
      i === 0 && opts?.titleHint?.trim()
        ? opts.titleHint.trim()
        : titleFromSummary(sentence, i),
    summary: sentence.trim(),
  }));
}
