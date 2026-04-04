"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { SceneForm } from "@/components/scenes/SceneForm";
import { Button } from "@/components/ui/button";
import { getScene } from "@/lib/scenes";
import type { Scene } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function EditScenePage() {
  const params = useParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const decodedId = id ? decodeURIComponent(id) : "";

  const [scene, setScene] = React.useState<Scene | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!decodedId) {
      setScene(null);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const s = await getScene(decodedId);
        if (cancelled) return;
        setScene(s);
      } catch (e) {
        if (!cancelled) {
          setLoadError(toErrorMessage(e));
          setScene(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decodedId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/scenes">← 返回列表</Link>
        </Button>
        <div className="text-muted-foreground text-sm" aria-busy="true">
          加载中…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/scenes">← 返回列表</Link>
        </Button>
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/scenes">← 返回列表</Link>
        </Button>
        <p className="text-muted-foreground">
          未找到该场景（tsid：{decodedId || "—"}）。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/scenes">← 返回列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">编辑场景</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {scene.tsid}
        </p>
      </div>
      <SceneForm key={scene.tsid} mode="edit" defaultValues={scene} />
    </div>
  );
}
