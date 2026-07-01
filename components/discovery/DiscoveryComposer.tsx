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
import type { UseDiscoverySessionReturn } from "@/hooks/useDiscoverySession";
import { Input } from "@/components/ui/input";
import type { NarrativeExcerpt } from "@/lib/discovery/types";

export interface DiscoveryComposerProps {
  discovery: UseDiscoverySessionReturn;
}

export function DiscoveryComposer({ discovery }: DiscoveryComposerProps) {
  const {
    session,
    gateResult,
    gateFlags,
    setGateFlags,
    sessionConflict,
    isLocking,
    lockError,
    canPropose,
    minProseRequired,
    updateNarrative,
    setInputMode,
    lockNarrative,
    unlockNarrative,
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
          当前作品已存在另一个 Discovery 会话（D3-RC-10）。请关闭其他标签页后刷新。
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>叙事输入引导</CardTitle>
          <CardDescription>{DISCOVERY_NARRATIVE_HINT}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-zinc-800">禁止作为唯一输入：</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {DISCOVERY_FORBIDDEN_INPUTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>示例（规范文案）</CardTitle>
          <CardDescription>SPEC-D3-001 §4.4.1 — Good / Bad examples</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DISCOVERY_EXAMPLES.map((row) => (
              <div
                key={`${row.label}-${row.verdict}`}
                className="rounded-lg border border-zinc-200 p-3 text-sm"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.label}</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {row.verdict}
                  </span>
                </div>
                <p className="text-muted-foreground">{row.example}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>叙事输入</CardTitle>
          <CardDescription>
            {session.state === "narrative_locked"
              ? `已锁定 · ${session.lockedAt ?? ""}`
              : `草稿 · 至少需要 ${minProseRequired} 字符 · 当前 ${gateResult.totalProse} 字符`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="input-mode">输入模式</Label>
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
                  跨章摘录 bundle（≥ {EXCERPT_BUNDLE_MIN_PROSE} 字）
                </SelectItem>
                <SelectItem value="approved_summary">
                  经确认的摘要（≥ {APPROVED_SUMMARY_MIN_PROSE} 字）
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              切换输入模式会清空当前叙事草稿，字符计数从 0 重新计算。
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
                    <Label>摘录 #{excerpt.orderIndex + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!editable || narrative.excerpts.length <= 1}
                      onClick={() => removeExcerpt(index)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      删除
                    </Button>
                  </div>
                  <Input
                    placeholder="来源标签（可选），如 Chapter 47 — Catelyn POV"
                    value={excerpt.sourceLabel ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      updateExcerpt(index, { sourceLabel: e.target.value })
                    }
                  />
                  <Textarea
                    placeholder='粘贴叙事摘录 prose…（Bad 示例如 "Red Wedding, Robb, Walder Frey, Catelyn" 应粘贴在此处）'
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
                添加摘录
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="operator-summary">
              {narrative.inputMode === "approved_summary"
                ? "经确认摘要（必填）"
                : "操作者摘要（可选）"}
            </Label>
            <Textarea
              id="operator-summary"
              placeholder="Operator summary prose…"
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
                excerpt_bundle 模式下摘要不能替代摘录；仅填摘要会触发 NG-07，关键词式摘要还会触发 NG-05。
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
                我确认此摘要准确代表待 Discovery 的叙事内容（summaryAttested）
              </Label>
            </div>
          ) : null}

          {editable ? (
            <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4">
              <p className="text-sm font-medium">导入标记（仅用于 Gate 校验，不会写入锁定 bundle）</p>
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
                  内容仅来自 Chapter Catalog 导出，未添加叙事 prose（NG-06）
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
                  内容仅来自 Runtime Scene 列表/元数据导出（NG-06）
                </Label>
              </div>
            </div>
          ) : null}

          {!gateResult.pass && editable ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              <div className="mb-2 flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                Narrative Gate 未通过
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
              锁定叙事
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void unlockNarrative()}
            >
              <Unlock className="size-4" aria-hidden />
              解锁叙事
            </Button>
          )}
          <Button type="button" disabled={!canPropose} variant="secondary">
            开始 Propose（待 SPEC-D3-003）
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认锁定叙事输入？</DialogTitle>
            <DialogDescription>
              锁定后叙事 bundle 在 propose / review 完成前不可编辑。此操作需显式确认（§4.4）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLockDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={isLocking}
              onClick={() => void handleConfirmLock()}
            >
              确认锁定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
