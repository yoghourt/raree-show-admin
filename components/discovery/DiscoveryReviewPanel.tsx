"use client";

import { ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { proposeFrameExpression } from "@/app/actions/proposeFrameExpression";
import { Button } from "@/components/ui/button";
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
import { draftSceneBeatsFromSummary } from "@/lib/discovery/split-scene-beats";
import {
  parseRendererExpression,
  type RendererExpression,
} from "@/lib/discovery/visual-contract";
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
    <div className="mt-2 flex shrink-0 items-center justify-between border-t border-zinc-100 pt-1.5">
      <p className="text-[11px] text-zinc-500">{text}</p>
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
  const identity =
    (archive.identityCues ?? []).length > 0
      ? archive.identityCues!.join(" · ")
      : discoveryReviewUi.characterArchiveCueNone;
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
          {candidateFieldLabel("identityCues")}：
        </span>
        {identity}
      </p>
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
      return (
        key === "title" ||
        key === "summary" ||
        key === "rendererExpression"
      );
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
        summary: scene.summary?.trim() || scene.title,
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

function parentStoryTitleForScene(
  item: DiscoveryReviewItem,
  items: DiscoveryReviewItem[]
): string | undefined {
  const parentId = (getEffectiveFields(item) as SceneCandidateFields)
    .parentStoryCandidateId;
  if (!parentId) return undefined;
  const story = items.find(
    (row) =>
      row.candidate.candidateType === "story" &&
      row.candidate.candidateId === parentId
  );
  return story ? getEffectiveDisplayName(story) : undefined;
}

function characterCuesForExpressionPropose(
  catalog: Character[],
  items: DiscoveryReviewItem[]
): Array<{ name: string; visualIdentity?: string }> {
  const out = new Map<string, { name: string; visualIdentity?: string }>();
  for (const character of catalog) {
    const name = character.name.trim();
    if (!name) continue;
    out.set(name.toLowerCase(), {
      name,
      ...(character.visualIdentity.trim()
        ? { visualIdentity: character.visualIdentity.trim() }
        : {}),
    });
  }
  for (const item of items) {
    if (item.candidate.candidateType !== "character") continue;
    const fields = getEffectiveFields(item) as CharacterCandidateFields;
    const name = (fields.name || getEffectiveDisplayName(item)).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = out.get(key);
    if (existing?.visualIdentity) continue;
    const archive = fields.characterArchive;
    const vis = archive
      ? [
          archive.visualSummary,
          ...(archive.identityCues ?? []),
          ...archive.costumeCues.slice(0, 1),
        ]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(". ")
      : "";
    out.set(key, {
      name,
      ...(vis ? { visualIdentity: vis } : existing ?? {}),
    });
  }
  return [...out.values()];
}

function ReviewItemCard({
  item,
  busy,
  expressionBusy = false,
  actionable,
  showAccept = true,
  acceptDisabled = false,
  acceptLabel,
  existingBadge,
  onAccept,
  onEdit,
  onDiscard,
  onRegen,
  onSplit,
  onReproposeExpression,
}: {
  item: DiscoveryReviewItem;
  busy: boolean;
  expressionBusy?: boolean;
  actionable: boolean;
  showAccept?: boolean;
  acceptDisabled?: boolean;
  acceptLabel?: string;
  /** When set, show catalog match status (e.g. 已存在). */
  existingBadge?: string | null;
  onAccept: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  onRegen: () => void;
  onSplit?: () => void;
  onReproposeExpression?: () => void;
}) {
  const fields = getEffectiveFields(item);
  const archivePresent =
    item.candidate.candidateType === "character" &&
    readCharacterArchive(fields) !== null;
  const locked = busy || expressionBusy;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="truncate text-xs font-medium text-zinc-900">
              {getEffectiveDisplayName(item)}
            </span>
            {existingBadge ? (
              <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-1 py-0 text-[10px] font-medium text-emerald-800">
                {existingBadge}
              </span>
            ) : null}
            {item.candidate.candidateType === "character" ? (
              <span
                className={
                  archivePresent
                    ? "inline-flex rounded border border-sky-200 bg-sky-50 px-1 py-0 text-[10px] font-medium text-sky-900"
                    : "inline-flex rounded border border-amber-200 bg-amber-50 px-1 py-0 text-[10px] font-medium text-amber-900"
                }
              >
                {archivePresent
                  ? discoveryReviewUi.characterArchivePresent
                  : discoveryReviewUi.characterArchiveMissing}
              </span>
            ) : null}
            <span className="inline-flex shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1 py-0 text-[10px] font-medium text-zinc-600">
              {statusLabel(item.status)}
              {item.candidate.confidence
                ? ` · ${confidenceLabel(item.candidate.confidence)}`
                : ""}
            </span>
          </div>
          <p className="truncate text-[11px] leading-tight text-zinc-500">
            {getEffectiveSummary(item)}
          </p>
        </div>
        {actionable ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {showAccept ? (
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-[11px]"
                disabled={locked || acceptDisabled}
                onClick={onAccept}
              >
                {acceptLabel ?? discoveryReviewUi.accept}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={locked}
              onClick={onEdit}
            >
              {discoveryReviewUi.edit}
            </Button>
            {onSplit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                disabled={locked}
                onClick={onSplit}
              >
                {discoveryReviewUi.splitScene}
              </Button>
            ) : null}
            {onReproposeExpression ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-6 px-2 text-[11px]"
                disabled={locked}
                onClick={onReproposeExpression}
                title={discoveryReviewUi.reproposeExpressionHint}
              >
                {expressionBusy
                  ? discoveryReviewUi.reproposingExpression
                  : discoveryReviewUi.reproposeExpression}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={locked}
              onClick={onRegen}
            >
              {busy ? discoveryReviewUi.regening : discoveryReviewUi.regen}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[11px]"
              disabled={locked}
              onClick={onDiscard}
            >
              {discoveryReviewUi.discard}
            </Button>
          </div>
        ) : null}
      </div>
      <details className="text-[11px] text-zinc-500">
        <summary className="cursor-pointer select-none text-zinc-600 hover:text-zinc-900">
          字段 / 证据
        </summary>
        <div className="mt-1 space-y-1 border-t border-zinc-100 pt-1">
          <FieldsPreview
            fields={fields}
            candidateType={item.candidate.candidateType}
          />
          {item.candidate.evidence?.length ? (
            <ul className="space-y-0.5">
              {item.candidate.evidence.map((ev, i) => (
                <li key={`${ev.sourceLabel}-${i}`} className="truncate">
                  <span className="font-medium text-zinc-700">{ev.sourceLabel}</span>
                  {ev.excerpt ? (
                    <span className="text-zinc-500"> — {ev.excerpt}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>{discoveryReviewUi.verifiedSourceNote}</p>
          )}
        </div>
      </details>
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
    acceptedCharacters,
    acceptedLocations,
    isProposing,
    isRegening,
    regenReviewId,
    regenError,
    acceptError,
    granularityGate,
    informationEquivalence,
    discardCandidate,
    revokeStagingAccept,
    saveCandidateEdit,
    saveStoryStagingEdit,
    saveSceneStagingEdit,
    splitSceneIntoBeats,
    isSplitting,
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

  const processedCharacterIds = React.useMemo(
    () => new Set(rolloutQueue.processedCharacterReviewIds ?? []),
    [rolloutQueue.processedCharacterReviewIds]
  );
  const processedLocationIds = React.useMemo(
    () => new Set(rolloutQueue.processedLocationReviewIds ?? []),
    [rolloutQueue.processedLocationReviewIds]
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

  const visibleAcceptedCharacters = React.useMemo(
    () =>
      acceptedCharacters.filter(
        (item) => !processedCharacterIds.has(item.sourceReviewId)
      ),
    [acceptedCharacters, processedCharacterIds]
  );
  const visibleAcceptedLocations = React.useMemo(
    () =>
      acceptedLocations.filter(
        (item) => !processedLocationIds.has(item.sourceReviewId)
      ),
    [acceptedLocations, processedLocationIds]
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

  const [splitItem, setSplitItem] = React.useState<DiscoveryReviewItem | null>(
    null
  );
  const [splitBeats, setSplitBeats] = React.useState<
    Array<{ title: string; summary: string }>
  >([]);
  const [proposingExprReviewId, setProposingExprReviewId] = React.useState<
    string | null
  >(null);
  const [exprProposeError, setExprProposeError] = React.useState<string | null>(
    null
  );

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
            rendererExpression: (fields as SceneCandidateFields)
              .rendererExpression,
            ...((fields as SceneCandidateFields).visualIntent
              ? {
                  visualIntent: (fields as SceneCandidateFields).visualIntent,
                }
              : {}),
          }
        : fields;
    setEditFieldsJson(JSON.stringify(fieldsForEdit, null, 2));
    setEditParseError(null);
  };

  const openSplit = (item: DiscoveryReviewItem) => {
    if (item.candidate.candidateType !== "scene") return;
    const summary = getEffectiveSummary(item);
    const drafts = draftSceneBeatsFromSummary(summary, {
      titleHint: getEffectiveDisplayName(item),
    });
    setSplitItem(item);
    setSplitBeats(
      drafts.length >= 2
        ? drafts
        : [
            { title: getEffectiveDisplayName(item), summary },
            { title: "Beat 2", summary: "" },
          ]
    );
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
      const exprParsed = parseRendererExpression(
        parsedRecord.rendererExpression ?? original.rendererExpression
      );
      if (!exprParsed.ok) {
        setEditParseError(exprParsed.errors.join("; "));
        return;
      }
      const rendererExpression: RendererExpression = exprParsed.value;
      parsed = {
        parentStoryCandidateId: original.parentStoryCandidateId,
        chapter_number: original.chapter_number,
        ...(original.chapter_title != null
          ? { chapter_title: original.chapter_title }
          : {}),
        title:
          typeof parsedRecord.title === "string" ? parsedRecord.title : "",
        summary:
          (typeof parsedRecord.summary === "string" && parsedRecord.summary.trim()
            ? parsedRecord.summary.trim()
            : editSummary.trim()) ||
          original.summary ||
          (typeof parsedRecord.title === "string" ? parsedRecord.title : ""),
        ...(parsedRecord.visualIntent != null
          ? { visualIntent: parsedRecord.visualIntent as SceneCandidateFields["visualIntent"] }
          : original.visualIntent
            ? { visualIntent: original.visualIntent }
            : {}),
        rendererExpression,
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

  const applySceneExpression = (
    item: DiscoveryReviewItem,
    expression: RendererExpression
  ) => {
    const fields = getEffectiveFields(item) as SceneCandidateFields;
    saveSceneStagingEdit(item.reviewId, {
      editedFields: {
        ...fields,
        rendererExpression: expression,
      },
      editedDisplayName: getEffectiveDisplayName(item),
      editedSummary: getEffectiveSummary(item),
    });
  };

  const mergeExpressionIntoEditJson = (expression: RendererExpression) => {
    try {
      const parsed = JSON.parse(editFieldsJson) as Record<string, unknown>;
      parsed.rendererExpression = expression;
      setEditFieldsJson(JSON.stringify(parsed, null, 2));
      setEditParseError(null);
    } catch {
      setEditFieldsJson(
        JSON.stringify({ rendererExpression: expression }, null, 2)
      );
    }
  };

  const reproposeSceneExpression = async (
    item: DiscoveryReviewItem,
    intoEditJson = false
  ) => {
    if (item.candidate.candidateType !== "scene") return;
    const caption = (
      intoEditJson ? editSummary : getEffectiveSummary(item)
    ).trim();
    if (!caption) {
      setExprProposeError(discoveryReviewUi.reproposeExpressionNeedSummary);
      return;
    }
    let currentExpression: string | undefined;
    if (intoEditJson) {
      try {
        const parsed = JSON.parse(editFieldsJson) as {
          rendererExpression?: unknown;
        };
        if (parsed.rendererExpression) {
          currentExpression = JSON.stringify(parsed.rendererExpression);
        }
      } catch {
        currentExpression = undefined;
      }
    } else {
      const fields = getEffectiveFields(item) as SceneCandidateFields;
      if (fields.rendererExpression) {
        currentExpression = JSON.stringify(fields.rendererExpression);
      }
    }
    setProposingExprReviewId(item.reviewId);
    setExprProposeError(null);
    try {
      const result = await proposeFrameExpression({
        workId,
        caption,
        currentExpression,
        routeTitle: parentStoryTitleForScene(item, reviewItems),
        characterCues: characterCuesForExpressionPropose(
          characterCatalog,
          reviewItems
        ),
      });
      if (!result.ok) {
        setExprProposeError(result.message);
        return;
      }
      if (intoEditJson) {
        mergeExpressionIntoEditJson(result.rendererExpression);
        return;
      }
      applySceneExpression(item, result.rendererExpression);
      if (editItem?.reviewId === item.reviewId) {
        mergeExpressionIntoEditJson(result.rendererExpression);
      }
    } catch (e) {
      setExprProposeError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposingExprReviewId(null);
    }
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
    visibleAcceptedStoryUnits.length +
    visibleAcceptedSceneCandidates.length +
    visibleAcceptedCharacters.length +
    visibleAcceptedLocations.length;

  const rolloutPendingCount = rollout
    ? rollout.queue.storyStaging.length +
      rollout.queue.readingRouteStaging.length +
      (rollout.queue.characterStaging?.length ?? 0) +
      (rollout.queue.locationStaging?.length ?? 0)
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

  const handleAccept = (item: DiscoveryReviewItem) => {
    void acceptCandidate(item.reviewId);
  };

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-1.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900">
                {discoveryReviewUi.panelTitle}
              </h2>
              <p className="truncate text-[11px] text-zinc-500">
                {discoveryReviewUi.panelDescription}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-[11px]"
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
              <RefreshCw className="size-3" aria-hidden />
              {isProposing
                ? discoveryReviewUi.fullReProposing
                : discoveryReviewUi.fullRePropose}
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">

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
              {discoveryApiErrorText(acceptError)}
              {acceptError.fieldErrors?.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {acceptError.fieldErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {exprProposeError ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {exprProposeError}
            </div>
          ) : null}

          {granularityGate?.status === "FAIL" ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              <p className="font-medium">{discoveryReviewUi.granularityGateTitle}</p>
              <p className="mt-1">{discoveryReviewUi.granularityGateDescription}</p>
              <ul className="mt-2 list-disc pl-5">
                {granularityGate.violations
                  .filter((v) => v.severity === "error")
                  .map((v, i) => (
                    <li key={`${v.invariant}-${i}`}>
                      {v.invariant}: {v.evidence[0]}
                    </li>
                  ))}
              </ul>
              <Button
                type="button"
                size="sm"
                className="mt-3"
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
                {isProposing
                  ? discoveryReviewUi.fullReProposing
                  : discoveryReviewUi.fullRePropose}
              </Button>
            </div>
          ) : null}

          {informationEquivalence?.status === "FAIL" ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              <p className="font-medium">
                {discoveryReviewUi.authorityComplete}
                {" · "}
                {discoveryReviewUi.informationEquivalenceTitle}
              </p>
              <p className="mt-1">
                {discoveryReviewUi.informationEquivalenceDescription}
              </p>
              <ul className="mt-2 list-disc pl-5">
                {Object.entries(informationEquivalence.byStoryCandidateId).flatMap(
                  ([storyId, result]) =>
                    result.units
                      .filter(
                        (unit) =>
                          unit.status === "LOST" || unit.status === "PARTIAL"
                      )
                      .map((unit) => (
                        <li key={`${storyId}-${unit.unitId}`}>
                          {discoveryReviewUi.informationEquivalenceUnitLine(
                            unit.unitId,
                            unit.status,
                            unit.reason
                          )}
                          {": "}
                          {unit.expected}
                          {"; "}
                          {discoveryReviewUi.informationEquivalenceFrames(
                            unit.supportingFrameIds.length > 0
                              ? unit.supportingFrameIds.join(", ")
                              : "—"
                          )}
                        </li>
                      ))
                )}
              </ul>
              <Button
                type="button"
                size="sm"
                className="mt-3"
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
                {isProposing
                  ? discoveryReviewUi.fullReProposing
                  : discoveryReviewUi.fullRePropose}
              </Button>
            </div>
          ) : null}

          {/* Step tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full min-h-0 flex-1 flex-col">
            <div className="mb-1 flex shrink-0 flex-wrap items-center gap-2">
              <PipelineBreadcrumb activeStep={activeTab} />
              <StepTabsList className="mb-0">
              <StepTabsTrigger value="review">
                {discoveryReviewUi.tabReview}
                <CountBadge
                  count={reviewListItems.length + acceptedCount}
                />
              </StepTabsTrigger>
              {rollout ? (
                <>
                  <ChevronRight
                    className="mx-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <StepTabsTrigger value="rollout">
                    {messages.discovery.tabRollout}
                    <CountBadge count={rolloutPendingCount} />
                  </StepTabsTrigger>
                </>
              ) : null}
            </StepTabsList>
            </div>

            {/* ── Tab 1: 确认（内分子 tab：待确认 / 已确认）── */}
            <TabsContent value="review" className="mt-0 min-h-0 flex-1 space-y-2 overflow-hidden data-[state=inactive]:hidden">
              <Tabs
                value={confirmSubTab}
                onValueChange={setConfirmSubTab}
                className="flex h-full min-h-0 w-full flex-col"
              >
                <TabsList className="mb-1.5 h-8 shrink-0">
                  <TabsTrigger value="pending" className="text-xs">
                    {discoveryReviewUi.tabPendingConfirm}
                    <CountBadge count={reviewListItems.length} />
                  </TabsTrigger>
                  <TabsTrigger value="accepted" className="text-xs">
                    {discoveryReviewUi.tabAccepted}
                    <CountBadge count={acceptedCount} />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-0 min-h-0 flex-1 space-y-2 overflow-y-auto data-[state=inactive]:hidden">
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
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-500">
                      {discoveryReviewUi.storyCentricHint}
                    </p>
                    <ul className="space-y-2">
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
                            className="space-y-1.5 rounded-md border border-zinc-200 bg-zinc-50/40 px-2 py-1.5"
                          >
                            <ReviewItemCard
                              item={story}
                              busy={busy}
                              actionable={actionable}
                              acceptDisabled={
                                granularityGate?.status === "FAIL" ||
                                informationEquivalence?.byStoryCandidateId[
                                  story.candidate.candidateId
                                ]?.status === "FAIL"
                              }
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

                            <div className="space-y-0.5 border-l border-zinc-200 pl-2">
                              <p className="truncate text-[11px] text-zinc-500">
                                <span className="font-medium text-zinc-600">
                                  {discoveryReviewUi.storyRelatedFromScenes}
                                </span>
                                {" · "}
                                {storyRelatedLine ??
                                  discoveryReviewUi.storyRelatedEmpty}
                              </p>
                            </div>

                            {childScenes.length > 0 ? (
                              <div className="space-y-1 border-l border-zinc-200 pl-2">
                                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                  {DISCOVERY_CANDIDATE_TYPE_LABELS.scene}
                                  {actionable ? (
                                    <span className="ml-1 font-normal normal-case tracking-normal text-zinc-400">
                                      · {discoveryReviewUi.sceneAcceptsWithStory}
                                    </span>
                                  ) : null}
                                </h4>
                                <ul className="space-y-1">
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
                                        onSplit={
                                          sceneActionable
                                            ? () => openSplit(scene)
                                            : undefined
                                        }
                                        onReproposeExpression={
                                          sceneActionable
                                            ? () =>
                                                void reproposeSceneExpression(
                                                  scene
                                                )
                                            : undefined
                                        }
                                        expressionBusy={
                                          proposingExprReviewId ===
                                          scene.reviewId
                                        }
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
                          <ul className="space-y-1">
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
                                onSplit={
                                  scene.status === "pending" ||
                                  scene.status === "edited_pending_accept"
                                    ? () => openSplit(scene)
                                    : undefined
                                }
                                onReproposeExpression={
                                  scene.status === "pending" ||
                                  scene.status === "edited_pending_accept"
                                    ? () =>
                                        void reproposeSceneExpression(scene)
                                    : undefined
                                }
                                expressionBusy={
                                  proposingExprReviewId === scene.reviewId
                                }
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
                        <li className="space-y-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              {DISCOVERY_CANDIDATE_TYPE_LABELS.character}
                              （作品库）
                            </h4>
                            <p className="text-[11px] text-zinc-500">
                              {discoveryReviewUi.entityAcceptsWithStory}
                            </p>
                          </div>
                          <ul className="space-y-1">
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
                        <li className="space-y-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5">
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              {DISCOVERY_CANDIDATE_TYPE_LABELS.location}
                              （作品库）
                            </h4>
                            <p className="text-[11px] text-zinc-500">
                              {discoveryReviewUi.entityAcceptsWithStory}
                            </p>
                          </div>
                          <ul className="space-y-1">
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

                <TabsContent value="accepted" className="mt-0 min-h-0 flex-1 space-y-2 overflow-y-auto data-[state=inactive]:hidden">
                  {visibleAcceptedStoryUnits.length === 0 &&
                  visibleAcceptedCharacters.length === 0 &&
                  visibleAcceptedLocations.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {discoveryReviewUi.flowHintAcceptedEmpty}
                    </p>
                  ) : (
                    <ul className="space-y-4 text-sm">
                      {visibleAcceptedCharacters.length > 0 ? (
                        <li className="space-y-2">
                          <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                            {DISCOVERY_CANDIDATE_TYPE_LABELS.character}
                          </h4>
                          <ul className="space-y-2">
                            {visibleAcceptedCharacters.map((item) => (
                              <li
                                key={item.sourceReviewId}
                                className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium">{item.name}</div>
                                  {item.house ? (
                                    <p className="text-muted-foreground">
                                      {item.house}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setActiveTab("rollout")}
                                  >
                                    {discoveryReviewUi.goRollout}
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
                                      revokeStagingAccept(
                                        item.sourceReviewId,
                                        "character"
                                      );
                                    }}
                                  >
                                    {discoveryReviewUi.revokeAccept}
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ) : null}
                      {visibleAcceptedLocations.length > 0 ? (
                        <li className="space-y-2">
                          <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                            {DISCOVERY_CANDIDATE_TYPE_LABELS.location}
                          </h4>
                          <ul className="space-y-2">
                            {visibleAcceptedLocations.map((item) => (
                              <li
                                key={item.sourceReviewId}
                                className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium">{item.name}</div>
                                  {item.region ? (
                                    <p className="text-muted-foreground">
                                      {item.region}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setActiveTab("rollout")}
                                  >
                                    {discoveryReviewUi.goRollout}
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
                                      revokeStagingAccept(
                                        item.sourceReviewId,
                                        "location"
                                      );
                                    }}
                                  >
                                    {discoveryReviewUi.revokeAccept}
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ) : null}
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
              <TabsContent value="rollout" className="mt-0 min-h-0 flex-1 space-y-2 overflow-y-auto data-[state=inactive]:hidden">
                <RolloutPanel
                  workId={workId}
                  rollout={rollout}
                  embedded
                />
              </TabsContent>
            ) : null}

          </Tabs>
          </div>
      </div>

      <Dialog open={editItem !== null} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="flex max-h-[min(90dvh,calc(100vh-2rem))] max-w-lg flex-col gap-3 overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle>{discoveryReviewUi.editDialogTitle}</DialogTitle>
            <DialogDescription>
              {editItem?.status === "accepted"
                ? discoveryReviewUi.editDialogAccepted
                : discoveryReviewUi.editDialogPending}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(65dvh,calc(100vh-14rem))] space-y-3 overflow-y-auto overscroll-contain pr-1">
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
                {editItem?.candidate.candidateType === "scene"
                  ? candidateFieldLabel("sceneSummary")
                  : candidateFieldLabel("summary")}
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
                rows={10}
                className="font-mono text-xs"
                onChange={(e) => {
                  setEditFieldsJson(e.target.value);
                  setEditParseError(null);
                }}
              />
              {editParseError ? (
                <p className="text-destructive text-xs">{editParseError}</p>
              ) : null}
              {editItem?.candidate.candidateType === "scene" ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={
                      proposingExprReviewId === editItem.reviewId ||
                      isRegening ||
                      isSplitting
                    }
                    onClick={() =>
                      void reproposeSceneExpression(editItem, true)
                    }
                    title={discoveryReviewUi.reproposeExpressionHint}
                  >
                    {proposingExprReviewId === editItem.reviewId
                      ? discoveryReviewUi.reproposingExpression
                      : discoveryReviewUi.reproposeExpression}
                  </Button>
                  <p className="text-[11px] text-zinc-500">
                    {discoveryReviewUi.reproposeExpressionHint}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="shrink-0">
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

      <Dialog
        open={splitItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSplitItem(null);
            setSplitBeats([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{discoveryReviewUi.splitSceneDialogTitle}</DialogTitle>
            <DialogDescription>
              {discoveryReviewUi.splitSceneDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {splitBeats.map((beat, index) => (
              <div
                key={`split-beat-${index}`}
                className="space-y-1.5 rounded-lg border border-zinc-200 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Beat {index + 1}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={splitBeats.length <= 2}
                    onClick={() =>
                      setSplitBeats((prev) =>
                        prev.filter((_, i) => i !== index)
                      )
                    }
                  >
                    {discoveryReviewUi.splitSceneRemoveBeat}
                  </Button>
                </div>
                <Input
                  value={beat.title}
                  className="h-8 text-xs"
                  placeholder="title"
                  onChange={(e) => {
                    const value = e.target.value;
                    setSplitBeats((prev) =>
                      prev.map((b, i) =>
                        i === index ? { ...b, title: value } : b
                      )
                    );
                  }}
                />
                <Textarea
                  value={beat.summary}
                  rows={2}
                  className="text-xs"
                  placeholder="summary"
                  onChange={(e) => {
                    const value = e.target.value;
                    setSplitBeats((prev) =>
                      prev.map((b, i) =>
                        i === index ? { ...b, summary: value } : b
                      )
                    );
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                setSplitBeats((prev) => [
                  ...prev,
                  { title: `Beat ${prev.length + 1}`, summary: "" },
                ])
              }
            >
              {discoveryReviewUi.splitSceneAddBeat}
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSplitting}
              onClick={() => {
                setSplitItem(null);
                setSplitBeats([]);
              }}
            >
              {discoveryComposerUi.cancel}
            </Button>
            <Button
              type="button"
              disabled={isSplitting}
              onClick={() => {
                if (!splitItem) return;
                const cleaned = splitBeats
                  .map((b) => ({
                    title: b.title.trim(),
                    summary: b.summary.trim(),
                  }))
                  .filter((b) => b.title || b.summary);
                if (cleaned.length < 2) {
                  window.alert(discoveryReviewUi.splitSceneNeedTwo);
                  return;
                }
                void (async () => {
                  const ok = await splitSceneIntoBeats(
                    splitItem.reviewId,
                    splitBeats
                  );
                  if (!ok) {
                    window.alert(discoveryReviewUi.splitSceneExpressionFailed);
                    return;
                  }
                  setSplitItem(null);
                  setSplitBeats([]);
                })();
              }}
            >
              {isSplitting
                ? discoveryReviewUi.splitSceneConfirming
                : discoveryReviewUi.splitSceneConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

