"use client";

import { ChevronRight, RefreshCw } from "lucide-react";
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
import {
  StepTabsList,
  StepTabsTrigger,
  Tabs,
  TabsContent,
} from "@/components/ui/tabs";
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
  findReviewItem,
  isStoryOrSceneAcceptedInStaging,
} from "@/lib/discovery/review-state";
import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import {
  loadRolloutQueue,
  ROLLOUT_QUEUE_UPDATED_EVENT,
} from "@/lib/rollout/rollout-queue-storage";
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

function StepBadge({ step }: { step: number }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold
        border-border bg-muted text-muted-foreground
        group-data-[state=active]/step:border-transparent group-data-[state=active]/step:bg-primary group-data-[state=active]/step:text-primary-foreground"
    >
      {step}
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-primary/10 text-primary inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-normal tabular-nums">
      {count}
    </span>
  );
}

function FlowHint({
  text,
  nextLabel,
  onNext,
  href,
}: {
  text: string;
  nextLabel?: string;
  onNext?: () => void;
  href?: string;
}) {
  return (
    <div className="mt-5 flex items-center justify-between border-t pt-3">
      <p className="text-muted-foreground text-xs">{text}</p>
      {nextLabel && onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          {nextLabel}
          <ChevronRight className="size-3.5" />
        </button>
      ) : nextLabel && href ? (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          {nextLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** Pipeline breadcrumb showing the full Discovery → Rollout flow. */
function PipelineBreadcrumb({ activeStep }: { activeStep: string }) {
  const steps = [
    { id: "review", label: "① 待审核" },
    { id: "accepted", label: "② 已采纳暂存" },
    { id: "rollout", label: "Rollout 投影", external: true },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs" aria-hidden="true">
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          {i > 0 && (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span
            className={
              step.id === activeStep
                ? "rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary"
                : step.external
                  ? "rounded border px-1.5 py-0.5 text-muted-foreground"
                  : "text-muted-foreground"
            }
          >
            {step.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
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

function storyStagingToReviewItem(
  unit: AcceptedStoryUnitStaging
): DiscoveryReviewItem {
  return {
    reviewId: unit.sourceReviewId,
    status: "accepted",
    candidate: {
      candidateId: unit.sourceReviewId,
      workId: unit.workId,
      candidateType: "story",
      displayName: unit.title,
      summary: unit.summary,
      fields: {
        title: unit.title,
        summary: unit.summary,
        ...(unit.boundaryHint ? { boundaryHint: unit.boundaryHint } : {}),
      },
    },
  };
}

function sceneStagingToReviewItem(
  scene: AcceptedSceneCandidateStaging
): DiscoveryReviewItem {
  return {
    reviewId: scene.sourceReviewId,
    status: "accepted",
    candidate: {
      candidateId: scene.sourceReviewId,
      workId: scene.workId,
      candidateType: "scene",
      displayName: scene.title,
      summary: scene.summary ?? "",
      fields: {
        title: scene.title,
        chapter_number: scene.chapter_number,
        chapter_title: scene.chapter_title,
        ...(scene.summary ? { summary: scene.summary } : {}),
      },
    },
  };
}

export function DiscoveryReviewPanel({ discovery }: DiscoveryReviewPanelProps) {
  const {
    workId,
    operatorId,
    session,
    proposeError,
    reviewItems,
    activeReviewItems,
    acceptedStoryUnits,
    acceptedSceneCandidates,
    isProposing,
    isRegening,
    regenReviewId,
    regenError,
    acceptError,
    discardCandidate,
    revokeStagingAccept,
    saveCandidateEdit,
    saveStoryStagingEdit,
    saveSceneStagingEdit,
    regenCandidate,
    acceptCandidate,
    startFullRePropose,
    retryProposeType,
    retryingType,
    retryTypeError,
  } = discovery;

  const rolloutHref = `/works/${encodeURIComponent(session.workId)}/rollout`;

  const [rolloutQueue, setRolloutQueue] = React.useState(() =>
    loadRolloutQueue(workId, operatorId)
  );

  React.useEffect(() => {
    const reload = () => setRolloutQueue(loadRolloutQueue(workId, operatorId));
    reload();
    const onQueueUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ workId?: string; operatorId?: string }>)
        .detail;
      if (detail?.workId === workId && detail?.operatorId === operatorId) {
        reload();
      }
    };
    window.addEventListener(ROLLOUT_QUEUE_UPDATED_EVENT, onQueueUpdated);
    return () => {
      window.removeEventListener(ROLLOUT_QUEUE_UPDATED_EVENT, onQueueUpdated);
    };
  }, [workId, operatorId]);

  const processedStoryIds = React.useMemo(
    () => new Set(rolloutQueue.processedStoryReviewIds ?? []),
    [rolloutQueue.processedStoryReviewIds]
  );
  const processedSceneIds = React.useMemo(
    () => new Set(rolloutQueue.processedSceneReviewIds ?? []),
    [rolloutQueue.processedSceneReviewIds]
  );

  const visibleAcceptedStoryUnits = React.useMemo(
    () =>
      acceptedStoryUnits.filter(
        (unit) => !processedStoryIds.has(unit.sourceReviewId)
      ),
    [acceptedStoryUnits, processedStoryIds]
  );
  const visibleAcceptedSceneCandidates = React.useMemo(
    () =>
      acceptedSceneCandidates.filter(
        (scene) => !processedSceneIds.has(scene.sourceReviewId)
      ),
    [acceptedSceneCandidates, processedSceneIds]
  );

  const reviewListItems = React.useMemo(
    () => activeReviewItems.filter((item) => !isStoryOrSceneAcceptedInStaging(item)),
    [activeReviewItems]
  );

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

  const openEditByReviewId = (reviewId: string) => {
    const item = findReviewItem(reviewItems, reviewId);
    if (item) {
      openEdit(item);
      return;
    }
    const story = acceptedStoryUnits.find((unit) => unit.sourceReviewId === reviewId);
    if (story) {
      openEdit(storyStagingToReviewItem(story));
      return;
    }
    const scene = acceptedSceneCandidates.find(
      (candidate) => candidate.sourceReviewId === reviewId
    );
    if (scene) {
      openEdit(sceneStagingToReviewItem(scene));
    }
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

    const payload = {
      editedFields: parsed,
      editedDisplayName: editDisplayName,
      editedSummary: editSummary,
    };

    if (editItem.candidate.candidateType === "story") {
      saveStoryStagingEdit(editItem.reviewId, payload);
    } else if (editItem.candidate.candidateType === "scene") {
      saveSceneStagingEdit(editItem.reviewId, payload);
    } else {
      saveCandidateEdit(editItem.reviewId, payload);
    }
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

  const acceptedCount =
    visibleAcceptedStoryUnits.length + visibleAcceptedSceneCandidates.length;

  const defaultTab =
    reviewListItems.length === 0 && acceptedCount > 0 ? "accepted" : "review";

  const [activeTab, setActiveTab] = React.useState(defaultTab);

  if (
    session.state !== "review_pending" &&
    session.state !== "narrative_locked" &&
    reviewListItems.length === 0 &&
    failedTypes.size === 0 &&
    visibleAcceptedStoryUnits.length === 0 &&
    visibleAcceptedSceneCandidates.length === 0
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
          {/* Toolbar */}
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
                if (hasPendingReviewItems(activeReviewItems)) {
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

          {/* Errors */}
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

          {/* Pipeline breadcrumb */}
          <PipelineBreadcrumb activeStep={activeTab} />

          {/* Step tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <StepTabsList className="mb-2">
              <StepTabsTrigger value="review">
                <StepBadge step={1} />
                {discoveryReviewUi.tabReview}
                <CountBadge count={reviewListItems.length} />
              </StepTabsTrigger>
              <ChevronRight
                className="mx-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <StepTabsTrigger value="accepted">
                <StepBadge step={2} />
                {discoveryReviewUi.tabAccepted}
                <CountBadge count={acceptedCount} />
              </StepTabsTrigger>
            </StepTabsList>

            {/* ── Tab 1: 待审核 ── */}
            <TabsContent value="review" className="min-h-72 space-y-4">
              {reviewListItems.length === 0 && !failedTypes.size ? (
                <p className="text-muted-foreground text-sm">
                  {discoveryReviewUi.noReviewItems}
                </p>
              ) : null}

              {DISCOVERY_CANDIDATE_TYPES.map((type) => {
                const typedItems = reviewListItems.filter(
                  (item) => item.candidate.candidateType === type
                );
                const showEmpty = typedItems.length === 0 && failedTypes.has(type);

                if (typedItems.length === 0 && !showEmpty) return null;

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
                            (session.state !== "review_pending" && session.state !== "narrative_locked")
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
                                  disabled={
                                    busy || isProposing || retryingType !== null
                                  }
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
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEdit(item)}
                                >
                                  {discoveryReviewUi.edit}
                                </Button>
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
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              <FlowHint
                text={
                  reviewListItems.length > 0
                    ? discoveryReviewUi.flowHintReview
                    : discoveryReviewUi.flowHintReviewDone
                }
                nextLabel={
                  acceptedCount > 0
                    ? discoveryReviewUi.nextStepAccepted
                    : undefined
                }
                onNext={acceptedCount > 0 ? () => setActiveTab("accepted") : undefined}
              />
            </TabsContent>

            {/* ── Tab 2: 已采纳暂存 ── */}
            <TabsContent value="accepted" className="min-h-72 space-y-6">
              {/* Accepted story units */}
              {visibleAcceptedStoryUnits.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {discoveryReviewUi.acceptedStoryStaging}
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {visibleAcceptedStoryUnits.map((unit) => (
                      <li
                        key={unit.sourceReviewId}
                        className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{unit.title}</div>
                          <p className="text-muted-foreground">{unit.summary}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openEditByReviewId(unit.sourceReviewId)
                            }
                          >
                            {discoveryReviewUi.edit}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  discoveryReviewUi.confirmRevokeAccept
                                )
                              ) {
                                return;
                              }
                              revokeStagingAccept(unit.sourceReviewId, "story");
                            }}
                          >
                            {discoveryReviewUi.revokeAccept}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Accepted scene candidates */}
              {visibleAcceptedSceneCandidates.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {discoveryReviewUi.acceptedSceneStaging}
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {visibleAcceptedSceneCandidates.map((scene) => (
                      <li
                        key={scene.sourceReviewId}
                        className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{scene.title}</div>
                          <p className="text-muted-foreground">
                            Ch.{scene.chapter_number}
                            {scene.chapter_title
                              ? ` — ${scene.chapter_title}`
                              : ""}
                          </p>
                          {scene.summary ? (
                            <p className="text-muted-foreground mt-1">
                              {scene.summary}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openEditByReviewId(scene.sourceReviewId)
                            }
                          >
                            {discoveryReviewUi.edit}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  discoveryReviewUi.confirmRevokeAccept
                                )
                              ) {
                                return;
                              }
                              revokeStagingAccept(scene.sourceReviewId, "scene");
                            }}
                          >
                            {discoveryReviewUi.revokeAccept}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-3 text-xs">
                    {discoveryReviewUi.editAfterAcceptSceneHint}
                  </p>
                </div>
              ) : null}

              {acceptedCount === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {discoveryReviewUi.flowHintAcceptedEmpty}
                </p>
              ) : null}

              <FlowHint
                text={
                  acceptedCount > 0
                    ? discoveryReviewUi.flowHintAccepted
                    : discoveryReviewUi.flowHintAcceptedEmpty
                }
                nextLabel={
                  acceptedCount > 0
                    ? discoveryReviewUi.nextStepRollout
                    : undefined
                }
                href={acceptedCount > 0 ? rolloutHref : undefined}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
