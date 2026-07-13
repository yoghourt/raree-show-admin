"use client";

/**
 * RolloutDrawer — 故事页面内嵌的写入作品抽屉
 *
 * 将原 /works/[workId]/rollout 页面内容迁移到 Sheet，
 * 供故事页面通过右侧抽屉打开，无需跳转页面。
 */

import * as React from "react";

import { RolloutPanel } from "@/components/rollout/RolloutPanel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRollout } from "@/hooks/useRollout";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import { supabase } from "@/lib/supabase";

export interface RolloutDrawerProps {
  workId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RolloutDrawer({ workId, open, onOpenChange }: RolloutDrawerProps) {
  const [operatorId, setOperatorId] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        setAuthError("无法获取当前用户");
        setOperatorId(null);
        return;
      }
      setAuthError(null);
      setOperatorId(data.user.id);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rollout = useRollout({
    workId,
    operatorId: operatorId ?? "",
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="xl" className="flex flex-col overflow-hidden p-0">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{rolloutUi.pageTitle}</SheetTitle>
          <SheetDescription>{rolloutUi.pageSubtitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {authError ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {authError}
            </div>
          ) : operatorId ? (
            <RolloutPanel
              workId={workId}
              rollout={rollout}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{rolloutUi.loading}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
