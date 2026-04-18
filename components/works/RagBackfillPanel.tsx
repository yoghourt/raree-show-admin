"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type RagBackfillResult = {
  totalScenes: number;
  skipped: number;
  processed: number;
  success: number;
  failure: number;
  errors: { tsid: string; message: string }[];
};

type Props = {
  workId: string;
};

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

function formatApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err != null && typeof err === "object") {
    return JSON.stringify(err);
  }
  return fallback;
}

export function RagBackfillPanel({ workId }: Props) {
  const [force, setForce] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RagBackfillResult | null>(null);

  const onBackfill = async () => {
    if (!workId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/rag/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId, force }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error(formatApiError(data, res.statusText));
      }
      setResult(data as RagBackfillResult);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RAG 嵌入回填</CardTitle>
        <CardDescription>
          为当前作品下场景生成 <code className="text-xs">rag_text</code> 与{" "}
          <code className="text-xs">rag_embedding</code>（Gemini）。适合数据迁移后一次性回填。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="rag-force"
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
              disabled={loading}
            />
            <Label htmlFor="rag-force" className="cursor-pointer font-normal">
              强制重新嵌入（覆盖已有向量）
            </Label>
          </div>
          <Button type="button" disabled={loading || !workId} onClick={onBackfill}>
            {loading ? "处理中…" : "回填 RAG 向量"}
          </Button>
        </div>

        {error ? (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">结果</p>
            <ul className="grid gap-1 text-muted-foreground sm:grid-cols-2">
              <li>
                场景总数：<span className="text-foreground">{result.totalScenes}</span>
              </li>
              <li>
                跳过（已有向量）：<span className="text-foreground">{result.skipped}</span>
              </li>
              <li>
                本轮处理：<span className="text-foreground">{result.processed}</span>
              </li>
              <li>
                成功：<span className="text-foreground">{result.success}</span>
              </li>
              <li>
                失败：<span className="text-foreground">{result.failure}</span>
              </li>
            </ul>
            {result.errors.length > 0 ? (
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 font-medium text-destructive">失败明细</p>
                <ul className="max-h-48 space-y-2 overflow-auto text-xs">
                  {result.errors.map((err, i) => (
                    <li key={`${err.tsid}-${i}`} className="rounded bg-background/80 px-2 py-1">
                      <span className="font-mono text-foreground">{err.tsid}</span>
                      <span className="text-muted-foreground"> — {err.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
