"use client";

/**
 * useCopilotSession — Enrichment Copilot client-side state machine
 *
 * SPEC-D2-002 §4 / §6 / §9 / §12
 *
 * Governs:
 *   - Copilot icon state (disabled → enabled → panelOpen) [§12]
 *   - Duplicate check gate on scope field input [§4.2, AC-24]
 *   - Suggestion request trigger (icon click only, RT-INV-13)
 *   - Per-field Accept / Skip / Add-to-Retry-Queue actions [§4.6, §6]
 *   - Accept All (entity-scoped, non-scope/non-asset only) [§6.3, RT-INV-12]
 *   - Batch Retry (single HTTP call, RT-INV-11) [§9.2]
 *   - Narrative Regenerate (§9.5, Phase 2 — pendingRegen state)
 *   - Session teardown on entity navigation (RT-INV-07)
 *
 * sessionId is a correlation identifier only (§13.5, EAR-SPEC-D2-002-002).
 * No correctness logic depends on it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { getSuggestableFields, getClassification } from "@/lib/ai/field-registry";
import type {
  CopilotIconState,
  EntityType,
  RetryQueueEntry,
  SuggestionItem,
} from "@/lib/ai/copilot-types";

// ---------------------------------------------------------------------------
// Supabase duplicate check patterns (§4.2)
// ---------------------------------------------------------------------------

const DUP_CHECK_TABLE: Record<EntityType, string> = {
  character: "characters",
  location:  "locations",
  scene:     "scenes",
};

const DUP_CHECK_COLUMN: Record<EntityType, string> = {
  character: "name",
  location:  "name",
  scene:     "title",
};

const DUP_ENTITY_ID_COLUMN: Record<EntityType, string> = {
  character: "tsid",
  location:  "tsid",
  scene:     "tsid",
};

// ---------------------------------------------------------------------------
// Hook configuration
// ---------------------------------------------------------------------------

export interface UseCopilotSessionConfig {
  entityType: EntityType;
  workId: string;
  /** The existing entity tsid, or "new" for creation flows */
  entityId: string;
  /**
   * Called when the session successfully obtains suggestions and opens the panel.
   * The form uses this to know when the panel is open.
   */
  onPanelOpen?: () => void;
}

// ---------------------------------------------------------------------------
// Hook return interface
// ---------------------------------------------------------------------------

export type SuggestFieldError = {
  field: string;
  code: string;
  message: string;
};

export interface UseCopilotSessionReturn {
  /** Current state of the copilot trigger icon */
  iconState: CopilotIconState;
  /** Whether a duplicate conflict was detected for the current scope value */
  dupConflict: boolean;
  /** Whether the suggestion panel is currently visible */
  panelOpen: boolean;
  /** All suggestions returned from the last /suggest call */
  suggestions: SuggestionItem[];
  /** Set of field names the operator has explicitly skipped */
  skippedFields: Set<string>;
  /** Current retry queue */
  retryQueue: RetryQueueEntry[];
  /** Whether a batch retry request is in flight */
  isRetrying: boolean;
  /** Whether a /suggest request is in flight */
  isSuggesting: boolean;
  /** Pending narrative regen suggestions keyed by field name (§9.5) */
  pendingRegen: Record<string, SuggestionItem>;
  /** Fields that failed during the last /suggest call (partial success, §13.2) */
  suggestErrors: SuggestFieldError[];

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Must be called from the scope field's onChange handler.
   * Triggers debounced duplicate check and manages icon enable/disable state.
   * (AC-24, §4.2)
   */
  onScopeFieldChange: (value: string) => void;

  /**
   * Called on Copilot icon click. The sole trigger for suggestion generation.
   * (RT-INV-13, AC-25)
   *
   * @param formValues - Current form field values for empty-field filtering
   */
  triggerSuggest: (formValues: Record<string, unknown>) => Promise<void>;

  /**
   * Accept a suggestion: writes the value to form state via the provided setter.
   * Guard: does NOT write if the target field already has a non-empty value.
   * (RT-INV-09, RT-INV-10, AC-02)
   *
   * @param field - The field name
   * @param value - The suggested value to accept
   * @param currentFormValue - Current value of the field (empty check guard)
   * @param setFieldValue - react-hook-form setValue for the field
   */
  accept: (
    field: string,
    value: string,
    currentFormValue: unknown,
    setFieldValue: (field: string, value: string) => void
  ) => void;

  /**
   * Skip a suggestion. Dismissed — not included in Accept All.
   * The field may still be manually filled by the operator.
   * (§6.4)
   */
  skip: (field: string) => void;

