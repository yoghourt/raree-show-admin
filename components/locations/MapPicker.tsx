"use client";

import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
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
import {
  cloudinaryDisplayUrl,
  WORK_MAP_DISPLAY_OPTIONS,
} from "@/lib/cloudinary-display";

export type MapPickerValue = { x: number | null; y: number | null };

type MapPickerProps = {
  value: MapPickerValue;
  onChange: (coords: { x: number; y: number }) => void;
  /** SPEC-WMA-001 resolve result — no Westeros / repository-local fallback. */
  resolution: WorkMapResolution | null;
  resolutionLoading?: boolean;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
/** 1 = fit entire map in the viewport (contain), centered. */
const FIT_ZOOM = 1;
/** Close-up for pinning labels; reset still returns to FIT_ZOOM. */
const INITIAL_ZOOM = 3.5;
const DRAG_THRESHOLD_PX = 5;

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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function centeredPan(
  z: number,
  pin: { x: number; y: number } | null,
  nat: { w: number; h: number },
  vp: { w: number; h: number }
) {
  if (nat.w <= 0 || nat.h <= 0 || vp.w <= 0 || vp.h <= 0) {
    return { x: 0, y: 0 };
  }
  const fit = Math.min(vp.w / nat.w, vp.h / nat.h);
  const s = fit * z;
  const imgW = nat.w * s;
  const imgH = nat.h * s;
  if (pin) {
    return {
      x: vp.w / 2 - pin.x * imgW,
      y: vp.h / 2 - pin.y * imgH,
    };
  }
  return {
    x: (vp.w - imgW) / 2,
    y: (vp.h - imgH) / 2,
  };
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
  const [zoom, setZoom] = React.useState(INITIAL_ZOOM);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [natural, setNatural] = React.useState({ w: 0, h: 0 });
  const [viewport, setViewport] = React.useState({ w: 0, h: 0 });
  const [panning, setPanning] = React.useState(false);
  const openRef = React.useRef(false);

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  /** After open, recenter once layout+image are ready; ignore later user pans. */
  const needsCenterRef = React.useRef(false);
  const centerPinRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);

  const ready = resolution?.status === "ready";
  const mapUrl = ready
    ? cloudinaryDisplayUrl(
        resolution.published_asset_url,
        WORK_MAP_DISPLAY_OPTIONS
      )
    : null;

  const fitScale =
    natural.w > 0 &&
    natural.h > 0 &&
    viewport.w > 0 &&
    viewport.h > 0
      ? Math.min(viewport.w / natural.w, viewport.h / natural.h)
      : 0;
  const scale = fitScale > 0 ? fitScale * zoom : 1;

  const applyCenter = React.useCallback(
    (
      z: number,
      pin: { x: number; y: number } | null,
      nat = natural,
      vp = viewport
    ) => {
      setPan(centeredPan(z, pin, nat, vp));
    },
    [natural, viewport]
  );

  React.useEffect(() => {
    if (!open) {
      openRef.current = false;
      setPanning(false);
      return;
    }
    const nextMarker =
      value.x != null && value.y != null
        ? { x: value.x, y: value.y }
        : null;
    setMarker(nextMarker);
    const justOpened = !openRef.current;
    openRef.current = true;
    if (!justOpened) return;
    setZoom(INITIAL_ZOOM);
    centerPinRef.current = nextMarker;
    needsCenterRef.current = true;
  }, [open, value.x, value.y]);

  React.useEffect(() => {
    if (!open) return;
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, mapUrl]);

  React.useEffect(() => {
    if (!open || !mapUrl) return;
    const img = imgRef.current;
    if (!img?.complete || img.naturalWidth <= 0) return;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(nat);
  }, [open, mapUrl]);

  React.useEffect(() => {
    if (!open || !needsCenterRef.current) return;
    if (natural.w <= 0 || natural.h <= 0 || viewport.w <= 0 || viewport.h <= 0) {
      return;
    }
    applyCenter(INITIAL_ZOOM, centerPinRef.current);
    needsCenterRef.current = false;
  }, [open, natural, viewport, applyCenter]);

  const zoomAtPoint = (nextZoom: number, clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el || natural.w <= 0 || fitScale <= 0) return;
    const rect = el.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const z0 = zoom;
    const z1 = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (z1 === z0) return;
    const s0 = fitScale * z0;
    const s1 = fitScale * z1;
    const ix = (vx - pan.x) / s0;
    const iy = (vy - pan.y) / s0;
    setZoom(z1);
    setPan({
      x: vx - ix * s1,
      y: vy - iy * s1,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAtPoint(zoom * factor, e.clientX, e.clientY);
  };

  const commitPin = (clientX: number, clientY: number) => {
    if (!ready) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;
    const nx = clamp((clientX - rect.left) / w, 0, 1);
    const ny = clamp((clientY - rect.top) / h, 0, 1);
    setMarker({ x: nx, y: ny });
    onChange({ x: nx, y: ny });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (
      !drag.moved &&
      (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)
    ) {
      drag.moved = true;
    }
    if (drag.moved) {
      setPanning(true);
      setPan({
        x: drag.originPanX + dx,
        y: drag.originPanY + dy,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!drag.moved) {
      commitPin(e.clientX, e.clientY);
    }
  };

  const resetView = () => {
    setZoom(FIT_ZOOM);
    applyCenter(FIT_ZOOM, marker ?? centerPinRef.current);
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
        className="flex h-[min(96vh,960px)] w-[min(98vw,1400px)] max-w-[98vw] flex-col gap-2 overflow-hidden p-3 sm:max-w-[98vw]"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 pr-8">
          <DialogTitle>标记地图位置</DialogTitle>
          <DialogDescription>
            默认放大到标记附近（无标记则放大中心）。单击落点后红点会留在图上，弹窗保持打开；拖拽平移，滚轮缩放。复位看整图。
          </DialogDescription>
        </DialogHeader>

        {mapUrl ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const el = viewportRef.current;
                  if (!el) {
                    setZoom((z) => clamp(z / ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
                    return;
                  }
                  const r = el.getBoundingClientRect();
                  zoomAtPoint(
                    zoom / ZOOM_STEP,
                    r.left + r.width / 2,
                    r.top + r.height / 2
                  );
                }}
                aria-label="缩小"
              >
                <MinusIcon className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const el = viewportRef.current;
                  if (!el) {
                    setZoom((z) => clamp(z * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
                    return;
                  }
                  const r = el.getBoundingClientRect();
                  zoomAtPoint(
                    zoom * ZOOM_STEP,
                    r.left + r.width / 2,
                    r.top + r.height / 2
                  );
                }}
                aria-label="放大"
              >
                <PlusIcon className="size-4" />
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetView}>
                <RotateCcwIcon className="size-4" />
                复位
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                {zoom.toFixed(1)}×（1.0 = 适应窗口）
              </span>
            </div>

            <div
              ref={viewportRef}
              className="bg-muted/40 relative min-h-0 flex-1 touch-none overflow-hidden rounded-md ring-1 ring-border"
              style={{ cursor: panning ? "grabbing" : "crosshair" }}
              onWheel={handleWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="absolute left-0 top-0 origin-top-left will-change-transform"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  width: natural.w || undefined,
                  height: natural.h || undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- resolved published asset URL */}
                <img
                  ref={imgRef}
                  src={mapUrl}
                  alt="作品已发布地图"
                  className="pointer-events-none block max-w-none select-none"
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const nat = {
                      w: img.naturalWidth,
                      h: img.naturalHeight,
                    };
                    setNatural(nat);
                    const el = viewportRef.current;
                    if (el && needsCenterRef.current) {
                      const vp = { w: el.clientWidth, h: el.clientHeight };
                      setViewport(vp);
                      setPan(
                        centeredPan(
                          INITIAL_ZOOM,
                          centerPinRef.current,
                          nat,
                          vp
                        )
                      );
                      needsCenterRef.current = false;
                    }
                  }}
                />
                {marker ? (
                  <div
                    className="pointer-events-none absolute h-3 w-3 rounded-full bg-red-600 shadow-md ring-2 ring-white"
                    style={{
                      left: `${marker.x * 100}%`,
                      top: `${marker.y * 100}%`,
                      transform: `translate(-50%, -50%) scale(${1 / Math.max(scale, 0.001)})`,
                    }}
                    aria-hidden
                  />
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm" role="status">
            {blockMessage}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
