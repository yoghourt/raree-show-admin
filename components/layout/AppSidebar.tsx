"use client";

import { Library, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const mainNav = [
  {
    href: "/works",
    label: "作品管理",
    icon: Library,
    match: (path: string) => path === "/works" || path.startsWith("/works/"),
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-800 px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-zinc-700/80">
          <Sparkles className="size-4 text-zinc-300" aria-hidden />
        </div>
        <span className="text-xs font-semibold tracking-tight text-zinc-100">
          Raree Admin
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="主导航">
        {mainNav.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              )}
            >
              <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