  /**
   * Add a field to the retry queue with optional operator feedback.
   * (§9.1, §9.4)
   */
  addToRetryQueue: (
    field: string,
    previousSuggestion: string,
    feedback: string | null
  ) => void;

  /**
   * Execute Batch Retry — sends exactly ONE HTTP request with all queued fields.
   * (RT-INV-11, AC-10, §9.2)
   *
   * @param scopeFieldValue - Current scope field value (for prompt context)
   */
  batchRetry: (scopeFieldValue: string) => Promise<void>;

  /**
   * Accept all currently visible non-scope / non-asset suggestions.
   * Bounded to the current entity session only. (RT-INV-12, §6.3, AC-11)
   *
   * @param setFieldValue - react-hook-form setValue
   * @param getFieldValue - current form values accessor
   */
  acceptAll: (
    setFieldValue: (field: string, value: string) => void,
    getFieldValue: (field: string) => unknown
  ) => void;

  /** Dismiss the suggestion panel without navigating */
  closePanel: () => void;

  /**
   * Destroy all session state — must be called on entity navigation.
   * (RT-INV-07, §4.9)
   */
  teardown: () => void;

  /**
   * Initiate a Narrative Regenerate for a filled narrative field.
   * (§9.5, Phase 2)
   *
   * @param field - The narrative field to regenerate
   * @param currentValue - The current non-empty form field value
   * @param scopeFieldValue - Current scope value (for prompt context)
   * @param feedback - Optional operator guidance
   */
  narrativeRegen: (
    field: string,
    currentValue: string,
    scopeFieldValue: string,
    feedback?: string | null
  ) => Promise<void>;

  /**
   * Accept a pending Narrative Regenerate suggestion.
   * This DOES overwrite an existing non-empty form value (§9.5, RT-INV-09 exception).
   */
  acceptRegen: (
    field: string,
    setFieldValue: (field: string, value: string) => void
  ) => void;

