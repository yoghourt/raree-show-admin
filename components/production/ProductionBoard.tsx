"use client";

import Link from "next/link";
import * as React from "react";

import { BatchFrameCompletion } from "@/components/production/BatchFrameCompletion";
import { Button } from "@/components/ui/button";
import type { ProductionPlanProjection } from "@/lib/production/types";
import type { ReadingRoute } from "@/lib/types";

export type ProductionBoardProps = {
  workId: string;
  plan: ProductionPlanProjection;
  routes: ReadingRoute[];
  onAssetsChanged: () => void;
};

export function ProductionBoard({
  workId,
  plan,
  routes,
  onAssetsChanged,
}: ProductionBoardProps) {
  const frameTasks = plan.tasks.filter((t) => t.kind === "fill_frame_url");

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="plan-progress-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="plan-progress-heading"
              className="text-base font-semibold text-zinc-900"
            >
              Production Plan
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              进度由 Assets 派生（profile: {plan.profileId}
              ）。任务不是第二套权威数据。
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-zinc-900">
            {plan.progressPercent}%
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-zinc-100"
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
        <ul className="grid gap-2 sm:grid-cols-2">
          {plan.checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <span className="text-zinc-800">{item.label}</span>
              <span
                className={
                  item.done
                    ? "font-medium text-emerald-700"
                    : "tabular-nums text-zinc-500"
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

      <section className="space-y-3" aria-labelledby="derived-tasks-heading">
        <h2
          id="derived-tasks-heading"
          className="text-base font-semibold text-zinc-900"
        >
          派生任务
        </h2>
        {plan.tasks.length === 0 ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            当前 profile 下无未完成缺口。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {plan.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">{task.label}</p>
                  <p className="text-xs text-zinc-500">{task.kind}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={task.href}>打开</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BatchFrameCompletion
        workId={workId}
        routes={routes}
        incompleteCount={frameTasks.length}
        onWrote={onAssetsChanged}
      />
    </div>
  );
}
