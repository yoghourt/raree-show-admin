"use client";

/**
 * Pre-write preview for a Discovery location — same catalog fields as LocationForm.
 * Persist is locations CRUD Save.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findExistingByName } from "@/lib/discovery/entity-catalog-match";
import type { AcceptedLocationStaging } from "@/lib/discovery/review-types";
import { messages } from "@/lib/locale";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import type { Location } from "@/lib/types";

export type LocationWritePreviewCardProps = {
  staging: AcceptedLocationStaging;
  catalog: Location[];
  busy: boolean;
  onChange: (next: AcceptedLocationStaging) => void;
  onWrite: (staging: AcceptedLocationStaging) => void;
  onDismiss: () => void;
};

export function LocationWritePreviewCard({
  staging,
  catalog,
  busy,
  onChange,
  onWrite,
  onDismiss,
}: LocationWritePreviewCardProps) {
  const existing = findExistingByName(staging.name, catalog);
  const canWrite = Boolean(staging.name.trim());

  const patch = (partial: Partial<AcceptedLocationStaging>) => {
    onChange({ ...staging, ...partial });
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">
            {staging.name.trim() || "未命名地点"}
          </p>
          {existing ? (
            <p className="text-xs font-medium text-emerald-800">
              {rolloutUi.locationAlreadyExists}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {rolloutUi.writeLocationPreviewHint}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`loc-name-${staging.sourceReviewId}`}>名称</Label>
          <Input
            id={`loc-name-${staging.sourceReviewId}`}
            value={staging.name}
            disabled={busy}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`loc-region-${staging.sourceReviewId}`}>
            {messages.discovery.candidateFields.region}
          </Label>
          <Input
            id={`loc-region-${staging.sourceReviewId}`}
            value={staging.region}
            disabled={busy}
            onChange={(e) => patch({ region: e.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`loc-desc-${staging.sourceReviewId}`}>
            {messages.discovery.candidateFields.description}
          </Label>
          <Textarea
            id={`loc-desc-${staging.sourceReviewId}`}
            value={staging.description}
            disabled={busy}
            rows={3}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          disabled={busy || !canWrite}
          onClick={() => onWrite(staging)}
        >
          {existing
            ? rolloutUi.persistLocationSkipExisting
            : rolloutUi.persistLocation}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
          {rolloutUi.dismissStaging}
        </Button>
      </div>
    </div>
  );
}