  /** Dismiss a pending Narrative Regenerate suggestion without accepting */
  dismissRegen: (field: string) => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useCopilotSession(
  config: UseCopilotSessionConfig
): UseCopilotSessionReturn {
  const { entityType, workId, entityId, onPanelOpen } = config;

  // ── Core state ────────────────────────────────────────────────────────────
  const [iconState, setIconState] = useState<CopilotIconState>("disabled");
  const [dupConflict, setDupConflict] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [skippedFields, setSkippedFields] = useState<Set<string>>(new Set());
  const [retryQueue, setRetryQueue] = useState<RetryQueueEntry[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [pendingRegen, setPendingRegen] = useState<Record<string, SuggestionItem>>({});
  const [suggestErrors, setSuggestErrors] = useState<SuggestFieldError[]>([]);

  // Track current scope field value for retry context
  const scopeValueRef = useRef<string>("");
  const prevScopeForResetRef = useRef<string>("");

  // Debounce timer ref for duplicate check
  const dupCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Teardown — destroy all state (RT-INV-07)
  // ---------------------------------------------------------------------------

  const teardown = useCallback(() => {
    if (dupCheckTimer.current) {
      clearTimeout(dupCheckTimer.current);
      dupCheckTimer.current = null;
    }
    setIconState("disabled");
    setDupConflict(false);
    setPanelOpen(false);
    setSuggestions([]);
    setSkippedFields(new Set());
    setRetryQueue([]);
    setIsRetrying(false);
    setIsSuggesting(false);
    setPendingRegen({});
    setSuggestErrors([]);
    scopeValueRef.current = "";
    prevScopeForResetRef.current = "";
  }, []);

  // Teardown on unmount (handles route-level navigation in Next.js App Router)
  useEffect(() => {
    return () => {
      if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Duplicate check (§4.2, AC-24)
  // ---------------------------------------------------------------------------

  const runDupCheck = useCallback(
    async (scopeValue: string) => {
      const table = DUP_CHECK_TABLE[entityType];
      const column = DUP_CHECK_COLUMN[entityType];
      const idColumn = DUP_ENTITY_ID_COLUMN[entityType];

      let builder = supabase
        .from(table)
        .select(idColumn)
        .eq("work_id", workId)
        .eq(column, scopeValue);

      // In edit mode, exclude the entity itself from the conflict check
      if (entityId !== "new") {
        builder = builder.neq(idColumn, entityId);
      }

      const { data } = await builder.limit(1).maybeSingle();

      const isDuplicate = data !== null;

      if (isDuplicate) {
        setDupConflict(true);
        setIconState("disabled");
      } else {
        setDupConflict(false);
        setIconState("enabled");
      }
    },
    [entityType, workId, entityId]
  );

  const onScopeFieldChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();

      // Scope changed — discard stale suggestions so the next Copilot click re-fetches
      if (trimmed !== prevScopeForResetRef.current) {
        setSuggestions([]);
        setSuggestErrors([]);
        setRetryQueue([]);
        setSkippedFields(new Set());
        prevScopeForResetRef.current = trimmed;
      }

      scopeValueRef.current = value;

      // Clear any previous debounce timer
      if (dupCheckTimer.current) {
        clearTimeout(dupCheckTimer.current);
        dupCheckTimer.current = null;
      }

      if (!value.trim()) {
        // Scope field cleared — disable icon and clear conflict state (§12)
        setIconState("disabled");
        setDupConflict(false);
        return;
      }

      // OQ-05: icon remains disabled while async check is in progress
      setIconState("disabled");

      // Debounce 400ms
      dupCheckTimer.current = setTimeout(() => {
        runDupCheck(value.trim());
      }, 400);
    },
    [runDupCheck]
  );

  // ---------------------------------------------------------------------------
  // Suggest (RT-INV-13 — icon click is the sole trigger)
  // ---------------------------------------------------------------------------

  const triggerSuggest = useCallback(
    async (formValues: Record<string, unknown>) => {
      if (iconState !== "enabled") return;

      // Enumerate empty fields from registry (RT-INV-08, AC-22)
      const emptyFields = getSuggestableFields(entityType, formValues);
      if (emptyFields.length === 0) {
        setSuggestions([]);
        setSuggestErrors([
          {
            field: "_session",
            code: "NO_EMPTY_FIELDS",
            message:
              "当前没有可建议的空字段。如需重新生成，请先清空对应字段后再点击 Copilot。",
          },
        ]);
        setPanelOpen(true);
        onPanelOpen?.();
        return;
      }

      setIsSuggesting(true);
      setIconState("loading");

      try {
        const res = await fetch("/api/admin/ai/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            entityType,
            entityId,
            scopeField: scopeValueRef.current,
            emptyFields,
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const errorObj = body["error"] as Record<string, unknown> | undefined;
          console.error("[copilot] suggest failed", errorObj?.["code"], errorObj?.["message"]);
          return;
        }

        const body = (await res.json()) as {
          suggestions: SuggestionItem[];
          errors?: SuggestFieldError[];
        };
        const fieldErrors = body.errors ?? [];
        if (fieldErrors.length > 0) {
          console.warn("[copilot] partial suggest failure — some fields skipped", fieldErrors);
        }
        setSuggestErrors(fieldErrors);
        setSuggestions(body.suggestions ?? []);
        setSkippedFields(new Set());
        setPanelOpen(true);
        onPanelOpen?.();
      } catch (e) {
        console.error("[copilot] suggest network error", e);
      } finally {
        setIsSuggesting(false);
        setIconState("enabled");
      }
    },
    [iconState, entityType, workId, entityId, onPanelOpen]
  );

  // ---------------------------------------------------------------------------
  // Accept (RT-INV-09, RT-INV-10)
  // ---------------------------------------------------------------------------

  const accept = useCallback(
    (
      field: string,
      value: string,
      currentFormValue: unknown,
      setFieldValue: (field: string, value: string) => void
    ) => {
      // RT-INV-09: must not overwrite a non-empty form value
      // (Narrative Regenerate uses acceptRegen, which bypasses this guard)
      const isEmpty =
        currentFormValue === undefined ||
        currentFormValue === null ||
        currentFormValue === "" ||
        (Array.isArray(currentFormValue) && currentFormValue.length === 0);

      if (!isEmpty) return;

      // RT-INV-10: write to form state only — no DB write
      setFieldValue(field, value);

      // Remove from suggestion list
      setSuggestions((prev) => prev.filter((s) => s.field !== field));
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Skip (§6.4)
  // ---------------------------------------------------------------------------

  const skip = useCallback((field: string) => {
    setSkippedFields((prev) => new Set([...prev, field]));
    setSuggestions((prev) => prev.filter((s) => s.field !== field));
  }, []);

  // ---------------------------------------------------------------------------
  // Add to retry queue (§9.1)
  // ---------------------------------------------------------------------------

  const addToRetryQueue = useCallback(
    (field: string, previousSuggestion: string, feedback: string | null) => {
      // Remove from current suggestions panel
      setSuggestions((prev) => prev.filter((s) => s.field !== field));

      setRetryQueue((prev) => {
        // Replace any existing entry for this field
        const without = prev.filter((e) => e.field !== field);
        return [...without, { field, previousSuggestion, feedback }];
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Batch retry (RT-INV-11 — single HTTP call)
  // ---------------------------------------------------------------------------

  const batchRetry = useCallback(
    async (scopeFieldValue: string) => {
      if (retryQueue.length === 0) return;

      setIsRetrying(true);

      try {
        const res = await fetch("/api/admin/ai/suggest/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            entityType,
            scopeField: scopeFieldValue,
            retryFields: retryQueue.map((e) => ({
              field: e.field,
              previousSuggestion: e.previousSuggestion,
              feedback: e.feedback,
            })),
          }),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          const message =
            errBody.error?.message ?? `重试请求失败 (HTTP ${res.status})`;
          console.error("[copilot] retry failed", res.status, message);
          setSuggestErrors([
            { field: "_session", code: "RETRY_FAILED", message },
          ]);
          return;
        }

        const body = (await res.json()) as {
          suggestions: SuggestionItem[];
          errors?: SuggestFieldError[];
        };
        const fieldErrors = body.errors ?? [];
        if (fieldErrors.length > 0) {
          console.warn("[copilot] partial retry failure — some fields skipped", fieldErrors);
        }
        setSuggestErrors(fieldErrors);

        const newSuggestions = body.suggestions ?? [];
        const succeededFields = new Set(newSuggestions.map((s) => s.field));

        // Merge new suggestions with existing ones, replacing same-field entries
        setSuggestions((prev) => {
          const kept = prev.filter((s) => !succeededFields.has(s.field));
          return [...kept, ...newSuggestions];
        });

        // Remove only successfully retried fields from queue; keep failed ones
        setRetryQueue((prev) => prev.filter((e) => !succeededFields.has(e.field)));
      } catch (e) {
        console.error("[copilot] retry network error", e);
      } finally {
        setIsRetrying(false);
      }
    },
    [retryQueue, workId, entityType]
  );

  // ---------------------------------------------------------------------------
  // Accept All (RT-INV-12, §6.3, AC-11)
  // ---------------------------------------------------------------------------

  const acceptAll = useCallback(
    (
      setFieldValue: (field: string, value: string) => void,
      getFieldValue: (field: string) => unknown
    ) => {
      // Accept all currently visible suggestions that are not scope or asset
      // (scope/asset fields are never in suggestions per AC-15/AC-29, but guard anyway)
      suggestions.forEach((s) => {
        const classification = getClassification(entityType, s.field);
        // Only non-scope, non-asset (RT-INV-12, §6.3)
        if (classification === "scope" || classification === "asset") return;

        const currentValue = getFieldValue(s.field);
        const isEmpty =
          currentValue === undefined ||
          currentValue === null ||
          currentValue === "" ||
          (Array.isArray(currentValue) && (currentValue as unknown[]).length === 0);

        if (!isEmpty) return; // RT-INV-09: do not overwrite filled fields

        setFieldValue(s.field, s.value);
      });

      // Clear all accepted suggestions from the panel
      setSuggestions([]);
    },
    [suggestions, entityType]
  );

  // ---------------------------------------------------------------------------
  // Panel control
  // ---------------------------------------------------------------------------

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Narrative Regenerate (§9.5, Phase 2)
  // ---------------------------------------------------------------------------

  const narrativeRegen = useCallback(
    async (
      field: string,
      currentValue: string,
      scopeFieldValue: string,
      feedback?: string | null
    ) => {
      try {
        const res = await fetch("/api/admin/ai/suggest/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            entityType,
            scopeField: scopeFieldValue,
            retryFields: [
              {
                field,
                previousSuggestion: currentValue,
                feedback: feedback ?? null,
              },
            ],
          }),
        });

        if (!res.ok) {
          console.error("[copilot] regen failed", res.status);
          return;
        }

        const body = (await res.json()) as { suggestions: SuggestionItem[] };
        const item = body.suggestions?.[0];
        if (!item) return;

        setPendingRegen((prev) => ({ ...prev, [field]: item }));
      } catch (e) {
        console.error("[copilot] regen network error", e);
      }
    },
    [workId, entityType]
  );

  const acceptRegen = useCallback(
    (
      field: string,
      setFieldValue: (field: string, value: string) => void
    ) => {
      const item = pendingRegen[field];
      if (!item) return;

      // §9.5 exception: Accept overwrites existing form value (form state only)
      setFieldValue(field, item.value);
      setPendingRegen((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [pendingRegen]
  );

  const dismissRegen = useCallback((field: string) => {
    setPendingRegen((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    iconState,
    dupConflict,
    panelOpen,
    suggestions,
    skippedFields,
    retryQueue,
    isRetrying,
    isSuggesting,
    pendingRegen,
    suggestErrors,
    onScopeFieldChange,
    triggerSuggest,
    accept,
    skip,
    addToRetryQueue,
    batchRetry,
    acceptAll,
    closePanel,
    teardown,
    narrativeRegen,
    acceptRegen,
    dismissRegen,
  };
}
