"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import {
  DISCOVERY_CANDIDATE_TYPES,
  type DiscoveryCandidateFields,
  type DiscoveryCandidateType,
} from "@/lib/discovery/propose-types";
import {
  getEffectiveDisplayName,
  getEffectiveFields,
  getEffectiveSummary,
  hasPendingReviewItems,
  canEditReviewItem,
} from "@/lib/discovery/review-state";
import {
  buildEntityCreateHandoffPath,
} from "@/lib/discovery/accept-prefill";
import {
  DISCOVERY_CANDIDATE_TYPE_LABELS,
  type DiscoveryReviewItem,
} from "@/lib/discovery/review-types";
import {
  CONFIDENCE_LABELS,
  REVIEW_STATUS_LABELS,
  candidateFieldLabel,
  discoveryComposerUi,
  discoveryReviewUi,
} from "@/lib/discovery/ui-copy";

export interface DiscoveryReviewPanelProps {
  discovery: UseDiscoverySessionReturn;
}

function statusLabel(status: DiscoveryReviewItem["status"]): string {
  return REVIEW_STATUS_LABELS[status];
}

function confidenceLabel(confidence: "green" | "yellow" | "red"): string {
  return CONFIDENCE_LABELS[confidence];
}

function FieldsPreview({ fields }: { fields: DiscoveryCandidateFields }) {
  const entries = Object.entries(
    fields as unknown as Record<string, unknown>
  ).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">{discoveryReviewUi.noFields}</p>
    );
  }
  return (
    <dl className="grid gap-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
          <dt className="text-muted-foreground font-medium">
            {candidateFieldLabel(key)}
          </dt>
          <dd className="break-words">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DiscoveryReviewPanel({ discovery }: DiscoveryReviewPanelProps) {
  const {
    session,
    proposeError,
    reviewItems,
    acceptedStoryUnits,
    acceptedSceneCandidates,
    isProposing,
    isRegening,
    regenReviewId,
    regenError,
    acceptError,
    discardCandidate,
    saveCandidateEdit,
    regenCandidate,
    acceptCandidate,
    startFullRePropose,
    retryProposeType,
    retryingType,
    retryTypeError,
  } = discovery;

  const [editItem, setEditItem] = React.useState<DiscoveryReviewItem | null>(
    null
  );
  const [editDisplayName, setEditDisplayName] = React.useState("");
  const [editSummary, setEditSummary] = React.useState("");
  const [editFieldsJson, setEditFieldsJson] = React.useState("");
  const [editParseError, setEditParseError] = React.useState<string | null>(
    null
  );

  const [regenItem, setRegenItem] = React.useState<DiscoveryReviewItem | null>(
    null
  );
  const [regenFeedback, setRegenFeedback] = React.useState("");

  const [reProposeOpen, setReProposeOpen] = React.useState(false);

  const [typeRetryTarget, setTypeRetryTarget] =
    React.useState<DiscoveryCandidateType | null>(null);
  const [typeRetryFeedback, setTypeRetryFeedback] = React.useState("");

  const failedTypes = React.useMemo(() => {
    return new Set(proposeError?.errors?.map((e) => e.candidateType) ?? []);
  }, [proposeError]);

  const openEdit = (item: DiscoveryReviewItem) => {
    setEditItem(item);
    setEditDisplayName(getEffectiveDisplayName(item));
    setEditSummary(getEffectiveSummary(item));
    setEditFieldsJson(JSON.stringify(getEffectiveFields(item), null, 2));
    setEditParseError(null);
  };

  const handleSaveEdit = () => {
    if (!editItem) {
      return;
    }
    let parsed: DiscoveryCandidateFields;
    try {
      parsed = JSON.parse(editFieldsJson) as DiscoveryCandidateFields;
    } catch {
      setEditParseError(discoveryReviewUi.fieldsJsonParseError);
      return;
    }

    const trimmedDisplayName = editDisplayName.trim();
    const parsedRecord = parsed as unknown as Record<string, unknown>;
    if (editItem.candidate.candidateType === "character") {
      parsedRecord.name =
        trimmedDisplayName ||
        (typeof parsedRecord.name === "string" ? parsedRecord.name : "");
    } else if (editItem.candidate.candidateType === "location") {
      parsedRecord.name =
        trimmedDisplayName ||
        (typeof parsedRecord.name === "string" ? parsedRecord.name : "");
    } else if (
      editItem.candidate.candidateType === "story" ||
      editItem.candidate.candidateType === "scene"
    ) {
      parsedRecord.title =
        trimmedDisplayName ||
        (typeof parsedRecord.title === "string" ? parsedRecord.title : "");
    }
    parsed = parsedRecord as unknown as DiscoveryCandidateFields;

    saveCandidateEdit(editItem.reviewId, {
      editedFields: parsed,
      editedDisplayName: editDisplayName,
      editedSummary: editSummary,
    });
    setEditItem(null);
  };

  const handleAccept = (item: DiscoveryReviewItem) => {
    acceptCandidate(item.reviewId);
  };

  const handleRegen = async () => {
    if (!regenItem) {
      return;
    }
    const ok = await regenCandidate(
      regenItem.reviewId,
      regenFeedback.trim() || null
    );
    if (ok) {
      setRegenItem(null);
      setRegenFeedback("");
    }
  };

  const handleFullRePropose = async () => {
    setReProposeOpen(false);
    await startFullRePropose();
  };

  const handleTypeRetry = async () => {
    if (!typeRetryTarget) {
      return;
    }
    const ok = await retryProposeType(
      typeRetryTarget,
      typeRetryFeedback.trim() || null
    );
    if (ok) {
      setTypeRetryTarget(null);
      setTypeRetryFeedback("");
    }
  };

  const getTypeProposeError = (type: DiscoveryCandidateType) =>
    proposeError?.errors?.find((error) => error.candidateType === type);

  if (
    session.state !== "review_pending" &&
    reviewItems.length === 0 &&
    acceptedStoryUnits.length === 0 &&
    acceptedSceneCandidates.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{discoveryReviewUi.panelTitle}</CardTitle>
          <CardDescription>{discoveryReviewUi.panelDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                isProposing ||
                isRegening ||
                retryingType !== null ||
                session.state !== "review_pending"
              }
              onClick={() => {
                if (hasPendingReviewItems(reviewItems)) {
                  setReProposeOpen(true);
                  return;
                }
                void startFullRePropose();
              }}
            >
              <RefreshCw className="size-4" aria-hidden />
              {isProposing
                ? discoveryReviewUi.fullReProposing
                : discoveryReviewUi.fullRePropose}
            </Button>
          </div>

          {regenError ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {regenError.code}: {regenError.message}
            </div>
          ) : null}

          {retryTypeError ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {retryTypeError.code}: {retryTypeError.message}
            </div>
          ) : null}

          {acceptError ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {acceptError.code}: {acceptError.message}
              {acceptError.fieldErrors?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {acceptError.fieldErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {DISCOVERY_CANDIDATE_TYPES.map((type) => {
            const typedItems = reviewItems.filter(
              (item) => item.candidate.candidateType === type
            );
            const showEmpty = typedItems.length === 0 && failedTypes.has(type);

            if (typedItems.length === 0 && !showEmpty) {
              return null;
            }

            return (
              <div key={type} className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {DISCOVERY_CANDIDATE_TYPE_LABELS[type]}
                </h3>
                {showEmpty ? (
                  <div className="space-y-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p>{discoveryReviewUi.typeProposeFailed}</p>
                    {getTypeProposeError(type) ? (
                      <p className="text-xs text-amber-800/90">
                        {getTypeProposeError(type)?.code}:{" "}
                        {getTypeProposeError(type)?.message}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        isProposing ||
                        isRegening ||
                        retryingType !== null ||
                        session.state !== "review_pending"
                      }
                      onClick={() => {
                        setTypeRetryTarget(type);
                        setTypeRetryFeedback("");
                      }}
                    >
                      {retryingType === type
                        ? discoveryReviewUi.retryingType
                        : discoveryReviewUi.retryType(
                            DISCOVERY_CANDIDATE_TYPE_LABELS[type]
                          )}
                    </Button>
                  </div>
                ) : null}
                <ul className="space-y-3">
                  {typedItems.map((item) => {
                    const actionable =
                      item.status === "pending" ||
                      item.status === "edited_pending_accept";
                    const canEdit = canEditReviewItem(item.status);
                    const busy =
                      isRegening && regenReviewId === item.reviewId;

                    return (
                      <li
                        key={item.reviewId}
                        className="space-y-3 rounded-lg border border-zinc-200 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              {getEffectiveDisplayName(item)}
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {getEffectiveSummary(item)}
                            </p>
                          </div>
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            {statusLabel(item.status)}
                            {item.candidate.confidence
                              ? ` · ${confidenceLabel(item.candidate.confidence)}`
                              : ""}
                          </span>
                        </div>

                        <div>
                          <p className="mb-1 text-xs font-medium text-zinc-700">
                            {candidateFieldLabel("fields")}
                          </p>
                          <FieldsPreview fields={getEffectiveFields(item)} />
                        </div>

                        {item.candidate.evidence?.length ? (
                          <div>
                            <p className="mb-1 text-xs font-medium text-zinc-700">
                              {candidateFieldLabel("evidence")}
                            </p>
                            <ul className="space-y-2 text-xs">
                              {item.candidate.evidence.map((ref, index) => (
                                <li
                                  key={`${ref.sourceLabel}-${index}`}
                                  className="rounded border border-zinc-100 bg-zinc-50 p-2"
                                >
                                  <div className="font-medium">
                                    {ref.sourceLabel}
                                    {ref.tier
                                      ? ` (${discoveryReviewUi.tierLabel(ref.tier)})`
                                      : ""}
                                  </div>
                                  {ref.excerpt ? (
                                    <p className="text-muted-foreground mt-1">
                                      {ref.excerpt}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {actionable ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAccept(item)}
                            >
                              {discoveryReviewUi.accept}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(item)}
                            >
                              {discoveryReviewUi.edit}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => discardCandidate(item.reviewId)}
                            >
                              {discoveryReviewUi.discard}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy || isProposing || retryingType !== null}
                              onClick={() => {
                                setRegenItem(item);
                                setRegenFeedback("");
                              }}
                            >
                              {busy
                                ? discoveryReviewUi.regening
                                : discoveryReviewUi.regen}
                            </Button>
                          </div>
                        ) : null}

                        {item.status === "accepted" &&
                        (item.candidate.candidateType === "character" ||
                          item.candidate.candidateType === "location") ? (
                          <div className="flex flex-wrap gap-2">
                            {canEdit ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(item)}
                              >
                                {discoveryReviewUi.edit}
                              </Button>
                            ) : null}
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={buildEntityCreateHandoffPath(
                                  session.workId,
                                  item.reviewId,
                                  item.candidate.candidateType
                                )}
                              >
                                {item.candidate.candidateType === "character"
                                  ? discoveryReviewUi.goCreateCharacter
                                  : discoveryReviewUi.goCreateLocation}
                              </Link>
                            </Button>
                            <p className="text-muted-foreground self-center text-xs">
                              {discoveryReviewUi.editAfterAcceptHint}
                            </p>
                          </div>
                        ) : null}

                        {item.status === "accepted" &&
                        (item.candidate.candidateType === "story" ||
                          item.candidate.candidateType === "scene") &&
                        canEdit ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(item)}
                            >
                              {discoveryReviewUi.edit}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {acceptedStoryUnits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {discoveryReviewUi.acceptedStoryStaging}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {acceptedStoryUnits.map((unit) => (
                <li key={unit.sourceReviewId} className="rounded border p-3">
                  <div className="font-medium">{unit.title}</div>
                  <p className="text-muted-foreground">{unit.summary}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {acceptedSceneCandidates.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {discoveryReviewUi.acceptedSceneStaging}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {acceptedSceneCandidates.map((scene) => (
                <li key={scene.sourceReviewId} className="rounded border p-3">
                  <div className="font-medium">{scene.title}</div>
                  {scene.summary ? (
                    <p className="text-muted-foreground">{scene.summary}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={editItem !== null} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{discoveryReviewUi.editDialogTitle}</DialogTitle>
            <DialogDescription>
              {editItem?.status === "accepted"
                ? discoveryReviewUi.editDialogAccepted
                : discoveryReviewUi.editDialogPending}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-display-name">
                {candidateFieldLabel("displayName")}
              </Label>
              <Input
                id="edit-display-name"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-summary">
                {candidateFieldLabel("summary")}
              </Label>
              <Textarea
                id="edit-summary"
                value={editSummary}
                rows={3}
                onChange={(e) => setEditSummary(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-fields">
                {discoveryReviewUi.fieldsJsonLabel}
              </Label>
              <Textarea
                id="edit-fields"
                value={editFieldsJson}
                rows={8}
                className="font-mono text-xs"
                onChange={(e) => {
                  setEditFieldsJson(e.target.value);
                  setEditParseError(null);
                }}
              />
              {editParseError ? (
                <p className="text-destructive text-xs">{editParseError}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditItem(null)}>
              {discoveryComposerUi.cancel}
            </Button>
            <Button type="button" onClick={handleSaveEdit}>
              保存编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenItem !== null} onOpenChange={(open) => !open && setRegenItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{discoveryReviewUi.regenDialogTitle}</DialogTitle>
            <DialogDescription>
              {discoveryReviewUi.regenDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={discoveryReviewUi.feedbackPlaceholder}
            value={regenFeedback}
            rows={4}
            onChange={(e) => setRegenFeedback(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRegenItem(null)}>
              {discoveryComposerUi.cancel}
            </Button>
            <Button
              type="button"
              disabled={isRegening}
              onClick={() => void handleRegen()}
            >
              {isRegening
                ? discoveryReviewUi.regening
                : discoveryReviewUi.confirmRegen}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={typeRetryTarget !== null}
        onOpenChange={(open) => !open && setTypeRetryTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {typeRetryTarget
                ? discoveryReviewUi.retryTypeDialogTitle(
                    DISCOVERY_CANDIDATE_TYPE_LABELS[typeRetryTarget]
                  )
                : ""}
            </DialogTitle>
            <DialogDescription>
              {discoveryReviewUi.retryTypeDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={discoveryReviewUi.feedbackPlaceholder}
            value={typeRetryFeedback}
            rows={4}
            onChange={(e) => setTypeRetryFeedback(e.target.value)}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTypeRetryTarget(null)}
            >
              {discoveryComposerUi.cancel}
            </Button>
            <Button
              type="button"
              disabled={retryingType !== null}
              onClick={() => void handleTypeRetry()}
            >
              {retryingType
                ? discoveryReviewUi.retrying
                : discoveryReviewUi.confirmRetry}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reProposeOpen} onOpenChange={setReProposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{discoveryReviewUi.fullReProposeConfirmTitle}</DialogTitle>
            <DialogDescription>
              {discoveryReviewUi.fullReProposeConfirmDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReProposeOpen(false)}>
              {discoveryComposerUi.cancel}
            </Button>
            <Button type="button" onClick={() => void handleFullRePropose()}>
              {discoveryReviewUi.confirmFullRePropose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
