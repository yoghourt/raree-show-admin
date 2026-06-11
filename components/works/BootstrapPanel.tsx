"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type BootstrapError = { phase: string; message: string };

type BootstrapResult = {
  success: boolean;
  charactersCreated: number;
  locationsCreated: number;
  scenesCreated: number;
  errors: BootstrapError[];
};

type SseEvent =
  | { type: "phase"; message: string }
  | { type: "done"; result: BootstrapResult };

type State = "idle" | "generating" | "success" | "error";

interface BootstrapPanelProps {
  workId: string;
}

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function BootstrapPanel({ workId }: BootstrapPanelProps) {
  const [state, setState] = useState<State>("idle");
  const [clearExisting, setClearExisting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleBootstrap = async () => {
    setState("generating");
    setResult(null);
    setErrorMessage("");
    setStatusMessage("正在连接…");

    try {
      const res = await fetch("/api/admin/ai/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId, clearExisting }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const msg =
          typeof data.error === "string"
            ? data.error
            : `HTTP ${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      // SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          let event: SseEvent;
          try {
            event = JSON.parse(payload) as SseEvent;
          } catch {
            continue;
          }

          if (event.type === "phase") {
            setStatusMessage(event.message);
          } else if (event.type === "done") {
            setResult(event.result);
            setState(event.result.success ? "success" : "error");
            if (!event.result.success && event.result.errors.length > 0) {
              setErrorMessage(
                event.result.errors.map((e) => `[${e.phase}] ${e.message}`).join("\n")
              );
            }
          }
        }
      }

      // If we never got a done event, treat as error
      if (result === null) {
        throw new Error("服务端未返回完成事件，请刷新重试");
      }
    } catch (e) {
      setErrorMessage(toErrorMessage(e));
      setState("error");
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold">D2 Bootstrap — AI 生成角色 / 地点 / 场景</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          根据作品标题与简介，自动生成并持久化初始内容。部分失败不会回滚。
        </p>
      </div>

      {state !== "generating" && (
        <div className="mb-3 flex items-center gap-2">
          <Checkbox
            id="clear-existing"
            checked={clearExisting}
            onCheckedChange={(v) => setClearExisting(Boolean(v))}
          />
          <Label htmlFor="clear-existing" className="text-xs">
            执行前清空现有角色、地点与场景
          </Label>
        </div>
      )}

      {state === "idle" && (
        <Button size="sm" onClick={handleBootstrap}>
          执行 Bootstrap
        </Button>
      )}

      {state === "generating" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span>{statusMessage}</span>
          </div>
        </div>
      )}

      {state === "success" && result && (
        <div className="space-y-2">
          <p className="text-sm text-green-600 dark:text-green-400">
            Bootstrap 完成 — 角色 {result.charactersCreated} 个、地点{" "}
            {result.locationsCreated} 个、场景 {result.scenesCreated} 个。
          </p>
          {result.errors.length > 0 && (
            <details className="text-xs text-yellow-600 dark:text-yellow-400">
              <summary className="cursor-pointer">
                {result.errors.length} 个部分失败（展开查看）
              </summary>
              <pre className="mt-1 whitespace-pre-wrap">
                {result.errors
                  .map((e) => `[${e.phase}] ${e.message}`)
                  .join("\n")}
              </pre>
            </details>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setState("idle");
              setResult(null);
            }}
          >
            再次执行
          </Button>
        </div>
      )}

      {state === "error" && !result && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">Bootstrap 失败</p>
          {errorMessage && (
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {errorMessage}
            </pre>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setState("idle");
              setErrorMessage("");
            }}
          >
            重试
          </Button>
        </div>
      )}
    </div>
  );
}
