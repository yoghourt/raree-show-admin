"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin =
    pathname === "/login" || pathname.startsWith("/login/");

  if (isLogin) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen">
      <AppSidebar />
      <main className="min-h-screen bg-zinc-50 pl-[220px]">{children}</main>
    </div>
  );
}
