"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WorkMapResolution } from "@/lib/work-maps/resolve";

export type MapPickerValue = { x: number | null; y: number | null };

type MapPickerProps = {
  value: MapPickerValue;
  onChange: (coords: { x: number; y: number }) => void;
  /** SPEC-WMA-001 resolve result — no Westeros / repository-local fallback. */
  resolution: WorkMapResolution | null;
  resolutionLoading?: boolean;
};

function formatCoord(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

function notReadyMessage(resolution: WorkMapResolution | null): string {
  if (!resolution) return "正在加载作品地图权威…";
  if (resolution.status === "not_applicable") {
    return "此作品未开启地图能力（map_capability = off）。请先在作品编辑页开启。";
  }
  if (resolution.status === "not_map_ready") {
    return `作品地图尚未就绪（${resolution.reasons.join(", ")}）。请先在作品编辑页接受几何并发布地图资产。`;
  }
  return "";
}

export function MapPicker({
  value,
  onChange,
  resolution,
  resolutionLoading,
}: MapPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [marker, setMarker] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const imgRef = React.useRef<HTMLImageElement>(null);

  const ready = resolution?.status === "ready";
  const mapUrl = ready ? resolution.published_asset_url : null;

  React.useEffect(() => {
    if (!open) return;
    if (value.x != null && value.y != null) {
      setMarker({ x: value.x, y: value.y });
    } else {
      setMarker(null);
    }
  }, [open, value.x, value.y]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!ready) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;
    const x = (e.clientX - rect.left) / w;
    const y = (e.clientY - rect.top) / h;
    const nx = Math.min(1, Math.max(0, x));
    const ny = Math.min(1, Math.max(0, y));
    setMarker({ x: nx, y: ny });
    onChange({ x: nx, y: ny });
    setOpen(false);
  };

  const hasCoords =
    value.x != null &&
    value.y != null &&
    !Number.isNaN(value.x) &&
    !Number.isNaN(value.y);

  const blocked = resolutionLoading || !ready;
  const blockMessage = notReadyMessage(resolution);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={blocked}
          title={blocked ? blockMessage : undefined}
        >
          {resolutionLoading
            ? "加载地图…"
            : blocked
              ? "地图未就绪，无法标记"
              : hasCoords
                ? `已标记 (${formatCoord(value.x)}, ${formatCoord(value.y)})`
                : "在地图上标记位置"}
        </Button>
      </DialogTrigger>
      {blocked ? (
        <p className="text-muted-foreground text-xs">{blockMessage}</p>
      ) : null}
      <DialogContent
        className="max-w-[90vw] gap-3 p-3 sm:max-w-[90vw]"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>标记地图位置</DialogTitle>
          <DialogDescription>
            点击已发布作品地图上的位置。坐标为相对规范几何的 0–1
            浮点值，不是相对某张图片 URL。
          </DialogDescription>
        </DialogHeader>
        {mapUrl ? (
          <div className="flex max-h-[min(80vh,85vw)] w-full justify-center overflow-hidden">
            <span className="relative inline-block max-h-[min(80vh,85vw)] max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- resolved published asset URL */}
              <img
                ref={imgRef}
                src={mapUrl}
                alt="作品已发布地图"
                className="block max-h-[min(80vh,85vw)] max-w-full cursor-crosshair object-contain"
                draggable={false}
                onClick={handleImageClick}
              />
              {marker ? (
                <div
                  className="pointer-events-none absolute h-3 w-3 rounded-full bg-red-600 shadow-md ring-2 ring-white"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  aria-hidden
                />
              ) : null}
            </span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm" role="status">
            {blockMessage}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
