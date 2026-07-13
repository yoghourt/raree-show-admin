"use client";

import { AlertCircle, Lock, Plus, Trash2, Unlock } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  APPROVED_SUMMARY_MIN_PROSE,
  EXCERPT_BUNDLE_MIN_PROSE,
} from "@/lib/discovery/constants";
import {
  DISCOVERY_EXAMPLES,
  DISCOVERY_FORBIDDEN_INPUTS,
  DISCOVERY_NARRATIVE_HINT,
} from "@/lib/discovery/normative-copy";
import { discoveryComposerUi } from "@/lib/discovery/ui-copy";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import type { UseRolloutReturn } from "@/hooks/useRollout";
import { DiscoveryReviewPanel } from "@/components/discovery/DiscoveryReviewPanel";
import { Input } from "@/components/ui/input";
import type { NarrativeExcerpt } from "@/lib/discovery/types";

export interface DiscoveryComposerProps {
  discovery: UseDiscoverySessionReturn;
  rollout?: UseRolloutReturn;
  initialStep?: "review" | "rollout";
}

export function DiscoveryComposer({
  discovery,
  rollout,
  initialStep,
}: DiscoveryComposerProps) {
  const {
    session,
    gateResult,
    gateFlags,
    setGateFlags,
    sessionConflict,
    isLocking,
    lockError,
    canPropose,
    isProposing,
    proposeError,
    minProseRequired,
    updateNarrative,
    setInputMode,
    lockNarrative,
    unlockNarrative,
    startPropose,
  } = discovery;

  const [lockDialogOpen, setLockDialogOpen] = React.useState(false);
  const editable = session.state === "draft";

  const narrative = session.narrative;

  const updateExcerpt = (index: number, patch: Partial<NarrativeExcerpt>) => {
    const next = narrative.excerpts.map((excerpt, i) =>
      i === index ? { ...excerpt, ...patch } : excerpt
    );
    updateNarrative({ ...narrative, excerpts: next });
  };

  const addExcerpt = () => {
    const nextIndex =
      narrative.excerpts.reduce(
        (max, excerpt) => Math.max(max, excerpt.orderIndex),
        -1
      ) + 1;
    updateNarrative({
      ...narrative,
      excerpts: [
        ...narrative.excerpts,
        { text: "", orderIndex: nextIndex },
      ],
    });
  };

  const removeExcerpt = (index: number) => {
    if (narrative.excerpts.length <= 1) {
      return;
    }
    updateNarrative({
      ...narrative,
      excerpts: narrative.excerpts.filter((_, i) => i !== index),
    });
  };

  const handleConfirmLock = async () => {
    const ok = await lockNarrative();
    if (ok) {
      setLockDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {sessionConflict ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {discoveryComposerUi.sessionConflict}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{discoveryComposerUi.narrativeInputTitle}</CardTitle>
          <CardDescription>
            {session.state === "narrative_locked"
              ? discoveryComposerUi.lockedDescription(session.lockedAt ?? "")
              : discoveryComposerUi.draftDescription(
                  minProseRequired,
                  gateResult.totalProse
                )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <details className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-zinc-800">
              {discoveryComposerUi.helpToggle}
            </summary>
            <div className="mt-3 space-y-4 text-muted-foreground">
              <p>{DISCOVERY_NARRATIVE_HINT}</p>
              <div>
                <p className="mb-1 font-medium text-zinc-700">
                  {discoveryComposerUi.forbiddenInputsTitle}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {DISCOVERY_FORBIDDEN_INPUTS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-zinc-700">
                  {discoveryComposerUi.examplesTitle}
                </p>
                {DISCOVERY_EXAMPLES.slice(0, 3).map((row, index) => (
                  <div
                    key={`${row.label}-${row.verdict}-${index}`}
                    className="rounded-md border border-zinc-200 bg-white p-2.5"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-800">
                        {row.label}
                      </span>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {row.verdict}
                      </span>
                    </div>
                    <p>{row.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <div className="space-y-2">
            <Label htmlFor="input-mode">{discoveryComposerUi.inputModeLabel}</Label>
            <Select
              value={narrative.inputMode}
              onValueChange={(value) =>
                setInputMode(value as typeof narrative.inputMode)
              }
              disabled={!editable}
            >
              <SelectTrigger id="input-mode" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excerpt_bundle">
                  {discoveryComposerUi.excerptBundleMode(EXCERPT_BUNDLE_MIN_PROSE)}
                </SelectItem>
                <SelectItem value="approved_summary">
                  {discoveryComposerUi.approvedSummaryMode(
                    APPROVED_SUMMARY_MIN_PROSE
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {discoveryComposerUi.inputModeSwitchHint}
            </p>
          </div>

          {narrative.inputMode === "excerpt_bundle" ? (
            <div className="space-y-4">
              {narrative.excerpts.map((excerpt, index) => (
                <div
                  key={`excerpt-${excerpt.orderIndex}-${index}`}
                  className="space-y-2 rounded-lg border border-zinc-200 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      {discoveryComposerUi.excerptLabel(excerpt.orderIndex + 1)}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!editable || narrative.excerpts.length <= 1}
                      onClick={() => removeExcerpt(index)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      {discoveryComposerUi.removeExcerpt}
                    </Button>
                  </div>
                  <Input
                    placeholder={discoveryComposerUi.sourceLabelPlaceholder}
                    value={excerpt.sourceLabel ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      updateExcerpt(index, { sourceLabel: e.target.value })
                    }
                  />
                  <Textarea
                    placeholder={discoveryComposerUi.excerptPlaceholder}
                    value={excerpt.text}
                    disabled={!editable}
                    rows={5}
                    onChange={(e) =>
                      updateExcerpt(index, { text: e.target.value })
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!editable}
                onClick={addExcerpt}
              >
                <Plus className="size-4" aria-hidden />
                {discoveryComposerUi.addExcerpt}
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="operator-summary">
              {narrative.inputMode === "approved_summary"
                ? discoveryComposerUi.operatorSummaryRequired
                : discoveryComposerUi.operatorSummaryOptional}
            </Label>
            <Textarea
              id="operator-summary"
              placeholder={discoveryComposerUi.operatorSummaryPlaceholder}
              value={narrative.operatorSummary ?? ""}
              disabled={!editable}
              rows={6}
              onChange={(e) =>
                updateNarrative({
                  ...narrative,
                  operatorSummary: e.target.value || null,
                })
              }
            />
            {narrative.inputMode === "excerpt_bundle" ? (
              <p className="text-muted-foreground text-xs">
                {discoveryComposerUi.excerptBundleSummaryHint}
              </p>
            ) : null}
          </div>

          {narrative.inputMode === "approved_summary" ? (
            <div className="flex items-start gap-2">
              <Checkbox
                id="summary-attested"
                checked={narrative.summaryAttested === true}
                disabled={!editable}
                onCheckedChange={(checked) =>
                  updateNarrative({
                    ...narrative,
                    summaryAttested: checked === true,
                  })
                }
              />
              <Label htmlFor="summary-attested" className="leading-snug">
                {discoveryComposerUi.summaryAttested}
              </Label>
            </div>
          ) : null}

          {editable ? (
            <details className="rounded-lg border border-dashed border-zinc-300 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                {discoveryComposerUi.importFlagsTitle}
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="catalog-only"
                    checked={gateFlags.catalogOnly === true}
                    onCheckedChange={(checked) =>
                      setGateFlags({
                        ...gateFlags,
                        catalogOnly: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="catalog-only" className="leading-snug">
                    {discoveryComposerUi.catalogOnlyFlag}
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="runtime-export-only"
                    checked={gateFlags.runtimeExportOnly === true}
                    onCheckedChange={(checked) =>
                      setGateFlags({
                        ...gateFlags,
                        runtimeExportOnly: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="runtime-export-only" className="leading-snug">
                    {discoveryComposerUi.runtimeExportOnlyFlag}
                  </Label>
                </div>
              </div>
            </details>
          ) : null}

          {!gateResult.pass && editable ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              <div className="mb-2 flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {discoveryComposerUi.gateFailedTitle}
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {gateResult.failures.map((failure) => (
                  <li key={failure.ruleId}>
                    {failure.ruleId}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lockError ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {lockError.code}: {lockError.message}
              {lockError.failures?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {lockError.failures.map((failure) => (
                    <li key={failure.ruleId}>
                      {failure.ruleId}: {failure.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {proposeError ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              {proposeError.code}: {proposeError.message}
              {proposeError.errors?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {proposeError.errors.map((err) => (
                    <li key={err.candidateType}>
                      {err.candidateType}: {err.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {editable ? (
            <Button
              type="button"
              disabled={
                !gateResult.pass || isLocking || sessionConflict
              }
              onClick={() => setLockDialogOpen(true)}
            >
              <Lock className="size-4" aria-hidden />
              {discoveryComposerUi.lockNarrative}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void unlockNarrative()}
            >
              <Unlock className="size-4" aria-hidden />
              {discoveryComposerUi.unlockNarrative}
            </Button>
          )}
          <Button
            type="button"
            disabled={!canPropose}
            variant="secondary"
            onClick={() => void startPropose()}
          >
            {isProposing
              ? discoveryComposerUi.proposing
              : discoveryComposerUi.startPropose}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{discoveryComposerUi.lockConfirmTitle}</DialogTitle>
            <DialogDescription>
              {discoveryComposerUi.lockConfirmDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLockDialogOpen(false)}
            >
              {discoveryComposerUi.cancel}
            </Button>
            <Button
              type="button"
              disabled={isLocking}
              onClick={() => void handleConfirmLock()}
            >
              {discoveryComposerUi.confirmLock}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiscoveryReviewPanel
        discovery={discovery}
        rollout={rollout}
        initialStep={initialStep}
      />
    </div>
  );
}
