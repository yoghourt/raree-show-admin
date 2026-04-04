"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { SceneForm } from "@/components/scenes/SceneForm";
import { Button } from "@/components/ui/button";
import { useScenes } from "@/hooks/useScenes";

export default function EditScenePage() {
  const params = useParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const decodedId = id ? decodeURIComponent(id) : "";

  const { getById } = useScenes();
  const scene = decodedId ? getById(decodedId) : undefined;

  if (!scene) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/scenes">← 返回列表</Link>
        </Button>
        <p className="text-muted-foreground">未找到该场景（tsid：{decodedId || "—"}）。</p>
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
