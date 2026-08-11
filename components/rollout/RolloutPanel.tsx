"use client";

/**
 * Hotfix Rollout UI — two surfaces only:
 * 1) 待处理：故事 → 写入作品；画面 → 画面页
 * 2) 已写入：故事 + 其下的画面页
 */

import Link from "next/link";
import * as React from "react";

import {
  FrameContextWriteFields,
  StoryWritePreviewCard,
} from "@/components/rollout/StoryWritePreviewCard";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UseRolloutReturn } from "@/hooks/useRollout";
import * as charactersApi from "@/lib/characters";
import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import * as locationsApi from "@/lib/locations";
import { messages } from "@/lib/locale";
import { readerWorkUrl } from "@/lib/reader-origin";
import { loadRolloutQueue } from "@/lib/rollout/rollout-queue-storage";
import {
  applySceneStagingContextEditsFromArchive,
  frameContextArchiveSelectionFromStaging,
} from "@/lib/rollout/scene-staging-context-edit";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import type { ApprovedStoryUnit } from "@/lib/rollout/types";
import type { Character, Location } from "@/lib/types";

export interface RolloutPanelProps {
  workId: string;
  rollout: UseRolloutReturn;
  onClose?: () => void;
  /** When true, nest inside Discovery workbench (no back-link / lighter chrome). */
  embedded?: boolean;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-primary/10 text-primary ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-normal tabular-nums">
      {count}
    </span>
  );
}

