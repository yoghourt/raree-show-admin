"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { BatchFrameCompletion } from "@/components/production/BatchFrameCompletion";
import { BatchPortraitCompletion } from "@/components/production/BatchPortraitCompletion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  DerivedProductionTask,
  ProductionPlanProjection,
} from "@/lib/production/types";
import type { Character, ReadingRoute } from "@/lib/types";

export type ProductionBoardProps = {
  workId: string;
  plan: ProductionPlanProjection;
  routes: ReadingRoute[];
  characters: Character[];
  onAssetsChanged: () => void;
};

type WorkTab = "frames" | "portraits";

function splitHref(href: string): { pathname: string; hash: string | null } {
  const hashIndex = href.indexOf("#");
  if (hashIndex < 0) return { pathname: href, hash: null };
  return {
    pathname: href.slice(0, hashIndex),
    hash: href.slice(hashIndex + 1),
  };
}

function TaskOpenControl({
  task,
  onActivateTab,
  onFocusPortraitCharacter,
}: {
  task: DerivedProductionTask;
  onActivateTab: (tab: WorkTab) => void;
  onFocusPortraitCharacter: (characterTsid: string) => void;
}) {
  const pathname = usePathname();
  const { pathname: targetPath, hash } = splitHref(task.href);

  if (task.kind === "fill_frame_url") {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="h-7"
        onClick={() => {
          onActivateTab("frames");
          window.requestAnimationFrame(() => {
            document
              .getElementById("batch-frames")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            if (hash) {
              document
                .getElementById(hash)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          });
        }}
      >
        打开
      </Button>
    );
  }

  if (task.kind === "complete_character_portrait") {
    const characterTsid = task.target?.characterTsid;
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="h-7"
        onClick={() => {
          onActivateTab("portraits");
          if (characterTsid) {
            onFocusPortraitCharacter(characterTsid);
          }
          window.requestAnimationFrame(() => {
            document
              .getElementById("batch-portraits")
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            if (characterTsid) {
              document
                .getElementById(`portrait-focus-${characterTsid}`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          });
        }}
      >
        打开
      </Button>
    );
  }

  const isSamePageHash =
    Boolean(hash) &&
    (targetPath === pathname || pathname.endsWith(targetPath));

  if (isSamePageHash && hash) {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="h-7"
        onClick={() => {
          document
            .getElementById(hash)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          window.history.replaceState(null, "", `#${hash}`);
        }}
      >
        打开
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7" asChild>
      <Link href={task.href}>打开</Link>
    </Button>
  );
}

export function ProductionBoard({
  workId,
  plan,
  routes,
  characters,
  onAssetsChanged,
}: ProductionBoardProps) {
  const frameTasks = plan.tasks.filter((t) => t.kind === "fill_frame_url");
  const portraitTasks = plan.tasks.filter(
    (t) => t.kind === "complete_character_portrait"
  );

  const [tab, setTab] = React.useState<WorkTab>("frames");
  const didAutoPickTabRef = React.useRef(false);
  const [focusPortrait, setFocusPortrait] = React.useState<{
    tsid: string;
    nonce: number;
  } | null>(null);

  React.useEffect(() => {
    if (didAutoPickTabRef.current) return;
    didAutoPickTabRef.current = true;
    if (frameTasks.length === 0 && portraitTasks.length > 0) {
      setTab("portraits");
    }
  }, [frameTasks.length, portraitTasks.length]);

  const activateTab = React.useCallback((next: WorkTab) => {
    setTab(next);
  }, []);

  const focusPortraitCharacter = React.useCallback((characterTsid: string) => {
    setFocusPortrait({ tsid: characterTsid, nonce: Date.now() });
  }, []);

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,38vh)_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:grid-rows-1">
      {/* Left rail: plan + derived tasks (internal scroll) */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-hidden lg:h-full">
        <section
          className="shrink-0 space-y-2 rounded-lg border border-zinc-200 bg-white p-3"
          aria-labelledby="plan-progress-heading"
        >
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h2
                id="plan-progress-heading"
                className="text-sm font-semibold text-zinc-900"
              >
                Production Plan
              </h2>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                {plan.profileId} · Assets 派生
              </p>
            </div>
            <p className="text-xl font-semibold tabular-nums text-zinc-900">
              {plan.progressPercent}%
            </p>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
            role="progressbar"
            aria-valuenow={plan.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-zinc-800 transition-[width]"
              style={{ width: `${plan.progressPercent}%` }}
            />
          </div>
          <ul className="space-y-1">
            {plan.checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate text-zinc-700">{item.label}</span>
                <span
                  className={
                    item.done
                      ? "shrink-0 font-medium text-emerald-700"
                      : "shrink-0 tabular-nums text-zinc-500"
                  }
                >
                  {item.done
                    ? "完成"
                    : item.total > 0
                      ? `${item.complete}/${item.total}`
                      : "待办"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
          aria-labelledby="derived-tasks-heading"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-3 py-2">
            <h2
              id="derived-tasks-heading"
              className="text-sm font-semibold text-zinc-900"
            >
              派生任务
            </h2>
            <span className="text-[11px] tabular-nums text-zinc-500">
              {plan.tasks.length}
            </span>
          </div>
          {plan.tasks.length === 0 ? (
            <p className="px-3 py-3 text-xs text-emerald-800">
              当前 profile 下无未完成缺口。
            </p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto">
              {plan.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">
                      {task.label}
                    </p>
                    <p className="truncate text-[10px] text-zinc-400">
                      {task.kind}
                    </p>
                  </div>
                  <TaskOpenControl
                    task={task}
                    onActivateTab={activateTab}
                    onFocusPortraitCharacter={focusPortraitCharacter}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {/* Right: job workbench with tabs */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as WorkTab)}
          className="flex h-full min-h-0 flex-col gap-0"
        >
          <div className="shrink-0 border-b border-zinc-100 px-3 py-2">
            <TabsList className="h-8 w-auto">
              <TabsTrigger value="frames" className="text-xs">
                画面帧
                {frameTasks.length > 0 ? (
                  <span className="ml-1 tabular-nums text-zinc-400">
                    {frameTasks.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="portraits" className="text-xs">
                角色肖像
                {portraitTasks.length > 0 ? (
                  <span className="ml-1 tabular-nums text-zinc-400">
                    {portraitTasks.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="frames"
            className="mt-0 min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden"
          >
            <BatchFrameCompletion
              workId={workId}
              routes={routes}
              incompleteCount={frameTasks.length}
              onWrote={onAssetsChanged}
            />
          </TabsContent>
          <TabsContent
            value="portraits"
            className="mt-0 min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden"
          >
            <BatchPortraitCompletion
              workId={workId}
              characters={characters}
              incompleteCount={portraitTasks.length}
              onWrote={onAssetsChanged}
              focusCharacterTsid={focusPortrait?.tsid ?? null}
              focusNonce={focusPortrait?.nonce ?? 0}
              onFocusCharacterHandled={() => setFocusPortrait(null)}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
