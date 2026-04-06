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

// TODO: replace with work.map_url when maps table is implemented
const MAP_URL =
  "https://res.cloudinary.com/dnuxz94n5/image/upload/f_auto,q_auto/v1/raree-show/maps/westeros";

export type MapPickerValue = { x: number | null; y: number | null };

type MapPickerProps = {
  value: MapPickerValue;
  onChange: (coords: { x: number; y: number }) => void;
};

function formatCoord(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

export function MapPicker({ value, onChange }: MapPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [marker, setMarker] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    if (!open) return;
    if (value.x != null && value.y != null) {
      setMarker({ x: value.x, y: value.y });
    } else {
      setMarker(null);
    }
  }, [open, value.x, value.y]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full sm:w-auto">
          {hasCoords
            ? `已标记 (${formatCoord(value.x)}, ${formatCoord(value.y)})`
            : "在地图上标记位置"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-[90vw] gap-3 p-3 sm:max-w-[90vw]"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>标记地图位置</DialogTitle>
          <DialogDescription>
            点击维斯特洛地图上的位置，坐标为 0–1 的相对值（宽、高）。
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[min(80vh,85vw)] w-full justify-center overflow-hidden">
          <span className="relative inline-block max-h-[min(80vh,85vw)] max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- external Cloudinary asset */}
            <img
              ref={imgRef}
              src={MAP_URL}
              alt="维斯特洛地图"
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
      </DialogContent>
    </Dialog>
  );
}
