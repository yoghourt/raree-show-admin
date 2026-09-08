"use client";

import * as React from "react";

import { ImageUploader } from "@/components/ui/ImageUploader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  acceptPublishedWorkMapAsset,
  acceptWorkMapGeometry,
  createMediaAsset,
  getWorkMap,
  resolveWorkMapForWork,
  setWorkMapCapability,
  type WorkMapRecord,
  type WorkMapResolution,
} from "@/lib/work-maps";
import type { MapCapability } from "@/lib/work-maps/resolve";

type WorkMapPanelProps = {
  workId: string;
  initialCapability: MapCapability;
};

function toError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function WorkMapPanel({ workId, initialCapability }: WorkMapPanelProps) {
  const [capability, setCapability] =
    React.useState<MapCapability>(initialCapability);
  const [record, setRecord] = React.useState<WorkMapRecord | null>(null);
  const [resolution, setResolution] = React.useState<WorkMapResolution | null>(
    null
  );
  const [candidateUrl, setCandidateUrl] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const [map, resolved] = await Promise.all([
      getWorkMap(workId),
      resolveWorkMapForWork(workId),
    ]);
    setRecord(map);
    setResolution(resolved);
  }, [workId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setError(toError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">作品地图权威</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          SPEC-WMA-001：几何与视觉分开验收。相同 geometry_id 仅表示同一规范空间参照系，不是「看起来像」。
        </p>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <p className="text-muted-foreground text-sm" role="status">
          {message}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="work-map-capability">地图能力</Label>
        <select
          id="work-map-capability"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
          value={capability}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value === "required" ? "required" : "off";
            void run(async () => {
              await setWorkMapCapability(workId, next);
              setCapability(next);
              setMessage(
                next === "required"
                  ? "已开启地图能力。请接受几何并发布地图资产。"
                  : "已关闭地图能力。Reader 不会展示地图。"
              );
            });
          }}
        >
          <option value="off">off — 不提供地图</option>
          <option value="required">required — 需要作品地图权威</option>
        </select>
      </div>

      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">geometry_id：</span>
          <span className="font-mono text-xs">
            {record?.geometryId ?? "（未建立）"}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">几何验收：</span>
          {record?.geometryAcceptedAt ?? "未验收"}
        </p>
        <p>
          <span className="text-muted-foreground">published_asset_id：</span>
          <span className="font-mono text-xs">
            {record?.publishedAssetId ?? "（未发布）"}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">视觉验收：</span>
          {record?.publishedAssetAcceptedAt ?? "未验收"}
        </p>
        <p>
          <span className="text-muted-foreground">resolve：</span>
          {resolution?.status ?? "…"}
          {resolution?.status === "not_map_ready"
            ? ` (${resolution.reasons.join(", ")})`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || capability === "off"}
          onClick={() =>
            void run(async () => {
              await acceptWorkMapGeometry(workId, { replaceGeometry: false });
              setMessage(
                "已接受规范几何。换皮可保留 geometry_id；改参照系请用「更换几何」。"
              );
            })
          }
        >
          {record?.geometryId ? "重新确认几何" : "接受几何"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || capability === "off" || !record?.geometryId}
          onClick={() => {
            if (
              !window.confirm(
                "更换 geometry_id 会使现有地点钉点失效，需人工重新标记。确定？"
              )
            ) {
              return;
            }
            void run(async () => {
              await acceptWorkMapGeometry(workId, { replaceGeometry: true });
              setMessage("已更换规范几何。请重新钉点所有需要地图的地点。");
            });
          }}
        >
          更换几何（作废旧钉点）
        </Button>
      </div>

      <div className="space-y-2">
        <Label>地图视觉候选</Label>
        <ImageUploader
          id="work-map-candidate"
          label="上传地图图"
          value={candidateUrl}
          onChange={setCandidateUrl}
          onUploadingChange={setUploading}
        />
        <p className="text-muted-foreground text-xs">
          上传只产生候选。点「接受为已发布资产」才会写入 media_assets 并挂到
          published_asset_id（URL 不是身份）。
        </p>
        <Button
          type="button"
          disabled={
            busy || uploading || capability === "off" || !candidateUrl.trim()
          }
          onClick={() =>
            void run(async () => {
              const asset = await createMediaAsset(candidateUrl.trim());
              await acceptPublishedWorkMapAsset(workId, asset.id);
              setMessage(
                `已发布地图资产 ${asset.id}。视觉验收 ≠ 几何验收。`
              );
            })
          }
        >
          接受为已发布资产
        </Button>
      </div>

      {resolution?.status === "ready" ? (
        <div className="space-y-2">
          <Label>已发布地图预览（resolved URL）</Label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolution.published_asset_url}
            alt="已发布作品地图"
            className="max-h-64 max-w-full rounded border object-contain"
          />
        </div>
      ) : null}
    </section>
  );
}
