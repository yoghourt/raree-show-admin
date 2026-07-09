"use client";

import { ChevronRight } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  StepTabsList,
  StepTabsTrigger,
  Tabs,
  TabsContent,
} from "@/components/ui/tabs";
import type { UseRolloutReturn } from "@/hooks/useRollout";
import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import { messages } from "@/lib/locale";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import type { ApprovedStoryUnit } from "@/lib/rollout/types";

export interface RolloutPanelProps {
  workId: string;
  rollout: UseRolloutReturn;
  /** When rendered inside a drawer, call this to close it instead of navigating away. */
  onClose?: () => void;
}

/** Filled circle with step number; fills primary when tab is active via group/step. */
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

/** Item count badge — only renders when count > 0. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-primary/10 text-primary inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-normal tabular-nums">
      {count}
    </span>
  );
}

/** Arrow connector rendered between step triggers. */
function StepConnector() {
  return (
    <ChevronRight
      className="mx-0.5 size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

/** "Next step" footer hint with an optional action link. */
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

/** Thin pipeline breadcrumb — shows the full flow across Discovery + Rollout. */
function PipelineBreadcrumb({ activeStep }: { activeStep: string }) {
  const steps = [
    { id: "discovery", label: rolloutUi.pipelineFromDiscovery, external: true },
    { id: "pending", label: "① 待处理" },
    { id: "story-units", label: `② ${rolloutUi.tabStoryUnits}` },
    { id: "runtime-scenes", label: `③ ${messages.domain.readingRoute}` },
    { id: "links", label: "④ 关联" },
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

/** Section header inside a tab. */
function TabSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StoryUnitEditDialog({
  unit,
  open,
  onOpenChange,
  onSave,
  busy,
}: {
  unit: ApprovedStoryUnit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: {
    title: string;
    summary: string;
    boundaryHint?: string;
  }) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [boundaryHint, setBoundaryHint] = React.useState("");

  React.useEffect(() => {
    if (open && unit) {
      setTitle(unit.title);
      setSummary(unit.summary);
      setBoundaryHint(unit.boundaryHint ?? "");
    }
  }, [open, unit?.id, unit?.title, unit?.summary, unit?.boundaryHint]);

  if (!unit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rolloutUi.editStoryUnitTitle}</DialogTitle>
          <DialogDescription>{rolloutUi.editStoryUnitDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="story-unit-title">
              {rolloutUi.editStoryUnitTitleLabel}
            </Label>
            <Input
              id="story-unit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="story-unit-summary">
              {rolloutUi.editStoryUnitSummaryLabel}
            </Label>
            <Textarea
              id="story-unit-summary"
              value={summary}
              rows={4}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="story-unit-boundary">
              {rolloutUi.editStoryUnitBoundaryLabel}
            </Label>
            <Textarea
              id="story-unit-boundary"
              value={boundaryHint}
              rows={2}
              onChange={(e) => setBoundaryHint(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() =>
              void onSave({
                title: title.trim(),
                summary,
                boundaryHint: boundaryHint.trim() || undefined,
              }).then(() => onOpenChange(false))
            }
          >
            {rolloutUi.saveStoryUnit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SceneProjectionDialog({
  staging,
  open,
  onOpenChange,
  scenes,
  storyUnitOptions,
  onCreate,
  onLinkExisting,
  busy,
}: {
  staging: AcceptedSceneCandidateStaging | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: UseRolloutReturn["scenes"];
  storyUnitOptions: UseRolloutReturn["storyUnits"];
  onCreate: (linkToStoryUnitId?: string) => Promise<void>;
  onLinkExisting: (sceneTsid: string, linkToStoryUnitId?: string) => Promise<void>;
  busy: boolean;
}) {
  const [sceneTsid, setSceneTsid] = React.useState("");
  const [linkStoryUnitId, setLinkStoryUnitId] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setSceneTsid("");
      setLinkStoryUnitId("");
    }
  }, [open, staging?.sourceReviewId]);

  if (!staging) return null;

  const activeUnits = storyUnitOptions.filter((u) => u.status === "active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rolloutUi.confirmCreateScene}</DialogTitle>
          <DialogDescription>{rolloutUi.confirmCreateSceneDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">标题：</span>
            {staging.title}
          </p>
          <p>
            <span className="text-muted-foreground">章节：</span>
            {staging.chapter_number}
            {staging.chapter_title ? ` — ${staging.chapter_title}` : ""}
          </p>
          {activeUnits.length > 0 ? (
            <div className="space-y-1">
              <Label htmlFor="link-story-unit">{rolloutUi.optionalLinkStory}</Label>
              <select
                id="link-story-unit"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={linkStoryUnitId}
                onChange={(e) => setLinkStoryUnitId(e.target.value)}
              >
                <option value="">—</option>
                {activeUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="existing-scene">{rolloutUi.selectScene}</Label>
            <select
              id="existing-scene"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={sceneTsid}
              onChange={(e) => setSceneTsid(e.target.value)}
            >
              <option value="">—</option>
              {scenes.map((s) => (
                <option key={s.tsid} value={s.tsid}>
                  {messages.common.chapterN(s.chapter_number)} {s.title} ({s.tsid})
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button
            disabled={busy}
            onClick={() =>
              void onCreate(linkStoryUnitId || undefined).then(() =>
                onOpenChange(false)
              )
            }
          >
            {rolloutUi.projectCreate}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !sceneTsid}
            onClick={() =>
              void onLinkExisting(sceneTsid, linkStoryUnitId || undefined).then(
                () => onOpenChange(false)
              )
            }
          >
            {rolloutUi.projectLink}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolloutPanel({ workId, rollout, onClose }: RolloutPanelProps) {
  const [activeTab, setActiveTab] = React.useState("pending");
  const [importNotice, setImportNotice] = React.useState<string | null>(null);
  const [projectionStaging, setProjectionStaging] =
    React.useState<AcceptedSceneCandidateStaging | null>(null);
  const [editingStoryUnit, setEditingStoryUnit] =
    React.useState<ApprovedStoryUnit | null>(null);
  const [linkStoryUnitId, setLinkStoryUnitId] = React.useState("");
  const [linkSceneTsid, setLinkSceneTsid] = React.useState("");

  const activeStoryUnits = rollout.storyUnits.filter((u) => u.status === "active");

  const storyTitleById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const u of rollout.storyUnits) map.set(u.id, u.title);
    return map;
  }, [rollout.storyUnits]);

  const sceneTitleByTsid = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of rollout.scenes) map.set(s.tsid, s.title);
    return map;
  }, [rollout.scenes]);

  const linkCountByStoryUnitId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const link of rollout.links)
      map.set(link.storyUnitId, (map.get(link.storyUnitId) ?? 0) + 1);
    return map;
  }, [rollout.links]);

  const linksBySceneTsid = React.useMemo(() => {
    const map = new Map<string, typeof rollout.links>();
    for (const link of rollout.links) {
      const existing = map.get(link.sceneTsid) ?? [];
      existing.push(link);
      map.set(link.sceneTsid, existing);
    }
    return map;
  }, [rollout.links]);

  const projectedBySceneTsid = React.useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof rollout.queue.projectedReadingRoutes>[number]
    >();
    for (const record of rollout.queue.projectedReadingRoutes ?? [])
      map.set(record.sceneTsid, record);
    return map;
  }, [rollout.queue.projectedReadingRoutes]);

  const pendingCount =
    rollout.queue.storyStaging.length + rollout.queue.readingRouteStaging.length;
  const dismissedCount =
    (rollout.queue.dismissedStoryStaging?.length ?? 0) +
    (rollout.queue.dismissedReadingRouteStaging?.length ?? 0);

  const goTo = (tab: string) => setActiveTab(tab);

  return (
    <div className="space-y-6">
      {rollout.error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {rollout.error}
        </div>
      ) : null}

      {rollout.actionError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <p>
            {rolloutUi.actionError}: {rollout.actionError.message} (
            {rollout.actionError.code})
          </p>
          {rollout.actionError.fieldErrors ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {Object.entries(rollout.actionError.fieldErrors).map(
                ([field, messages]) =>
                  messages.map((msg) => (
                    <li key={`${field}-${msg}`}>
                      {rolloutUi.fieldErrorsLabel} {field}: {msg}
                    </li>
                  ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      {importNotice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {importNotice}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={rollout.busy}
          onClick={() => {
            const ok = rollout.importFromDiscovery();
            setImportNotice(ok ? rolloutUi.importSuccess : rolloutUi.importEmpty);
          }}
        >
          {rolloutUi.importFromDiscovery}
        </Button>
        <Button
          variant="outline"
          disabled={rollout.loading}
          onClick={() => void rollout.refresh()}
        >
          {rolloutUi.refresh}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/works/${encodeURIComponent(workId)}/discovery`}>
            {rolloutUi.goDiscovery}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rolloutUi.workspaceTitle}</CardTitle>
          <CardDescription>{rolloutUi.workspaceDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pipeline breadcrumb */}
          <PipelineBreadcrumb activeStep={activeTab} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* ── Step tab bar ── */}
            <StepTabsList className="mb-2 gap-0">
              {/* Main flow steps */}
              <StepTabsTrigger value="pending">
                <StepBadge step={1} />
                {rolloutUi.tabPending}
                <CountBadge count={pendingCount} />
              </StepTabsTrigger>
              <StepConnector />
              <StepTabsTrigger value="story-units">
                <StepBadge step={2} />
                {rolloutUi.tabStoryUnits}
                <CountBadge count={rollout.storyUnits.length} />
              </StepTabsTrigger>
              <StepConnector />
              <StepTabsTrigger value="runtime-scenes">
                <StepBadge step={3} />
                {rolloutUi.tabRuntimeScenes}
                <CountBadge count={rollout.scenes.length} />
              </StepTabsTrigger>
              <StepConnector />
              <StepTabsTrigger value="links">
                <StepBadge step={4} />
                {rolloutUi.tabLinks}
                <CountBadge count={rollout.links.length} />
              </StepTabsTrigger>

              {/* Aux separator + dismissed */}
              <div
                className="mx-3 h-6 w-px shrink-0 bg-border"
                aria-hidden="true"
              />
              <StepTabsTrigger value="dismissed">
                {rolloutUi.tabDismissed}
                <CountBadge count={dismissedCount} />
              </StepTabsTrigger>
            </StepTabsList>

            {/* ── Tab 1: 待处理 ── */}
            <TabsContent value="pending" className="min-h-72 space-y-6">
              <TabSection
                title={rolloutUi.storyStagingTitle}
                description={messages.rollout.tabDescriptionPending}
              >
                {rollout.queue.storyStaging.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {rolloutUi.noStoryStaging}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rollout.queue.storyStaging.map((staging) => (
                      <div
                        key={staging.sourceReviewId}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{staging.title}</p>
                          <p className="text-muted-foreground line-clamp-2">
                            {staging.summary}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            disabled={rollout.busy}
                            onClick={() => void rollout.persistStoryUnit(staging)}
                          >
                            {rolloutUi.persistStory}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={rollout.busy}
                            onClick={() =>
                              rollout.dismissStoryStaging(staging.sourceReviewId)
                            }
                          >
                            {rolloutUi.dismissStaging}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabSection>

              <TabSection
                title={rolloutUi.sceneStagingTitle}
                description={messages.rollout.tabDescriptionReadingRoutes(
                  messages.domain.readingRoute
                )}
              >
                {rollout.queue.readingRouteStaging.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {rolloutUi.noSceneStaging}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rollout.queue.readingRouteStaging.map((staging) => (
                      <div
                        key={staging.sourceReviewId}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{staging.title}</p>
                          <p className="text-muted-foreground">
                            {messages.common.chapterN(staging.chapter_number)}
                            {staging.chapter_title
                              ? ` — ${staging.chapter_title}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            disabled={rollout.busy}
                            onClick={() => setProjectionStaging(staging)}
                          >
                            {rolloutUi.projectCreate}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={rollout.busy}
                            onClick={() =>
                              rollout.dismissSceneStaging(staging.sourceReviewId)
                            }
                          >
                            {rolloutUi.dismissStaging}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabSection>

              <FlowHint
                text={
                  pendingCount > 0
                    ? rolloutUi.flowHintPending
                    : rolloutUi.flowHintPendingEmpty
                }
                nextLabel={
                  rollout.storyUnits.length > 0
                    ? rolloutUi.nextStepStoryUnits
                    : rollout.scenes.length > 0
                      ? rolloutUi.nextStepRuntimeScenes
                      : undefined
                }
                onNext={
                  rollout.storyUnits.length > 0
                    ? () => goTo("story-units")
                    : rollout.scenes.length > 0
                      ? () => goTo("runtime-scenes")
                      : undefined
                }
              />
            </TabsContent>

            {/* ── Tab 2: Story 单元 ── */}
            <TabsContent value="story-units" className="min-h-72">
              {rollout.storyUnits.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {rolloutUi.noStoryUnits}
                </p>
              ) : (
                <div className="space-y-3">
                  {rollout.storyUnits.map((unit) => {
                    const linkCount = linkCountByStoryUnitId.get(unit.id) ?? 0;
                    const canUnpersist = linkCount === 0;

                    return (
                      <div
                        key={unit.id}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">
                            {unit.title}{" "}
                            <span className="text-muted-foreground font-normal">
                              (
                              {unit.status === "active"
                                ? messages.common.statusActive
                                : messages.common.statusArchived}
                              )
                            </span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {unit.sourceReviewId}
                            {linkCount > 0
                              ? ` · ${linkCount} 个 ${messages.domain.readingRoute} 关联`
                              : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rollout.busy}
                            onClick={() => setEditingStoryUnit(unit)}
                          >
                            {rolloutUi.editStoryUnit}
                          </Button>
                          {unit.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rollout.busy}
                              onClick={() => void rollout.archiveStoryUnit(unit.id)}
                            >
                              {rolloutUi.archive}
                            </Button>
                          ) : null}
                          {canUnpersist ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rollout.busy}
                              onClick={() => {
                                if (
                                  !window.confirm(rolloutUi.confirmUnpersistStory)
                                ) {
                                  return;
                                }
                                void rollout.unpersistStoryUnit(unit.id);
                              }}
                            >
                              {rolloutUi.unpersistStory}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <FlowHint
                text={rolloutUi.flowHintStoryUnits}
                nextLabel={rolloutUi.nextStepRuntimeScenes}
                onNext={() => goTo("runtime-scenes")}
              />
            </TabsContent>

            {/* ── Tab 3: Reading Routes ── */}
            <TabsContent value="runtime-scenes" className="min-h-72 space-y-3">
              {rollout.scenes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {rolloutUi.noRuntimeScenes}
                </p>
              ) : (
                <div className="space-y-3">
                  {rollout.scenes.map((scene) => {
                    const projected = projectedBySceneTsid.get(scene.tsid);
                    const sceneLinks = linksBySceneTsid.get(scene.tsid) ?? [];

                    return (
                      <div
                        key={scene.tsid}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">
                            {messages.common.chapterN(scene.chapter_number)} {scene.title}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {scene.tsid}
                            {" · "}
                            {projected
                              ? `${rolloutUi.sceneRolloutProjection}（${
                                  projected.mode === "create" ? "新建" : "关联已有"
                                }）`
                              : rolloutUi.sceneCatalogOrigin}
                            {" · "}
                            {rolloutUi.sceneLinkCount(sceneLinks.length)}
                          </p>
                          {sceneLinks.length > 0 ? (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {sceneLinks
                                .map(
                                  (link) =>
                                    storyTitleById.get(link.storyUnitId) ??
                                    link.storyUnitId
                                )
                                .join("、")}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/works/${encodeURIComponent(workId)}/reading-routes/${encodeURIComponent(scene.tsid)}/edit`}
                            >
                              {rolloutUi.goEditScene}
                            </Link>
                          </Button>
                          {projected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rollout.busy}
                              onClick={() => {
                                if (
                                  !window.confirm(rolloutUi.confirmUnprojectScene)
                                ) {
                                  return;
                                }
                                void rollout.unprojectScene(
                                  projected.sourceReviewId
                                );
                              }}
                            >
                              {rolloutUi.unprojectScene}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {onClose ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={onClose}
                >
                  {rolloutUi.goScenesList}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" asChild className="mt-1">
                  <Link href={`/works/${encodeURIComponent(workId)}/reading-routes`}>
                    {rolloutUi.goScenesList}
                  </Link>
                </Button>
              )}

              <FlowHint
                text={rolloutUi.flowHintRuntimeScenes}
                nextLabel={rolloutUi.nextStepLinks}
                onNext={() => goTo("links")}
              />
            </TabsContent>

            {/* ── Tab 4: 关联 ── */}
            <TabsContent value="links" className="min-h-72 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{rolloutUi.linkStoryUnit}</Label>
                  <select
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    value={linkStoryUnitId}
                    onChange={(e) => setLinkStoryUnitId(e.target.value)}
                  >
                    <option value="">—</option>
                    {activeStoryUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{rolloutUi.linkScene}</Label>
                  <select
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    value={linkSceneTsid}
                    onChange={(e) => setLinkSceneTsid(e.target.value)}
                  >
                    <option value="">—</option>
                    {rollout.scenes.map((s) => (
                      <option key={s.tsid} value={s.tsid}>
                        {s.title} ({s.tsid})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                disabled={rollout.busy || !linkStoryUnitId || !linkSceneTsid}
                onClick={() =>
                  void rollout
                    .createLink(linkStoryUnitId, linkSceneTsid)
                    .then((ok) => {
                      if (ok) {
                        setLinkStoryUnitId("");
                        setLinkSceneTsid("");
                      }
                    })
                }
              >
                {rolloutUi.createLink}
              </Button>

              {rollout.links.length === 0 ? (
                <p className="text-muted-foreground text-sm">{rolloutUi.noLinks}</p>
              ) : (
                <ul className="space-y-2">
                  {rollout.links.map((link) => (
                    <li
                      key={link.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm">
                        {storyTitleById.get(link.storyUnitId) ?? link.storyUnitId}{" "}
                        ↔ {sceneTitleByTsid.get(link.sceneTsid) ?? link.sceneTsid}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rollout.busy}
                        onClick={() => void rollout.unlink(link.id)}
                      >
                        {rolloutUi.unlink}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <FlowHint text={rolloutUi.flowHintLinks} />
            </TabsContent>

            {/* ── Aux: 已移出 ── */}
            <TabsContent value="dismissed" className="min-h-72 space-y-6">
              <TabSection title={rolloutUi.dismissedStoryTitle}>
                {(rollout.queue.dismissedStoryStaging?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {rolloutUi.noDismissedStoryStaging}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rollout.queue.dismissedStoryStaging?.map((staging) => (
                      <div
                        key={staging.sourceReviewId}
                        className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{staging.title}</p>
                          <p className="text-muted-foreground line-clamp-2">
                            {staging.summary}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rollout.busy}
                          onClick={() =>
                            rollout.restoreStoryStaging(staging.sourceReviewId)
                          }
                        >
                          {rolloutUi.restoreStaging}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabSection>

              <TabSection title={rolloutUi.dismissedSceneTitle}>
                {(rollout.queue.dismissedReadingRouteStaging?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {rolloutUi.noDismissedSceneStaging}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rollout.queue.dismissedReadingRouteStaging?.map((staging) => (
                      <div
                        key={staging.sourceReviewId}
                        className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{staging.title}</p>
                          <p className="text-muted-foreground">
                            {messages.common.chapterN(staging.chapter_number)}
                            {staging.chapter_title
                              ? ` — ${staging.chapter_title}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rollout.busy}
                          onClick={() =>
                            rollout.restoreSceneStaging(staging.sourceReviewId)
                          }
                        >
                          {rolloutUi.restoreStaging}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabSection>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <StoryUnitEditDialog
        unit={editingStoryUnit}
        open={editingStoryUnit != null}
        onOpenChange={(open) => {
          if (!open) setEditingStoryUnit(null);
        }}
        busy={rollout.busy}
        onSave={async (patch) => {
          if (!editingStoryUnit) return;
          await rollout.updateStoryUnit(editingStoryUnit.id, patch);
        }}
      />

      <SceneProjectionDialog
        staging={projectionStaging}
        open={projectionStaging != null}
        onOpenChange={(open) => {
          if (!open) setProjectionStaging(null);
        }}
        scenes={rollout.scenes}
        storyUnitOptions={rollout.storyUnits}
        busy={rollout.busy}
        onCreate={(linkToStoryUnitId) =>
          projectionStaging
            ? rollout
                .projectSceneCreate(projectionStaging, linkToStoryUnitId)
                .then(() => undefined)
            : Promise.resolve()
        }
        onLinkExisting={(sceneTsid, linkToStoryUnitId) =>
          projectionStaging
            ? rollout
                .projectSceneLinkExisting(
                  projectionStaging,
                  sceneTsid,
                  linkToStoryUnitId
                )
                .then(() => undefined)
            : Promise.resolve()
        }
      />
    </div>
  );
}
