"use client";

/**
 * SuggestionPanel — Enrichment Copilot suggestion review panel
 *
 * SPEC-D2-002 §4.6 / §6 / §9
 *
 * Per-field actions: Accept | Skip | Add to Retry Queue (+ feedback text)
 * Panel-level actions: Accept All | Batch Retry
 *
 * Invariants:
 *   RT-INV-10: Accept writes to form state only — no DB write triggered here.
 *   RT-INV-09: Accept guard — does not overwrite non-empty form values.
 *   RT-INV-12: Accept All — bounded to current entity session, non-scope/non-asset only.
 *   RT-INV-11: Batch Retry — calls batchRetry() which issues exactly one HTTP request.
 *   AC-07: ConfidenceBadge is always visible inline (no hover required).
 *   AC-21: Confidence uses both color AND label.
 *   SV-01: Sources are displayed before acceptance.
 *   Decision 8 / AC-03: No catalog-level Accept All — this panel is entity-scoped.
 *
 * Note: Narrative Regenerate buttons (§9.5) are rendered per-field in the
 * individual form components (CharacterForm, LocationForm, SceneForm), not here.
 * Those forms read field classification from FIELD_REGISTRY to decide button
 * visibility without any hardcoded field names (AC-26, MD-01).
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge } from "@/components/copilot/ConfidenceBadge";
import type { RetryQueueEntry, SuggestionItem } from "@/lib/ai/copilot-types";
import { messages } from "@/lib/locale";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type SuggestFieldError = {
  field: string;
  code: string;
  message: string;
};

interface SuggestionPanelProps {
  suggestions: SuggestionItem[];
  retryQueue: RetryQueueEntry[];
  isRetrying: boolean;
  /** Fields that failed in the last suggest call (partial success) */
  suggestErrors?: SuggestFieldError[];

  /** Human-readable label for each field (e.g. { house: "家族" }) */
  fieldLabels?: Record<string, string>;

  /**
   * When false, the panel header (title + close button) is hidden.
   * Use when the panel is rendered inside a Sheet/drawer that provides its own header.
   * Defaults to true.
   */
  showHeader?: boolean;

  onAccept: (field: string, value: string) => void;
  onSkip: (field: string) => void;
  onAddToRetryQueue: (field: string, previousSuggestion: string, feedback: string | null) => void;
  onAcceptAll: () => void;
  onBatchRetry: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Per-field suggestion row
// ---------------------------------------------------------------------------

interface SuggestionRowProps {
  item: SuggestionItem;
  label: string;
  onAccept: (field: string, value: string) => void;
  onSkip: (field: string) => void;
  onAddToRetryQueue: (field: string, previousSuggestion: string, feedback: string | null) => void;
}

function SuggestionRow({
  item,
  label,
  onAccept,
  onSkip,
  onAddToRetryQueue,
}: SuggestionRowProps) {
  const [showRetryInput, setShowRetryInput] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");

  const handleAddToQueue = () => {
    onAddToRetryQueue(item.field, item.value, feedback.trim() || null);
    setShowRetryInput(false);
    setFeedback("");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      {/* Header: field label + confidence badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <ConfidenceBadge confidence={item.confidence} />
      </div>

      {/* Suggested value */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {item.value}
      </p>

      {/* Provenance — SC-03 / narrative path has no external sources */}
      {item.sources.length === 0 && (
        <p className="text-xs text-muted-foreground">
          来源：AI 生成（未匹配 verified 外部资料，请人工核实）
        </p>
      )}

      {/* Sources (SV-01: display before acceptance) */}
      {item.sources.length > 0 && (
        <div className="space-y-1">
          {item.sources.map((src, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="mt-0.5 shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                T{src.tier}
              </span>
              {src.url ? (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {src.label}
                </a>
              ) : (
                <span>{src.label}</span>
              )}
              {src.excerpt && (
                <span className="text-muted-foreground/70 ml-1">"{src.excerpt}"</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!showRetryInput ? (
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onAccept(item.field, item.value)}
          >
            接受
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onSkip(item.field)}
          >
            跳过
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setShowRetryInput(true)}
          >
            加入重试队列
          </Button>
        </div>
      ) : (
        /* Retry feedback input */
        <div className="space-y-2 pt-1">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="（可选）反馈说明，例如：太短、家族归属不对…"
            className="min-h-[60px] text-xs resize-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddToQueue}
            >
              确认加入队列
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setShowRetryInput(false);
                setFeedback("");
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function SuggestionPanel({
  suggestions,
  retryQueue,
  isRetrying,
  suggestErrors = [],
  fieldLabels = {},
  showHeader = true,
  onAccept,
  onSkip,
  onAddToRetryQueue,
  onAcceptAll,
  onBatchRetry,
  onClose,
}: SuggestionPanelProps) {
  const hasWork =
    suggestions.length > 0 || retryQueue.length > 0 || suggestErrors.length > 0;

  if (!hasWork) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          所有字段已处理完毕。
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 h-7 text-xs"
          onClick={onClose}
        >
          关闭
        </Button>
      </div>
    );
  }

  if (suggestions.length === 0 && retryQueue.length === 0 && suggestErrors.length > 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            未能生成建议
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
            {suggestErrors.map((err) => (
              <li key={`${err.field}-${err.code}`}>
                {err.field === "_session"
                  ? err.message
                  : `${fieldLabels[err.field] ?? err.field} — ${err.message}`}
              </li>
            ))}
          </ul>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onClose}
        >
          关闭
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Panel header — hidden when rendered inside a Sheet (showHeader=false) */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{messages.copilot.suggestions}</span>
            {suggestions.length > 0 && (
              <span className="rounded-full bg-violet-100 dark:bg-violet-900 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-300 font-medium">
                {messages.copilot.suggestionCount(suggestions.length)}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onClose}
            aria-label={messages.copilot.closePanelAria}
          >
            <CloseIcon />
          </Button>
        </div>
      )}

      {/* Partial failure banner */}
      {suggestErrors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            {messages.discovery.review.copilotRetryFailed}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
            {suggestErrors.map((err) => (
              <li key={err.field}>
                {fieldLabels[err.field] ?? err.field} — {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestion rows */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((item) => (
            <SuggestionRow
              key={item.field}
              item={item}
              label={fieldLabels[item.field] ?? item.field}
              onAccept={onAccept}
              onSkip={onSkip}
              onAddToRetryQueue={onAddToRetryQueue}
            />
          ))}
        </div>
      )}

      {/* Retry queue indicator */}
      {retryQueue.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 space-y-1">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            重试队列：{retryQueue.length} 个字段待重试
            {retryQueue.map((e) => (
              <span key={e.field} className="ml-1 font-medium">
                [{fieldLabels[e.field] ?? e.field}]
              </span>
            ))}
          </p>
          {suggestions.length === 0 && suggestErrors.length > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              上次重试未生成新建议，可修改反馈后再次点击「批量重试」。
            </p>
          )}
        </div>
      )}

      {/* Panel-level actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {/* Accept All — entity-scoped, RT-INV-12, AC-03: no catalog-level accept */}
        {suggestions.length > 1 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onAcceptAll}
          >
            全部接受
          </Button>
        )}

        {/* Batch Retry — single HTTP call, RT-INV-11 */}
        {retryQueue.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isRetrying}
            onClick={onBatchRetry}
          >
            {isRetrying ? "重试中…" : `批量重试 (${retryQueue.length})`}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
