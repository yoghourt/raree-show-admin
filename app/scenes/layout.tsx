import type { ReactNode } from "react";

import { ScenesProvider } from "@/hooks/useScenes";

export default function ScenesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ScenesProvider>{children}</ScenesProvider>;
}
