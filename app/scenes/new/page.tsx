import Link from "next/link";

import { SceneForm } from "@/components/scenes/SceneForm";
import { Button } from "@/components/ui/button";

export default function NewScenePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/scenes">← 返回列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新增场景</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          标签与角色 ID 支持英文逗号分隔多个值。
        </p>
      </div>
      <SceneForm mode="create" />
    </div>
  );
}
