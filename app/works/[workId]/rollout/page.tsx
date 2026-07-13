"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";

/**
 * Legacy `/rollout` route — redirects into the unified Discovery workbench.
 */
export default function WorkRolloutRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";

  React.useEffect(() => {
    if (!workId) return;
    router.replace(
      `/works/${encodeURIComponent(workId)}/discovery?step=rollout`
    );
  }, [workId, router]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
      正在打开提炼与写入工作台…
    </div>
  );
}