function RouteEditDialog({
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

  React.useEffect(() => {
    if (open && unit) {
      setTitle(unit.title);
      setSummary(unit.summary);
    }
  }, [open, unit?.id, unit?.title, unit?.summary]);

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
            <Label htmlFor="route-title">{rolloutUi.editStoryUnitTitleLabel}</Label>
            <Input
              id="route-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="route-summary">
              {rolloutUi.editStoryUnitSummaryLabel}
            </Label>
            <Textarea
              id="route-summary"
              value={summary}
              rows={4}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !title.trim()}
            onClick={() =>
              void onSave({ title: title.trim(), summary }).then(() =>
                onOpenChange(false)
              )
            }
          >
            {rolloutUi.saveStoryUnit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WriteFrameDialog({
  staging,
  open,
  onOpenChange,
  canProject,
  onConfirm,
  busy,
}: {
  staging: AcceptedSceneCandidateStaging | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canProject: boolean;
  onConfirm: () => Promise<void>;
  busy: boolean;
}) {
  if (!staging) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rolloutUi.confirmCreateScene}</DialogTitle>
          <DialogDescription>{rolloutUi.confirmCreateSceneDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">标题：</span>
            {staging.title}
          </p>
          {staging.parentStoryTitle ? (
            <p>
              <span className="text-muted-foreground">所属故事：</span>
              {staging.parentStoryTitle}
            </p>
          ) : null}
          {!canProject ? (
            <p className="text-destructive text-xs">
              {rolloutUi.projectionValidationParentMissing}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={busy || !canProject}
            onClick={() =>
              void onConfirm().then(() => onOpenChange(false))
            }
          >
            {rolloutUi.projectCreate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolloutPanel({
  workId,
  rollout,
  onClose,
  embedded = false,
}: RolloutPanelProps) {
  const [activeTab, setActiveTab] = React.useState("pending");
  const [importNotice, setImportNotice] = React.useState<string | null>(null);
  const [frameStaging, setFrameStaging] =
    React.useState<AcceptedSceneCandidateStaging | null>(null);
  const [editingRoute, setEditingRoute] =
    React.useState<ApprovedStoryUnit | null>(null);
  const [showDismissed, setShowDismissed] = React.useState(false);
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [defaultChapterNumber, setDefaultChapterNumber] = React.useState(1);

  React.useEffect(() => {
    if (!workId) return;
    let cancelled = false;
    (async () => {
      try {
        const [chars, locs] = await Promise.all([
          charactersApi.getAll(workId),
          locationsApi.getAll(workId),
        ]);
        if (cancelled) return;
        setCharacters(chars);
        setLocations(locs);
        const maxChapter = Math.max(
          0,
          ...rollout.scenes.map((s) => s.chapter_number)
        );
        setDefaultChapterNumber(maxChapter + 1);
      } catch {
        if (!cancelled) {
          setCharacters([]);
          setLocations([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId, rollout.scenes]);

  const framesByRouteTsid = React.useMemo(() => {
    const map = new Map<string, typeof rollout.frameProjections>();
    for (const frame of rollout.frameProjections) {
      const list = map.get(frame.readingRouteTsid) ?? [];
      list.push(frame);
      map.set(frame.readingRouteTsid, list);
    }
    return map;
  }, [rollout.frameProjections]);

  const pendingCount =
    rollout.queue.storyStaging.length + rollout.queue.readingRouteStaging.length;
  const dismissedCount =
    (rollout.queue.dismissedStoryStaging?.length ?? 0) +
    (rollout.queue.dismissedReadingRouteStaging?.length ?? 0);
  const persistedCount = rollout.storyUnits.length;

  const pendingStoryIds = React.useMemo(
    () => new Set(rollout.queue.storyStaging.map((s) => s.sourceReviewId)),
    [rollout.queue.storyStaging]
  );

  const orphanFrameStaging = React.useMemo(
    () =>
      rollout.queue.readingRouteStaging.filter(
        (s) =>
          !s.parentStorySourceReviewId ||
          !pendingStoryIds.has(s.parentStorySourceReviewId)
      ),
    [rollout.queue.readingRouteStaging, pendingStoryIds]
  );

  const handleWriteStory = React.useCallback(
    async (staging: AcceptedStoryUnitStaging) => {
      // Read storage (not React state) so flushAndWrite context edits are included.
      const childFrames = loadRolloutQueue(
        workId,
        rollout.operatorId
      ).readingRouteStaging.filter(
        (s) => s.parentStorySourceReviewId === staging.sourceReviewId
      );
      const storyUnitId = await rollout.persistStoryUnit(staging);
      if (!storyUnitId) return;

      let framesOk = 0;
      for (const frame of childFrames) {
        const ok = await rollout.projectSceneCreate(frame, storyUnitId);
        if (ok) framesOk += 1;
      }

      if (childFrames.length > 0 && framesOk < childFrames.length) {
        // Incomplete: do not claim write success (Constitution: Evidence Before Completion)
        return;
      }

      const evidenceOk = await rollout.verifyReaderEvidence(
        storyUnitId,
        childFrames.length
      );
      if (!evidenceOk) return;
    },
    [rollout, workId]
  );

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
        </div>
      ) : null}

      {importNotice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {importNotice}
        </div>
      ) : null}

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
        {!embedded ? (
          <Button variant="outline" asChild>
            <Link href={`/works/${encodeURIComponent(workId)}/discovery`}>
              {rolloutUi.goDiscovery}
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className={embedded ? "border-0 shadow-none" : undefined}>
        {!embedded ? (
          <CardHeader>
            <CardTitle>{rolloutUi.workspaceTitle}</CardTitle>
            <CardDescription>{rolloutUi.workspaceDescription}</CardDescription>
          </CardHeader>
        ) : null}
        <CardContent className={embedded ? "p-0" : undefined}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                {rolloutUi.tabPending}
                <CountBadge count={pendingCount} />
              </TabsTrigger>
              <TabsTrigger value="persisted">
                {rolloutUi.tabPersisted}
                <CountBadge count={persistedCount} />
              </TabsTrigger>
            </TabsList>

            {/* ── 待处理 ── */}
            <TabsContent value="pending" className="min-h-72 space-y-8">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">
                    {rolloutUi.storyStagingTitle}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {rolloutUi.writePreviewHint}
                  </p>
                </div>
                {rollout.queue.storyStaging.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {rolloutUi.noStoryStaging}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {rollout.queue.storyStaging.map((staging, index) => {
                      const childFrames =
                        rollout.queue.readingRouteStaging.filter(
                          (s) =>
                            s.parentStorySourceReviewId ===
                            staging.sourceReviewId
                        );
                      return (
                        <StoryWritePreviewCard
                          key={staging.sourceReviewId}
                          staging={staging}
                          frames={childFrames}
                          characters={characters}
                          locations={locations}
                          defaultChapterNumber={defaultChapterNumber + index}
                          busy={rollout.busy}
                          onChange={(next) => rollout.updateStoryStaging(next)}
                          onFrameChange={(sourceReviewId, patch) => {
                            const frame =
                              rollout.queue.readingRouteStaging.find(
                                (s) => s.sourceReviewId === sourceReviewId
                              );
                            if (!frame) return;
                            const withText = {
                              ...frame,
                              title: patch.title.trim() || frame.title,
                              summary: patch.summary.trim() || undefined,
                            };
                            rollout.updateSceneStaging(
                              applySceneStagingContextEditsFromArchive(
                                withText,
                                {
                                  characterTsids: patch.characterTsids,
                                  locationTsid: patch.locationTsid || null,
                                  unmatchedCastNames: patch.unmatchedCastNames,
                                  unmatchedLocationLabel:
                                    patch.unmatchedLocationLabel,
                                },
                                {
                                  characters: characters.map((c) => ({
                                    name: c.name,
                                    tsid: c.tsid,
                                  })),
                                  locations: locations.map((l) => ({
                                    name: l.name,
                                    tsid: l.tsid,
                                  })),
                                }
                              )
                            );
                          }}
                          onWrite={handleWriteStory}
                          onDismiss={() =>
                            rollout.dismissStoryStaging(staging.sourceReviewId)
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {orphanFrameStaging.length > 0 ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">
                    {rolloutUi.sceneStagingTitle}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    所属故事已写入或不在待写入列表中的画面，可单独添加。
                  </p>
                </div>
                  <div className="space-y-3">
                    {orphanFrameStaging.map((staging) => {
                      const canWrite = rollout.canProjectScene(staging);
                      const sel = frameContextArchiveSelectionFromStaging(
                        staging,
                        {
                          characters: characters.map((c) => ({
                            name: c.name,
                            tsid: c.tsid,
                          })),
                          locations: locations.map((l) => ({
                            name: l.name,
                            tsid: l.tsid,
                          })),
                        }
                      );
                      return (
                        <div
                          key={staging.sourceReviewId}
                          className="space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 text-sm">
                              <p className="font-medium">{staging.title}</p>
                              <p className="text-muted-foreground text-xs">
                                {staging.parentStoryTitle
                                  ? `所属故事：${staging.parentStoryTitle}`
                                  : "缺少所属故事"}
                                {!canWrite && staging.parentStorySourceReviewId
                                  ? " · 所属故事尚未保存"
                                  : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                size="sm"
                                disabled={rollout.busy || !canWrite}
                                onClick={() => setFrameStaging(staging)}
                              >
                                {rolloutUi.projectCreate}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={rollout.busy}
                                onClick={() =>
                                  rollout.dismissSceneStaging(
                                    staging.sourceReviewId
                                  )
                                }
                              >
                                {rolloutUi.dismissStaging}
                              </Button>
                            </div>
                          </div>
                          <FrameContextWriteFields
                            characterTsids={sel.characterTsids}
                            locationTsid={sel.locationTsid}
                            unmatchedCastNames={sel.unmatchedCastNames}
                            unmatchedLocationLabel={sel.unmatchedLocationLabel}
                            characters={characters}
                            locations={locations}
                            disabled={rollout.busy}
                            onChange={(next) => {
                              rollout.updateSceneStaging(
                                applySceneStagingContextEditsFromArchive(
                                  staging,
                                  {
                                    characterTsids: next.characterTsids,
                                    locationTsid: next.locationTsid || null,
                                    unmatchedCastNames: next.unmatchedCastNames,
                                    unmatchedLocationLabel:
                                      next.unmatchedLocationLabel,
                                  },
                                  {
                                    characters: characters.map((c) => ({
                                      name: c.name,
                                      tsid: c.tsid,
                                    })),
                                    locations: locations.map((l) => ({
                                      name: l.name,
                                      tsid: l.tsid,
                                    })),
                                  }
                                )
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
              </section>
              ) : null}

              {dismissedCount > 0 ? (
                <div className="border-t pt-4">
                  <button
                    type="button"
                    className="text-muted-foreground text-xs hover:underline"
                    onClick={() => setShowDismissed((v) => !v)}
                  >
                    {showDismissed ? "收起" : "显示"}
                    {rolloutUi.tabDismissed}
                    <CountBadge count={dismissedCount} />
                  </button>
                  {showDismissed ? (
                    <div className="mt-3 space-y-2">
                      {rollout.queue.dismissedStoryStaging?.map((s) => (
                        <div
                          key={s.sourceReviewId}
                          className="flex items-center justify-between rounded border border-dashed p-2 text-sm"
                        >
                          <span>{s.title}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              rollout.restoreStoryStaging(s.sourceReviewId)
                            }
                          >
                            {rolloutUi.restoreStaging}
                          </Button>
                        </div>
                      ))}
                      {rollout.queue.dismissedReadingRouteStaging?.map((s) => (
                        <div
                          key={s.sourceReviewId}
                          className="flex items-center justify-between rounded border border-dashed p-2 text-sm"
                        >
                          <span>{s.title}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              rollout.restoreSceneStaging(s.sourceReviewId)
                            }
                          >
                            {rolloutUi.restoreStaging}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </TabsContent>

            {/* ── 已写入作品 ── */}
            <TabsContent value="persisted" className="min-h-72 space-y-3">
              {rollout.storyUnits.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {rolloutUi.noStoryUnits}
                </p>
              ) : (
                <div className="space-y-3">
                  {rollout.storyUnits.map((unit) => {
                    const frames = framesByRouteTsid.get(unit.id) ?? [];
                    const canUnpersist = frames.length === 0;

                    return (
                      <div
                        key={unit.id}
                        className="space-y-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 text-sm">
                            <p className="font-medium">{unit.title}</p>
                            <p className="text-muted-foreground text-xs">
                              {unit.id}
                              {frames.length > 0
                                ? ` · ${frames.length} 段画面页`
                                : " · 还没有画面页"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                            >
                              <Link
                                href={`/works/${encodeURIComponent(workId)}/reading-routes/${encodeURIComponent(unit.id)}/edit`}
                              >
                                {rolloutUi.goEditScene}
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rollout.busy}
                              onClick={() => setEditingRoute(unit)}
                            >
                              {rolloutUi.editStoryUnit}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rollout.busy || !canUnpersist}
                              title={
                                canUnpersist
                                  ? undefined
                                  : messages.rollout.unpersistBlockedByProjection
                              }
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    rolloutUi.confirmUnpersistStory
                                  )
                                ) {
                                  return;
                                }
                                void rollout.unpersistStoryUnit(unit.id);
                              }}
                            >
                              {rolloutUi.unpersistStory}
                            </Button>
                          </div>
                        </div>

                        {frames.length > 0 ? (
                          <ul className="space-y-2 border-t pt-2">
                            {frames.map((frame) => (
                              <li
                                key={`${frame.readingRouteTsid}:${frame.frameIndex}`}
                                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <span className="text-muted-foreground text-xs">
                                  画面 #{frame.frameIndex + 1}：
                                  {frame.caption || frame.sourceReviewId}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={rollout.busy}
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        rolloutUi.confirmUnprojectScene
                                      )
                                    ) {
                                      return;
                                    }
                                    void rollout.unprojectScene(
                                      frame.sourceReviewId
                                    );
                                  }}
                                >
                                  {rolloutUi.unprojectScene}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={readerWorkUrl(workId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {rolloutUi.openReaderVerify}
                  </a>
                </Button>
                {onClose ? (
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    {rolloutUi.goScenesList}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/works/${encodeURIComponent(workId)}/reading-routes`}
                    >
                      {rolloutUi.goScenesList}
                    </Link>
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RouteEditDialog
        unit={editingRoute}
        open={editingRoute != null}
        onOpenChange={(open) => {
          if (!open) setEditingRoute(null);
        }}
        busy={rollout.busy}
        onSave={async (patch) => {
          if (!editingRoute) return;
          await rollout.updateStoryUnit(editingRoute.id, patch);
        }}
      />

      <WriteFrameDialog
        staging={frameStaging}
        open={frameStaging != null}
        onOpenChange={(open) => {
          if (!open) setFrameStaging(null);
        }}
        canProject={
          frameStaging ? rollout.canProjectScene(frameStaging) : false
        }
        busy={rollout.busy}
        onConfirm={async () => {
          if (!frameStaging) return;
          await rollout.projectSceneCreate(frameStaging);
        }}
      />
    </div>
  );
}
