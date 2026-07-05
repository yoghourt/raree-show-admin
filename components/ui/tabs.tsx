"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-full flex-wrap items-center justify-start gap-1 rounded-lg p-1",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-xs",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-3 focus-visible:outline-none",
        className
      )}
      {...props}
    />
  );
}

/**
 * Step-style tab list — used for pipeline/workflow views.
 * Place `StepTabsTrigger` items inside, with `StepConnector` between them.
 */
function StepTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="step-tabs-list"
      className={cn(
        "flex h-auto flex-wrap items-center gap-0 bg-transparent p-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Step-style tab trigger — shows a step-number circle that fills with
 * primary color when the tab is active.
 *
 * Use `group/step` is already applied; child spans can use
 * `group-data-[state=active]/step:` variants.
 */
function StepTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="step-tabs-trigger"
      className={cn(
        "group/step",
        "inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium",
        "border-border text-muted-foreground whitespace-nowrap",
        "hover:bg-muted/40 hover:text-foreground transition-colors",
        "data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-foreground",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  StepTabsList,
  StepTabsTrigger,
};
