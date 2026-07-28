"use client";

/**
 * Narrative Regenerate — SPEC-D2-002 §9.5
 * Optional operator feedback is carried in RetryFieldRequest.feedback.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SuggestionItem } from "@/lib/ai/copilot-types";
import { getClassification } from "@/lib/ai/field-registry";

export interface NarrativeRegenButtonProps {
  field: string;
  currentValue: string;
  entityType: "character" | "location" | "scene";
  pendingItem: SuggestionItem | undefined;
  onRegen: (feedback?: string | null) => void | Promise<void>;
  onAcceptRegen: () => void;
  onDismissRegen: () => void;
}

export function NarrativeRegenButton({
  field,
  currentValue,
  entityType,
  pendingItem,
  onRegen,
  onAcceptRegen,
  onDismissRegen,
}: NarrativeRegenButtonProps) {
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // AC-26: classification from registry — no field-name literals in eligibility
  const classification = getClassification(entityType, field);
  if (classification !== "narrative") return null;
  if (!currentValue?.trim()) return null;

  if (pendingItem) {
    return (
      <div className="rounded-md border border-violet-200 bg-violet-50/60 p-2.5 space-y-1.5 dark:border-violet-800 dark:bg-violet-950/20">
        <p className="text-xs font-medium text-muted-foreground">再生成建议：</p>
        <p className="text-sm whitespace-pre-wrap">{pendingItem.value}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={onAcceptRegen}
          >
            接受并覆写
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onDismissRegen}
          >
            忽略
          </Button>
        </div>
      </div>
    );
  }

  if (showFeedback) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2.5">
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="（可选）反馈说明，例如：太短、语气不对、少了某段经历…"
          className="min-h-[60px] resize-none text-xs"
          autoFocus
          disabled={isLoading}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => {
              void (async () => {
                setIsLoading(true);
                try {
                  await onRegen(feedback.trim() || null);
                  setShowFeedback(false);
                  setFeedback("");
                } finally {
                  setIsLoading(false);
                }
              })();
            }}
          >
            {isLoading ? "生成中…" : "确认再生成"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => {
              setShowFeedback(false);
              setFeedback("");
            }}
          >
            取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => setShowFeedback(true)}
    >
      <RegenIcon />
      再生成
    </Button>
  );
}

function RegenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1 h-3 w-3"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
