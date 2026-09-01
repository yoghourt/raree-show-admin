"use client";

/**
 * Pre-write preview for a Discovery character — same catalog fields as CharacterForm.
 * Persist is characters CRUD Save (portrait stays empty for Production derived tasks).
 */

import * as React from "react";

import { proposeCharacterVisualIdentity } from "@/app/actions/proposeCharacterVisualIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findExistingByName } from "@/lib/discovery/entity-catalog-match";
import type { AcceptedCharacterStaging } from "@/lib/discovery/review-types";
import { messages } from "@/lib/locale";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import type { Character } from "@/lib/types";

export type CharacterWritePreviewCardProps = {
  staging: AcceptedCharacterStaging;
  catalog: Character[];
  busy: boolean;
  onChange: (next: AcceptedCharacterStaging) => void;
  onWrite: (staging: AcceptedCharacterStaging) => void;
  onDismiss: () => void;
};

export function CharacterWritePreviewCard({
  staging,
  catalog,
  busy,
  onChange,
  onWrite,
  onDismiss,
}: CharacterWritePreviewCardProps) {
  const existing = findExistingByName(staging.name, catalog);
  const canWrite = Boolean(staging.name.trim());
  const [proposing, setProposing] = React.useState(false);
  const [proposeError, setProposeError] = React.useState<string | null>(null);

  const patch = (partial: Partial<AcceptedCharacterStaging>) => {
    onChange({ ...staging, ...partial });
  };

  const proposeVisual = async () => {
    if (!staging.name.trim()) return;
    setProposing(true);
    setProposeError(null);
    try {
      const result = await proposeCharacterVisualIdentity({
        workId: staging.workId,
        name: staging.name,
        house: staging.house,
        description: staging.description,
        currentVisualIdentity: staging.visualIdentity,
      });
      if (!result.ok) {
        setProposeError(result.message);
        return;
      }
      patch({ visualIdentity: result.visualIdentity });
    } catch (e) {
      setProposeError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposing(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">
            {staging.name.trim() || "未命名角色"}
          </p>
          {existing ? (
            <p className="text-xs font-medium text-emerald-800">
              {rolloutUi.characterAlreadyExists}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {rolloutUi.writeCharacterPreviewHint}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`char-name-${staging.sourceReviewId}`}>姓名</Label>
          <Input
            id={`char-name-${staging.sourceReviewId}`}
            value={staging.name}
            disabled={busy}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`char-house-${staging.sourceReviewId}`}>
            {messages.discovery.candidateFields.house}
          </Label>
          <Input
            id={`char-house-${staging.sourceReviewId}`}
            value={staging.house}
            disabled={busy}
            onChange={(e) => patch({ house: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`char-desc-${staging.sourceReviewId}`}>
            {messages.discovery.candidateFields.description}
          </Label>
          <Textarea
            id={`char-desc-${staging.sourceReviewId}`}
            value={staging.description}
            disabled={busy}
            rows={3}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`char-visual-${staging.sourceReviewId}`}>
            视觉身份
            <span className="ml-1 text-xs text-muted-foreground">
              （生图用，不进读者简介）
            </span>
          </Label>
          <Textarea
            id={`char-visual-${staging.sourceReviewId}`}
            value={staging.visualIdentity}
            disabled={busy || proposing}
            rows={3}
            placeholder="FACE / COSTUME / PROP 线索…"
            onChange={(e) => patch({ visualIdentity: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={busy || proposing || !staging.name.trim()}
              onClick={() => void proposeVisual()}
            >
              {proposing
                ? rolloutUi.reproposingVisualIdentity
                : rolloutUi.reproposeVisualIdentity}
            </Button>
            <p className="text-[11px] text-zinc-500">
              {rolloutUi.reproposeVisualIdentityHint}
            </p>
          </div>
          {proposeError ? (
            <p className="text-destructive text-xs">{proposeError}</p>
          ) : null}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`char-quote-${staging.sourceReviewId}`}>
            {messages.discovery.candidateFields.signatureQuote}
          </Label>
          <Input
            id={`char-quote-${staging.sourceReviewId}`}
            value={staging.signatureQuote ?? ""}
            disabled={busy}
            onChange={(e) =>
              patch({ signatureQuote: e.target.value ? e.target.value : null })
            }
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        {rolloutUi.characterPortraitDeferredHint}
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          disabled={busy || !canWrite}
          onClick={() => onWrite(staging)}
        >
          {existing
            ? rolloutUi.persistCharacterSkipExisting
            : rolloutUi.persistCharacter}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
          {rolloutUi.dismissStaging}
        </Button>
      </div>
    </div>
  );
}
