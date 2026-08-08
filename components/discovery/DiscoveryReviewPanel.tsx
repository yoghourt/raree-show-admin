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
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import type { UseRolloutReturn } from "@/hooks/useRollout";
import { RolloutPanel } from "@/components/rollout/RolloutPanel";
import * as charactersApi from "@/lib/characters";
import { findExistingByName } from "@/lib/discovery/entity-catalog-match";
import * as locationsApi from "@/lib/locations";
import type { Character, Location } from "@/lib/types";
import {
  parseCharacterArchive,
  type CharacterArchive,
} from "@/lib/discovery/character-archive";
import {
  type CharacterCandidateFields,
  type DiscoveryCandidateFields,
  type DiscoveryCandidateType,
  type SceneCandidateFields,
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
  DiscoveryReviewItem,
} from "@/lib/discovery/review-types";
import {
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import { messages } from "@/lib/locale";
import {
  loadRolloutQueue,
  ROLLOUT_QUEUE_UPDATED_EVENT,
} from "@/lib/rollout/rollout-queue-storage";
import {
  CONFIDENCE_LABELS,
  DISCOVERY_CANDIDATE_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  candidateFieldLabel,
  discoveryComposerUi,
  discoveryApiErrorText,
  discoveryReviewUi,
} from "@/lib/discovery/ui-copy";

export interface DiscoveryReviewPanelProps {
  discovery: UseDiscoverySessionReturn;
  rollout?: UseRolloutReturn;
  initialStep?: "review" | "rollout";
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

/** Compact step hint: 确认 → 写入作品 */
function PipelineBreadcrumb({ activeStep }: { activeStep: string }) {
  const steps = [
    { id: "review", label: discoveryReviewUi.tabReview },
    { id: "rollout", label: messages.discovery.tabRollout },
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

function readCharacterArchive(
  fields: DiscoveryCandidateFields
): CharacterArchive | null {
  const raw = (fields as CharacterCandidateFields).characterArchive;
  const parsed = parseCharacterArchive(raw);
  return parsed.ok ? parsed.value : null;
}

function CharacterArchivePreview({ archive }: { archive: CharacterArchive }) {
  const costume =
    archive.costumeCues.length > 0
      ? archive.costumeCues.join(" · ")
      : discoveryReviewUi.characterArchiveCueNone;
  const props =
    archive.propCues.length > 0
      ? archive.propCues.join(" · ")
      : discoveryReviewUi.characterArchiveCueNone;
  return (
    <div className="space-y-1 rounded-md border border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-xs">
      {archive.visualSummary ? (
        <p className="text-zinc-700">
          <span className="text-muted-foreground font-medium">
            {candidateFieldLabel("visualSummary")}：
          </span>
          {archive.visualSummary}
        </p>
      ) : null}
      <p className="text-zinc-700">
        <span className="text-muted-foreground font-medium">
          {candidateFieldLabel("costumeCues")}：
        </span>
        {costume}
      </p>
      <p className="text-zinc-700">
        <span className="text-muted-foreground font-medium">
          {candidateFieldLabel("propCues")}：
        </span>
        {props}
      </p>
    </div>
  );
}

function formatFieldValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function FieldsPreview({
  fields,
  candidateType,
}: {
  fields: DiscoveryCandidateFields;
  candidateType?: DiscoveryCandidateType;
}) {
  const archive =
    candidateType === "character" ? readCharacterArchive(fields) : null;

  const entries = Object.entries(
    fields as unknown as Record<string, unknown>
  ).filter(([key, value]) => {
    if (value === undefined || value === null || value === "") return false;
    // 画面只展示标题与摘要；章节序号等归属故事
    if (candidateType === "scene") {
      return key === "title" || key === "summary";
    }
    // characterArchive rendered as structured block below
    if (key === "characterArchive") return false;
    return true;
  });

  if (entries.length === 0 && !archive && candidateType !== "character") {
    return (
      <p className="text-muted-foreground text-xs">{discoveryReviewUi.noFields}</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.length > 0 ? (
        <dl className="grid gap-1 text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-muted-foreground font-medium">
                {candidateFieldLabel(key)}
              </dt>
              <dd className="break-words">{formatFieldValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {candidateType === "character" ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            {candidateFieldLabel("characterArchive")}
          </p>
          {archive ? (
            <CharacterArchivePreview archive={archive} />
          ) : (
            <p className="text-amber-800/90 text-xs">
              {discoveryReviewUi.characterArchiveEmptyHint}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function storyStagingToReviewItem(
  unit: AcceptedStoryUnitStaging
): DiscoveryReviewItem {
  return {
    reviewId: unit.sourceReviewId,
    status: "accepted",
    candidate: {
      candidateId: unit.sourceCandidateId || unit.sourceReviewId,
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
        // 父子与章节属故事侧数据；画面 UI 仅展示 title/summary
        parentStoryCandidateId: scene.parentStorySourceReviewId ?? "",
        chapter_number: scene.chapter_number,
        ...(scene.chapter_title != null
          ? { chapter_title: scene.chapter_title }
          : {}),
        title: scene.title,
        ...(scene.summary ? { summary: scene.summary } : {}),
        ...(scene.visualIntent ? { visualIntent: scene.visualIntent } : {}),
        rendererExpression: scene.rendererExpression ?? {
          environment: "unspecified place",
          characters: [],
          action: "empty scene",
          composition: "wide view",
        },
      },
    },
  };
}

function ReviewItemCard({
  item,
  busy,
  actionable,
  showAccept = true,
  acceptLabel,
  existingBadge,
  onAccept,
  onEdit,
  onDiscard,
  onRegen,
}: {
  item: DiscoveryReviewItem;
  busy: boolean;
  actionable: boolean;
  showAccept?: boolean;
  acceptLabel?: string;
  /** When set, show catalog match status (e.g. 已存在). */
  existingBadge?: string | null;
  onAccept: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onRegen: () => void;
}) {
  const fields = getEffectiveFields(item);
  const archivePresent =
    item.candidate.candidateType === "character" &&
    readCharacterArchive(fields) !== null;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{getEffectiveDisplayName(item)}</span>
            {existingBadge ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {existingBadge}
              </span>
            ) : null}
            {item.candidate.candidateType === "character" ? (
              <span
                className={
                  archivePresent
                    ? "rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900"
                    : "rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
                }
              >
                {archivePresent
                  ? discoveryReviewUi.characterArchivePresent
                  : discoveryReviewUi.characterArchiveMissing}
              </span>
            ) : null}
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
      <FieldsPreview
        fields={fields}
        candidateType={item.candidate.candidateType}
      />
      {item.candidate.evidence?.length ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            {candidateFieldLabel("evidence")}
          </p>
          <ul className="space-y-1 text-xs">
            {item.candidate.evidence.map((ev, i) => (
              <li key={`${ev.sourceLabel}-${i}`}>
                <span className="font-medium">{ev.sourceLabel}</span>
                {ev.tier != null
                  ? ` · ${discoveryReviewUi.tierLabel(ev.tier)}`
                  : ""}
                {ev.excerpt ? (
                  <span className="text-muted-foreground"> — {ev.excerpt}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {discoveryReviewUi.verifiedSourceNote}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {actionable ? (
          <>
            {showAccept ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={onAccept}
              >
                {acceptLabel ?? discoveryReviewUi.accept}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onEdit}
            >
              {discoveryReviewUi.edit}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onRegen}
            >
              {busy ? discoveryReviewUi.regening : discoveryReviewUi.regen}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onDiscard}
            >
              {discoveryReviewUi.discard}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function DiscoveryReviewPanel({
  discovery,
  rollout,
  initialStep,
}: DiscoveryReviewPanelProps) {
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

  const [characterCatalog, setCharacterCatalog] = React.useState<Character[]>(
    []
  );
  const [locationCatalog, setLocationCatalog] = React.useState<Location[]>([]);

  React.useEffect(() => {
    if (!workId) return;
    let cancelled = false;
    (async () => {
      try {
        const [characters, locations] = await Promise.all([
          charactersApi.getAll(workId),
          locationsApi.getAll(workId),
        ]);
        if (!cancelled) {
          setCharacterCatalog(characters);
          setLocationCatalog(locations);
        }
      } catch {
        if (!cancelled) {
          setCharacterCatalog([]);
          setLocationCatalog([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId]);

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
    () => new Set(rolloutQueue.processedReadingRouteReviewIds ?? []),
    [rolloutQueue.processedReadingRouteReviewIds]
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
    const fields = getEffectiveFields(item);
    const fieldsForEdit =
      item.candidate.candidateType === "scene"
        ? {
            title:
              typeof (fields as SceneCandidateFields).title === "string"
                ? (fields as SceneCandidateFields).title
                : getEffectiveDisplayName(item),
            ...((fields as SceneCandidateFields).summary ||
            getEffectiveSummary(item)
              ? {
                  summary:
                    (fields as SceneCandidateFields).summary ||
                    getEffectiveSummary(item),
                }
              : {}),
          }
        : fields;
    setEditFieldsJson(JSON.stringify(fieldsForEdit, null, 2));
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
    if (editItem.candidate.candidateType === "scene") {
      const original = getEffectiveFields(editItem) as SceneCandidateFields;
      parsed = {
        parentStoryCandidateId: original.parentStoryCandidateId,
        chapter_number: original.chapter_number,
        ...(original.chapter_title != null
          ? { chapter_title: original.chapter_title }
          : {}),
        title:
          typeof parsedRecord.title === "string" ? parsedRecord.title : "",
        ...(typeof parsedRecord.summary === "string" && parsedRecord.summary
          ? { summary: parsedRecord.summary }
          : editSummary.trim()
            ? { summary: editSummary.trim() }
            : {}),
        ...(original.visualIntent
          ? { visualIntent: original.visualIntent }
          : {}),
        rendererExpression: original.rendererExpression,
      };
    } else {
      parsed = parsedRecord as unknown as DiscoveryCandidateFields;
    }

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
    void acceptCandidate(item.reviewId);
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

  const rolloutPendingCount = rollout
    ? rollout.queue.storyStaging.length +
      rollout.queue.readingRouteStaging.length
    : 0;

  const hasRolloutSurface =
    Boolean(rollout) &&
    (rolloutPendingCount > 0 ||
      (rollout?.storyUnits.length ?? 0) > 0 ||
      acceptedCount > 0);

  const defaultTab =
    initialStep === "rollout" && rollout ? "rollout" : "review";

  const [activeTab, setActiveTab] = React.useState(defaultTab);
  const [confirmSubTab, setConfirmSubTab] = React.useState(
    reviewListItems.length === 0 && acceptedCount > 0 ? "accepted" : "pending"
  );

  React.useEffect(() => {
    if (initialStep === "rollout" && rollout) {
      setActiveTab("rollout");
    }
  }, [initialStep, rollout]);

  React.useEffect(() => {
    if (reviewListItems.length === 0 && acceptedCount > 0) {
      setConfirmSubTab("accepted");
    } else if (reviewListItems.length > 0 && confirmSubTab === "accepted" && acceptedCount === 0) {
      setConfirmSubTab("pending");
    }
  }, [reviewListItems.length, acceptedCount, confirmSubTab]);

  React.useEffect(() => {
    if (activeTab !== "rollout" || !rollout) {
      return;
    }
    void rollout.refresh();
    rollout.importFromDiscovery();
    // Only when entering the write step.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional tab-enter sync
  }, [activeTab]);

  if (
    session.state !== "review_pending" &&
    session.state !== "narrative_locked" &&
    reviewListItems.length === 0 &&
    failedTypes.size === 0 &&
    visibleAcceptedStoryUnits.length === 0 &&
    visibleAcceptedSceneCandidates.length === 0 &&
    !hasRolloutSurface
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
              className={
                regenError.code === "NARRATIVE_NOT_LOCKED"
                  ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  : "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              }
              role="alert"
            >
              {discoveryApiErrorText(regenError)}
            </div>
          ) : null}

          {retryTypeError ? (
            <div
              className={
                retryTypeError.code === "NARRATIVE_NOT_LOCKED"
                  ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  : "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              }
              role="alert"
            >
              {discoveryApiErrorText(retryTypeError)}
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
                {discoveryReviewUi.tabReview}
                <CountBadge
                  count={reviewListItems.length + acceptedCount}
                />
              </StepTabsTrigger>
              {rollout ? (
                <>
                  <ChevronRight
                    className="mx-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <StepTabsTrigger value="rollout">
                    {messages.discovery.tabRollout}
                    <CountBadge count={rolloutPendingCount} />
                  </StepTabsTrigger>
                </>
              ) : null}
            </StepTabsList>

            {/* ── Tab 1: 确认（内分子 tab：待确认 / 已确认）── */}
            <TabsContent value="review" className="min-h-72 space-y-4">
              <Tabs
                value={confirmSubTab}
                onValueChange={setConfirmSubTab}
                className="w-full"
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">
                    {discoveryReviewUi.tabPendingConfirm}
                    <CountBadge count={reviewListItems.length} />
                  </TabsTrigger>
                  <TabsTrigger value="accepted">
                    {discoveryReviewUi.tabAccepted}
                    <CountBadge count={acceptedCount} />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-4">
              {reviewListItems.length === 0 && !failedTypes.size ? (
                <p className="text-muted-foreground text-sm">
                  {discoveryReviewUi.noReviewItems}
                </p>
              ) : null}

              {(["character", "location", "story", "scene"] as DiscoveryCandidateType[])
                .filter((type) => failedTypes.has(type))
                .map((type) => (
                  <div
                    key={`fail-${type}`}
                    className="space-y-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  >
                    <p className="font-medium">
                      {DISCOVERY_CANDIDATE_TYPE_LABELS[type]}
                    </p>
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
                        (session.state !== "review_pending" &&
                          session.state !== "narrative_locked")
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
                ))}

              {/* Story-centric: characters / locations / frames under each story */}
              {(() => {
                const storyItems = reviewListItems.filter(
                  (item) => item.candidate.candidateType === "story"
                );
                const sceneItems = reviewListItems.filter(
                  (item) => item.candidate.candidateType === "scene"
                );
                const characterItems = reviewListItems.filter(
                  (item) => item.candidate.candidateType === "character"
                );
                const locationItems = reviewListItems.filter(
                  (item) => item.candidate.candidateType === "location"
                );
                const storyIds = new Set(
                  storyItems.map((item) => item.candidate.candidateId)
                );
                const orphanScenes = sceneItems.filter((item) => {
                  const parent = (
                    getEffectiveFields(item) as SceneCandidateFields
                  ).parentStoryCandidateId;
                  return !parent || !storyIds.has(parent);
                });

                const entityBadge = (item: DiscoveryReviewItem) => {
                  const name = getEffectiveDisplayName(item);
                  if (item.candidate.candidateType === "character") {
                    return findExistingByName(name, characterCatalog)
                      ? discoveryReviewUi.alreadyExists
                      : discoveryReviewUi.willCreateOnWrite;
                  }
                  if (item.candidate.candidateType === "location") {
                    return findExistingByName(name, locationCatalog)
                      ? discoveryReviewUi.alreadyExists
                      : discoveryReviewUi.willCreateOnWrite;
                  }
                  return null;
                };

                if (
                  storyItems.length === 0 &&
                  sceneItems.length === 0 &&
                  characterItems.length === 0 &&
                  locationItems.length === 0
                ) {
                  return null;
                }

                return (
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-xs">
                      {discoveryReviewUi.storyCentricHint}
                    </p>
                    <ul className="space-y-6">
                      {storyItems.map((story) => {
                        const childScenes = sceneItems.filter((item) => {
                          const parent = (
                            getEffectiveFields(item) as SceneCandidateFields
                          ).parentStoryCandidateId;
                          return parent === story.candidate.candidateId;
                        });
                        const actionable =
                          story.status === "pending" ||
                          story.status === "edited_pending_accept";
                        const busy =
                          isRegening && regenReviewId === story.reviewId;
                        const storyRelated = aggregateStoryRelatedRefs({
                          sceneSources: childScenes.map((scene) => {
                            const fields = getEffectiveFields(
                              scene
                            ) as SceneCandidateFields;
                            return {
                              visualIntent: fields.visualIntent,
                              rendererExpression: fields.rendererExpression,
                            };
                          }),
                          archive: {
                            characters: characterCatalog,
                            locations: locationCatalog,
                          },
                        });
                        const storyRelatedLine = formatStoryRelatedAggregateLine(
                          storyRelated,
                          {
                            alreadyExistsLabel: discoveryReviewUi.alreadyExists,
                          }
                        );
                        return (
                          <li
                            key={story.reviewId}
                            className="space-y-4 rounded-xl border border-zinc-200 p-4"
                          >
                            <ReviewItemCard
                              item={story}
                              busy={busy}
                              actionable={actionable}
                              acceptLabel={discoveryReviewUi.acceptWithStoryAttrs}
                              onAccept={() => handleAccept(story)}
                              onEdit={() => openEdit(story)}
                              onDiscard={() =>
                                discardCandidate(story.reviewId)
                              }
                              onRegen={() => {
                                setRegenItem(story);
                                setRegenFeedback("");
                              }}
                            />

                            <div className="ml-2 space-y-0.5 border-l pl-4">
                              <p className="text-muted-foreground text-xs font-medium">
                                {discoveryReviewUi.storyRelatedFromScenes}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {storyRelatedLine ??
                                  discoveryReviewUi.storyRelatedEmpty}
                              </p>
                            </div>

                            {childScenes.length > 0 ? (
                              <div className="ml-2 space-y-2 border-l pl-4">
                                <div className="space-y-0.5">
                                  <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                    {DISCOVERY_CANDIDATE_TYPE_LABELS.scene}
                                  </h4>
                                  {actionable ? (
                                    <p className="text-muted-foreground text-xs">
                                      {discoveryReviewUi.sceneAcceptsWithStory}
                                    </p>
                                  ) : null}
                                </div>
                                <ul className="space-y-3">
                                  {childScenes.map((scene) => {
                                    const sceneActionable =
                                      scene.status === "pending" ||
                                      scene.status === "edited_pending_accept";
                                    return (
                                      <ReviewItemCard
                                        key={scene.reviewId}
                                        item={scene}
                                        busy={
                                          isRegening &&
                                          regenReviewId === scene.reviewId
                                        }
                                        actionable={sceneActionable}
                                        showAccept={false}
                                        onAccept={() => undefined}
                                        onEdit={() => openEdit(scene)}
                                        onDiscard={() =>
                                          discardCandidate(scene.reviewId)
                                        }
                                        onRegen={() => {
                                          setRegenItem(scene);
                                          setRegenFeedback("");
                                        }}
                                      />
                                    );
                                  })}
                                </ul>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}

                      {orphanScenes.length > 0 ? (
                        <li className="space-y-2">
                          <div className="space-y-0.5">
                            <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                              {DISCOVERY_CANDIDATE_TYPE_LABELS.scene}
                              （无匹配故事）
                            </h4>
                            <p className="text-muted-foreground text-xs">
                              {discoveryReviewUi.orphanSceneHint}
                            </p>
                          </div>
                          <ul className="space-y-3">
                            {orphanScenes.map((scene) => (
                              <ReviewItemCard
                                key={scene.reviewId}
                                item={scene}
                                busy={
                                  isRegening &&
                                  regenReviewId === scene.reviewId
                                }
                                actionable={
                                  scene.status === "pending" ||
                                  scene.status === "edited_pending_accept"
                                }
                                showAccept={false}
                                onAccept={() => undefined}
                                onEdit={() => openEdit(scene)}
                                onDiscard={() =>
                                  discardCandidate(scene.reviewId)
                                }
                                onRegen={() => {
                                  setRegenItem(scene);
                                  setRegenFeedback("");
                                }}
                              />
                            ))}
                          </ul>
                        </li>
                      ) : null}

                      {/* L2-A: Work Archive entities — once, not under every Story */}
                      {characterItems.length > 0 ? (
                        <li className="space-y-2 rounded-xl border border-zinc-200 p-4">
                          <div className="space-y-0.5">
                            <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                              {DISCOVERY_CANDIDATE_TYPE_LABELS.character}
                              （作品库）
                            </h4>
                            <p className="text-muted-foreground text-xs">
                              {discoveryReviewUi.entityAcceptsWithStory}
                            </p>
                          </div>
                          <ul className="space-y-3">
                            {characterItems.map((item) => {
                              const itemActionable =
                                item.status === "pending" ||
                                item.status === "edited_pending_accept";
                              return (
                                <ReviewItemCard
                                  key={item.reviewId}
                                  item={item}
                                  busy={
                                    isRegening &&
                                    regenReviewId === item.reviewId
                                  }
                                  actionable={itemActionable}
                                  showAccept={itemActionable}
                                  existingBadge={entityBadge(item)}
                                  onAccept={() => handleAccept(item)}
                                  onEdit={() => openEdit(item)}
                                  onDiscard={() =>
                                    discardCandidate(item.reviewId)
                                  }
                                  onRegen={() => {
                                    setRegenItem(item);
                                    setRegenFeedback("");
                                  }}
                                />
                              );
                            })}
                          </ul>
                        </li>
                      ) : null}

                      {locationItems.length > 0 ? (
                        <li className="space-y-2 rounded-xl border border-zinc-200 p-4">
                          <div className="space-y-0.5">
                            <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                              {DISCOVERY_CANDIDATE_TYPE_LABELS.location}
                              （作品库）
                            </h4>
                            <p className="text-muted-foreground text-xs">
                              {discoveryReviewUi.entityAcceptsWithStory}
                            </p>
                          </div>
                          <ul className="space-y-3">
                            {locationItems.map((item) => {
                              const itemActionable =
                                item.status === "pending" ||
                                item.status === "edited_pending_accept";
                              return (
                                <ReviewItemCard
                                  key={item.reviewId}
                                  item={item}
                                  busy={
                                    isRegening &&
                                    regenReviewId === item.reviewId
                                  }
                                  actionable={itemActionable}
                                  showAccept={itemActionable}
                                  existingBadge={entityBadge(item)}
                                  onAccept={() => handleAccept(item)}
                                  onEdit={() => openEdit(item)}
                                  onDiscard={() =>
                                    discardCandidate(item.reviewId)
                                  }
                                  onRegen={() => {
                                    setRegenItem(item);
                                    setRegenFeedback("");
                                  }}
                                />
                              );
                            })}
                          </ul>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })()}
                </TabsContent>

                <TabsContent value="accepted" className="space-y-4">
                  {visibleAcceptedStoryUnits.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {discoveryReviewUi.flowHintAcceptedEmpty}
                    </p>
                  ) : (
                    <ul className="space-y-4 text-sm">
                      {visibleAcceptedStoryUnits.map((unit) => {
                        const childScenes =
                          visibleAcceptedSceneCandidates.filter(
                            (scene) =>
                              scene.parentStorySourceReviewId ===
                              unit.sourceReviewId
                          );
                        const acceptedRelated = aggregateStoryRelatedRefs({
                          sceneStagings: childScenes,
                          archive: {
                            characters: characterCatalog,
                            locations: locationCatalog,
                          },
                        });
                        const acceptedRelatedLine =
                          formatStoryRelatedAggregateLine(acceptedRelated, {
                            alreadyExistsLabel: discoveryReviewUi.alreadyExists,
                          });
                        return (
                          <li key={unit.sourceReviewId} className="space-y-2">
                            <div className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="font-medium">{unit.title}</div>
                                <p className="text-muted-foreground">
                                  {unit.summary}
                                </p>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  <span className="font-medium">
                                    {discoveryReviewUi.storyRelatedFromScenes}
                                    ：
                                  </span>
                                  {acceptedRelatedLine ??
                                    discoveryReviewUi.storyRelatedEmpty}
                                </p>
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
                                    const hasChildren = childScenes.length > 0;
                                    const msg = hasChildren
                                      ? discoveryReviewUi.confirmRevokeStoryWithScenes
                                      : discoveryReviewUi.confirmRevokeAccept;
                                    if (!window.confirm(msg)) {
                                      return;
                                    }
                                    revokeStagingAccept(
                                      unit.sourceReviewId,
                                      "story"
                                    );
                                  }}
                                >
                                  {discoveryReviewUi.revokeAccept}
                                </Button>
                              </div>
                            </div>
                            {childScenes.length > 0 ? (
                              <div className="ml-4 space-y-2 border-l pl-4">
                                <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                                  {discoveryReviewUi.acceptedSceneStaging}
                                </h4>
                                <ul className="space-y-2">
                                  {childScenes.map((scene) => (
                                    <li
                                      key={scene.sourceReviewId}
                                      className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-medium">
                                          {scene.title}
                                        </div>
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
                                            openEditByReviewId(
                                              scene.sourceReviewId
                                            )
                                          }
                                        >
                                          {discoveryReviewUi.edit}
                                        </Button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>

              <FlowHint
                text={
                  confirmSubTab === "pending"
                    ? reviewListItems.length > 0
                      ? discoveryReviewUi.flowHintReview
                      : discoveryReviewUi.flowHintReviewDone
                    : acceptedCount > 0
                      ? discoveryReviewUi.flowHintAccepted
                      : discoveryReviewUi.flowHintAcceptedEmpty
                }
                nextLabel={
                  acceptedCount > 0 && rollout
                    ? discoveryReviewUi.nextStepRollout
                    : undefined
                }
                onNext={
                  acceptedCount > 0 && rollout
                    ? () => setActiveTab("rollout")
                    : undefined
                }
              />
            </TabsContent>

            {rollout ? (
              <TabsContent value="rollout" className="min-h-72 space-y-4">
                <RolloutPanel
                  workId={workId}
                  rollout={rollout}
                  embedded
                />
              </TabsContent>
            ) : null}

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
