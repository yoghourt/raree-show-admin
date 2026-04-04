import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppSidebar />
      <main className="min-h-screen bg-zinc-50 pl-[220px]">{children}</main>
    </div>
  );
}
