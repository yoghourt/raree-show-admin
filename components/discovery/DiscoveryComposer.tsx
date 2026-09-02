"use client";

import { Lock, Plus, Trash2, Unlock } from "lucide-react";
import * as React from "react";

import { DiscoveryReviewPanel } from "@/components/discovery/DiscoveryReviewPanel";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import type { UseRolloutReturn } from "@/hooks/useRollout";
import {
  APPROVED_SUMMARY_MIN_PROSE,
  EXCERPT_BUNDLE_MIN_PROSE,
} from "@/lib/discovery/constants";
import {
  DISCOVERY_FORBIDDEN_INPUTS,
  DISCOVERY_NARRATIVE_HINT,
} from "@/lib/discovery/normative-copy";
import type { NarrativeExcerpt } from "@/lib/discovery/types";
import {
  discoveryApiErrorText,
  discoveryComposerUi,
  discoveryReviewUi,
} from "@/lib/discovery/ui-copy";

export interface DiscoveryComposerProps {
  discovery: UseDiscoverySessionReturn;
  rollout?: UseRolloutReturn;
  initialStep?: "review" | "rollout";
}

type ShellTab = "paste" | "review";

export function DiscoveryComposer({
  discovery,
  rollout,
  initialStep,
}: DiscoveryComposerProps) {
  const {
    session,
    gateResult,
    sessionConflict,
    isLocking,
    lockError,
    canPropose,
    isProposing,
    proposeError,
    minProseRequired,
    activeReviewItems,
    updateNarrative,
    setInputMode,
    lockNarrative,
    unlockNarrative,
    startPropose,
  } = discovery;

  const [lockDialogOpen, setLockDialogOpen] = React.useState(false);
  const editable = session.state === "draft";
  const narrative = session.narrative;
  const reviewReady =
    session.state === "review_pending" ||
    session.state === "narrative_locked" ||
    activeReviewItems.length > 0;

  const [shellTab, setShellTab] = React.useState<ShellTab>(() =>
    initialStep || reviewReady ? "review" : "paste"
  );

  React.useEffect(() => {
    if (initialStep === "review" || initialStep === "rollout") {
      setShellTab("review");
    }
  }, [initialStep]);

  React.useEffect(() => {
    if (session.state === "review_pending") {
      setShellTab("review");
    }
    if (session.state === "draft") {
      setShellTab("paste");
    }
  }, [session.state]);

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
      excerpts: [...narrative.excerpts, { text: "", orderIndex: nextIndex }],
    });
  };

  const removeExcerpt = (index: number) => {
    if (narrative.excerpts.length <= 1) return;
    updateNarrative({
      ...narrative,
      excerpts: narrative.excerpts.filter((_, i) => i !== index),
    });
  };

  const handleConfirmLock = async () => {
    const ok = await lockNarrative();
    if (ok) setLockDialogOpen(false);
  };

  const handleStartPropose = async () => {
    const ok = await startPropose();
    if (ok) setShellTab("review");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {sessionConflict ? (
        <div
          className="mb-2 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
          role="alert"
        >
          {discoveryComposerUi.sessionConflict}
        </div>
      ) : null}

      <Tabs
        value={shellTab}
        onValueChange={(v) => setShellTab(v as ShellTab)}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden"
      >
        <TabsList className="h-8 w-fit shrink-0">
          <TabsTrigger value="paste" className="h-7 px-3 text-sm">
            {discoveryComposerUi.narrativeInputTitle}
          </TabsTrigger>
          <TabsTrigger value="review" className="h-7 px-3 text-sm">
            {discoveryReviewUi.panelTitle}
            {activeReviewItems.length > 0 ? (
              <span className="bg-primary/10 text-primary ml-1.5 inline-flex min-w-4 justify-center rounded-full px-1 text-[10px] tabular-nums">
                {activeReviewItems.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="paste"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <Card className="shadow-none">
            <CardHeader className="space-y-1 px-4 py-3">
              <CardTitle className="text-base">
                {discoveryComposerUi.narrativeInputTitle}
              </CardTitle>
              <CardDescription className="text-sm">
                {editable
                  ? discoveryComposerUi.draftDescription(
                      minProseRequired,
                      gateResult.totalProse
                    )
                  : discoveryComposerUi.lockedDescription(
                      session.lockedAt ?? ""
                    )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-3 pt-0">
              <details className="rounded-md border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-zinc-800">
                  {discoveryComposerUi.helpToggle}
                </summary>
                <div className="mt-2 space-y-3 text-muted-foreground">
                  <p>{DISCOVERY_NARRATIVE_HINT}</p>
                  <div>
                    <p className="mb-1 font-medium text-zinc-700">
                      {discoveryComposerUi.forbiddenInputsTitle}
                    </p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {DISCOVERY_FORBIDDEN_INPUTS.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>

              <div className="space-y-1.5">
                <Label htmlFor="input-mode" className="text-sm">
                  {discoveryComposerUi.inputModeLabel}
                </Label>
                <Select
                  value={narrative.inputMode}
                  onValueChange={(value) =>
                    setInputMode(value as typeof narrative.inputMode)
                  }
                  disabled={!editable}
                >
                  <SelectTrigger
                    id="input-mode"
                    className="h-8 w-full text-sm sm:w-72"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excerpt_bundle">
                      {discoveryComposerUi.excerptBundleMode(
                        EXCERPT_BUNDLE_MIN_PROSE
                      )}
                    </SelectItem>
                    <SelectItem value="approved_summary">
                      {discoveryComposerUi.approvedSummaryMode(
                        APPROVED_SUMMARY_MIN_PROSE
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {narrative.inputMode === "excerpt_bundle" ? (
                <div className="space-y-2">
                  {narrative.excerpts.map((excerpt, index) => (
                    <div
                      key={`excerpt-${excerpt.orderIndex}-${index}`}
                      className="space-y-1.5 rounded-md border border-zinc-200 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm">
                          {discoveryComposerUi.excerptLabel(
                            excerpt.orderIndex + 1
                          )}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            !editable || narrative.excerpts.length <= 1
                          }
                          onClick={() => removeExcerpt(index)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {discoveryComposerUi.removeExcerpt}
                        </Button>
                      </div>
                      <Input
                        className="h-8 text-sm"
                        placeholder={
                          discoveryComposerUi.sourceLabelPlaceholder
                        }
                        value={excerpt.sourceLabel ?? ""}
                        disabled={!editable}
                        onChange={(e) =>
                          updateExcerpt(index, {
                            sourceLabel: e.target.value,
                          })
                        }
                      />
                      <Textarea
                        placeholder={discoveryComposerUi.excerptPlaceholder}
                        value={excerpt.text}
                        disabled={!editable}
                        rows={3}
                        className="text-sm leading-relaxed"
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
                    className="h-7 text-xs"
                    disabled={!editable}
                    onClick={addExcerpt}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {discoveryComposerUi.addExcerpt}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="operator-summary" className="text-sm">
                  {narrative.inputMode === "approved_summary"
                    ? discoveryComposerUi.operatorSummaryRequired
                    : discoveryComposerUi.operatorSummaryOptional}
                </Label>
                <Textarea
                  id="operator-summary"
                  placeholder={
                    discoveryComposerUi.operatorSummaryPlaceholder
                  }
                  value={narrative.operatorSummary ?? ""}
                  disabled={!editable}
                  rows={4}
                  className="text-sm leading-relaxed"
                  onChange={(e) =>
                    updateNarrative({
                      ...narrative,
                      operatorSummary: e.target.value || null,
                    })
                  }
                />
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
                  <Label
                    htmlFor="summary-attested"
                    className="text-sm leading-snug"
                  >
                    {discoveryComposerUi.summaryAttested}
                  </Label>
                </div>
              ) : null}

              {lockError ? (
                <div
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
                  role="alert"
                >
                  {discoveryApiErrorText(lockError)}
                </div>
              ) : null}

              {proposeError ? (
                <div
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
                  role="alert"
                >
                  {discoveryApiErrorText(proposeError)}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-1.5 border-t px-4 py-2">
              {editable ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={
                    !gateResult.pass || isLocking || sessionConflict
                  }
                  onClick={() => setLockDialogOpen(true)}
                >
                  <Lock className="size-3.5" aria-hidden />
                  {discoveryComposerUi.lockNarrative}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void unlockNarrative()}
                >
                  <Unlock className="size-3.5" aria-hidden />
                  {discoveryComposerUi.unlockNarrative}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={!canPropose}
                variant="secondary"
                onClick={() => void handleStartPropose()}
              >
                {isProposing
                  ? discoveryComposerUi.proposing
                  : discoveryComposerUi.startPropose}
              </Button>
              {reviewReady ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setShellTab("review")}
                >
                  {discoveryComposerUi.goReviewTab}
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent
          value="review"
          forceMount
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          {!reviewReady ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-sm text-zinc-500">
              <p>{discoveryComposerUi.emptyReviewHint}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-xs"
                onClick={() => setShellTab("paste")}
              >
                {discoveryComposerUi.goPasteTab}
              </Button>
            </div>
          ) : (
            <DiscoveryReviewPanel
              discovery={discovery}
              rollout={rollout}
              initialStep={initialStep}
            />
          )}
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
