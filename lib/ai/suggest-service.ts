/**
 * SPEC-D2-002 — Enrichment Copilot Suggest Service
 *
 * Implements the Fact (SC-01) and Narrative (SC-02) suggestion pipelines.
 *
 * Source Connector v1 is a stub (§4.4 Architect Decision 2026-06-11).
 * All `fact`-routed fields fall through SC-03 Original Work fallback and
 * are returned as classification: "narrative", confidence: "yellow".
 *
 * AC-16 / SD-02: Generation prompts MUST NOT contain any instruction to
 * produce or infer the Scope Field value.
 *
 * AC-12: classification: "fact" with sources: [] is NEVER returned.
 * AC-20: SC-03 fallback NEVER produces confidence: "green".
 */

import type {
  SuggestRequest,
  SuggestionItem,
  RetryFieldRequest,
  FieldRequest,
  EntityType,
} from "@/lib/ai/copilot-types";
import { callCopilotTextLlm } from "@/lib/ai/copilot-text-llm";
import {
  parseBatchCopilotValues,
  parseCopilotFieldValue,
} from "@/lib/ai/parse-copilot-value";
import { querySourceConnector } from "@/lib/ai/source-connector-stub";
import { getFieldMetadata, getFieldLabel } from "@/lib/ai/field-registry";

/** Gap between sequential fallback calls only (batch mode uses a single call). */
const LLM_CALL_GAP_MS = Number(process.env.COPILOT_LLM_CALL_GAP_MS ?? process.env.GEMINI_CALL_GAP_MS ?? 400);

function entityTypeLabel(entityType: EntityType): string {
  return entityType === "character"
    ? "角色"
    : entityType === "location"
      ? "地点"
      : "场景";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Internal — single field generation via configured text LLM
// ---------------------------------------------------------------------------

/**
 * Builds the generation prompt for a field suggestion.
 *
 * AC-16 compliance: the prompt deliberately does NOT instruct the model to
 * produce the entity's canonical scope field value.
 */
function buildFieldPrompt(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  workTitle?: string | null;
  acceptedFacts: Record<string, string>;
  previousSuggestion?: string;
  feedback?: string | null;
}): string {
  const {
    entityType,
    scopeFieldValue,
    field,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
  } = params;

  const entityLabel = entityTypeLabel(entityType);
  const fieldLabel = getFieldLabel(entityType, field);
  const workContext = workTitle?.trim()
    ? `作品名称：${workTitle.trim()}`
    : "作品名称：（未提供）";

  const acceptedContext =
    Object.entries(acceptedFacts).length > 0
      ? `已确认的信息：\n${Object.entries(acceptedFacts)
          .map(([k, v]) => `  - ${getFieldLabel(entityType, k)}: ${v}`)
          .join("\n")}`
      : "";

  const retryContext = previousSuggestion
    ? `上一次建议值为：${previousSuggestion}${
        feedback ? `\n运营者反馈：${feedback}` : "\n请提供一个不同的建议。"
      }`
    : "";

  return `你是一个辅助内容管理系统的助手，正在为文学作品的元数据字段提供建议值。

${workContext}
实体类型：${entityLabel}
实体名称：${scopeFieldValue}
待填写字段：${fieldLabel}

${acceptedContext}
${retryContext}

要求：
- 仅输出该字段的建议内容，格式为 JSON 对象：{"value": "..."}
- 建议必须严格符合「${workTitle?.trim() || "该作品"}」的世界观与设定，禁止套用其他作品设定（例如《三体》中不得出现 Stark、Lannister 等《冰与火之歌》家族名）
- 若该字段对此作品不适用（例如作品没有「家族」划分时填写家族字段），请输出 {"value": ""}，不要强行编造
- 不要生成或推测实体名称本身
- 不要捏造任何外部引用或来源
- 不要包含其他键或解释文字

仅输出 JSON，不要有其他内容。`;
}

/**
 * Batch prompt — one LLM call for all empty fields (faster, avoids 3rd-call drops).
 */
function buildBatchFieldPrompt(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  workTitle?: string | null;
  fields: FieldRequest[];
}): string {
  const { entityType, scopeFieldValue, workTitle, fields } = params;
  const entityLabel = entityTypeLabel(entityType);
  const workContext = workTitle?.trim()
    ? `作品名称：${workTitle.trim()}`
    : "作品名称：（未提供）";

  const fieldLines = fields
    .map((f) => `  - "${f.field}"（${getFieldLabel(entityType, f.field)}）`)
    .join("\n");

  const keysList = fields.map((f) => `"${f.field}"`).join(", ");

  return `你是一个辅助内容管理系统的助手，正在为文学作品的元数据字段提供建议值。

${workContext}
实体类型：${entityLabel}
实体名称：${scopeFieldValue}

待填写字段（共 ${fields.length} 个）：
${fieldLines}

要求：
- 输出一个 JSON 对象，必须包含以上每个 key，值均为字符串
- key 列表：${keysList}
- 建议必须严格符合「${workTitle?.trim() || "该作品"}」的世界观与设定，禁止套用其他作品的设定（例如《三体》中不得出现 Stark、Lannister 等《冰与火之歌》家族名）
- 若某字段对此作品不适用（例如科幻作品无「家族」划分），该 key 的值设为空字符串 ""
- 不要生成或推测实体名称本身
- 不要捏造任何外部引用或来源
- 不要包含上述列表以外的 key
- 不要包含解释文字或 markdown

仅输出 JSON 对象，不要有其他内容。`;
}

function fieldValuesToItems(
  fields: FieldRequest[],
  values: Record<string, string>
): SuggestionItem[] {
  const items: SuggestionItem[] = [];
  for (const fr of fields) {
    const value = (values[fr.field] ?? "").trim();
    if (!value) continue;
    items.push({
      field: fr.field,
      value,
      confidence: "yellow",
      classification: "narrative",
      sources: [],
    });
  }
  return items;
}

async function generateBatchSuggestions(
  req: SuggestRequest
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  const started = Date.now();
  const fields = req.emptyFields;

  // SC-01 stub: fact fields have no connector match in v1 — batch uses narrative generation
  for (const fr of fields) {
    if (fr.copilot_route === "fact") {
      querySourceConnector({
        entityType: req.entityType,
        scopeFieldValue: req.scopeField,
        field: fr.field,
        workId: req.workId,
      });
    }
  }

  const prompt = buildBatchFieldPrompt({
    entityType: req.entityType,
    scopeFieldValue: req.scopeField,
    workTitle: req.workTitle,
    fields,
  });

  const raw = await callCopilotTextLlm(prompt);
  const values = parseBatchCopilotValues(
    raw,
    fields.map((f) => f.field)
  );
  const items = fieldValuesToItems(fields, values);

  console.info("[suggest-service] batch suggest done", {
    entityType: req.entityType,
    fieldCount: fields.length,
    itemCount: items.length,
    durationMs: Date.now() - started,
  });

  const errors = collectEmptyFieldErrors(
    fields.map((f) => f.field),
    values,
    false
  );

  return { items, errors };
}

function buildBatchRetryPrompt(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  workTitle?: string | null;
  retryFields: RetryFieldRequest[];
}): string {
  const { entityType, scopeFieldValue, workTitle, retryFields } = params;
  const entityLabel = entityTypeLabel(entityType);
  const workContext = workTitle?.trim()
    ? `作品名称：${workTitle.trim()}`
    : "作品名称：（未提供）";

  const fieldBlocks = retryFields
    .map((r) => {
      const label = getFieldLabel(entityType, r.field);
      const feedbackLine = r.feedback?.trim()
        ? `  运营者反馈：${r.feedback.trim()}`
        : "  请提供一个与上次不同的建议。";
      return `  - "${r.field}"（${label}）\n  上一次建议：${r.previousSuggestion}${feedbackLine}`;
    })
    .join("\n");

  const keysList = retryFields.map((r) => `"${r.field}"`).join(", ");

  return `你是一个辅助内容管理系统的助手，正在为文学作品的元数据字段重新生成建议值。

${workContext}
实体类型：${entityLabel}
实体名称：${scopeFieldValue}

待重试字段（共 ${retryFields.length} 个）：
${fieldBlocks}

要求：
- 输出一个 JSON 对象，必须包含以上每个 key，值均为字符串
- key 列表：${keysList}
- 新建议必须不同于「上一次建议」，并采纳运营者反馈
- 建议必须严格符合「${workTitle?.trim() || "该作品"}」的世界观，禁止套用其他作品设定
- 每个 key 都必须有非空字符串值；若确实无法建议，输出你认为最合理的替代内容，不要输出空字符串
- 不要生成或推测实体名称本身
- 不要捏造任何外部引用或来源
- 不要包含上述列表以外的 key
- 不要包含解释文字或 markdown

仅输出 JSON 对象，不要有其他内容。`;
}

function collectEmptyFieldErrors(
  fieldKeys: string[],
  values: Record<string, string>,
  treatEmptyAsError: boolean
): Array<{ field: string; code: string; message: string }> {
  if (!treatEmptyAsError) return [];

  const errors: Array<{ field: string; code: string; message: string }> = [];
  for (const field of fieldKeys) {
    if (!(values[field] ?? "").trim()) {
      errors.push({
        field,
        code: "EMPTY_RESULT",
        message: "模型未返回有效建议，请补充反馈后重试",
      });
    }
  }
  return errors;
}

async function generateBatchRetrySuggestions(
  retryFields: RetryFieldRequest[],
  context: {
    entityType: EntityType;
    scopeFieldValue: string;
    workId: string;
    workTitle?: string | null;
  }
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  const started = Date.now();
  const { entityType, scopeFieldValue, workId, workTitle } = context;

  for (const rfr of retryFields) {
    querySourceConnector({
      entityType,
      scopeFieldValue,
      field: rfr.field,
      workId,
    });
  }

  const prompt = buildBatchRetryPrompt({
    entityType,
    scopeFieldValue,
    workTitle,
    retryFields,
  });

  const raw = await callCopilotTextLlm(prompt);
  const fieldKeys = retryFields.map((r) => r.field);
  const values = parseBatchCopilotValues(raw, fieldKeys);

  const pseudoFields: FieldRequest[] = retryFields.map((r) => ({
    field: r.field,
    copilot_route: "narrative",
  }));
  const items = fieldValuesToItems(pseudoFields, values);
  const errors = collectEmptyFieldErrors(fieldKeys, values, true);

  console.info("[suggest-service] batch retry done", {
    entityType,
    fieldCount: retryFields.length,
    itemCount: items.length,
    errorCount: errors.length,
    durationMs: Date.now() - started,
  });

  return { items, errors };
}

async function generateSequentialSuggestions(
  req: SuggestRequest
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  const started = Date.now();
  const acceptedFacts: Record<string, string> = {};
  const items: SuggestionItem[] = [];
  const errors: Array<{ field: string; code: string; message: string }> = [];

  for (let i = 0; i < req.emptyFields.length; i++) {
    const fr = req.emptyFields[i];
    if (i > 0 && LLM_CALL_GAP_MS > 0) {
      await sleep(LLM_CALL_GAP_MS);
    }

    try {
      let item: SuggestionItem;
      if (fr.copilot_route === "fact") {
        item = await processFact({
          entityType: req.entityType,
          scopeFieldValue: req.scopeField,
          field: fr.field,
          workId: req.workId,
          workTitle: req.workTitle,
          acceptedFacts,
        });
      } else {
        item = await processNarrative({
          entityType: req.entityType,
          scopeFieldValue: req.scopeField,
          field: fr.field,
          workTitle: req.workTitle,
          acceptedFacts,
        });
      }

      if (!item.value.trim()) continue;
      items.push(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[suggest-service] field suggestion failed", { field: fr.field, error: msg });
      errors.push({ field: fr.field, code: "PROVIDER_ERROR", message: msg });
    }
  }

  console.info("[suggest-service] sequential suggest done", {
    entityType: req.entityType,
    fieldCount: req.emptyFields.length,
    itemCount: items.length,
    errorCount: errors.length,
    durationMs: Date.now() - started,
  });

  return { items, errors };
}

// ---------------------------------------------------------------------------
// SC-01 Fact pipeline with SC-03 fallback
// ---------------------------------------------------------------------------

async function processFact(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  workId: string;
  workTitle?: string | null;
  acceptedFacts: Record<string, string>;
  previousSuggestion?: string;
  feedback?: string | null;
}): Promise<SuggestionItem> {
  const {
    entityType,
    scopeFieldValue,
    field,
    workId,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
  } = params;

  // SC-01: Query Source Connector first (SC-04 Source First Principle)
  const connectorResult = querySourceConnector({
    entityType,
    scopeFieldValue,
    field,
    workId,
  });

  if (connectorResult.matched && connectorResult.tier === 1) {
    // Tier-1: green confidence (§8.3) — not reachable with stub, included for future connector
    throw new Error("Tier-1 source path not reachable in v1 stub");
  }

  if (connectorResult.matched && connectorResult.tier === 2) {
    // Tier-2: yellow confidence — not reachable with stub, included for future connector
    throw new Error("Tier-2 source path not reachable in v1 stub");
  }

  // SC-03 Original Work fallback: matched=false → demote to narrative/yellow (§4.4 step 4, AC-12, AC-20)
  // Returning classification: "fact" with sources: [] is forbidden here.
  return processNarrative({
    entityType,
    scopeFieldValue,
    field,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
  });
}

// ---------------------------------------------------------------------------
// SC-02 Narrative pipeline
// ---------------------------------------------------------------------------

async function processNarrative(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  workTitle?: string | null;
  acceptedFacts: Record<string, string>;
  previousSuggestion?: string;
  feedback?: string | null;
}): Promise<SuggestionItem> {
  const {
    entityType,
    scopeFieldValue,
    field,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
  } = params;

  const prompt = buildFieldPrompt({
    entityType,
    scopeFieldValue,
    field,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
  });

  const raw = await callCopilotTextLlm(prompt);
  const value = parseCopilotFieldValue(raw);

  return {
    field,
    value,
    confidence: "yellow",          // AC-20: SC-03 / narrative always yellow
    classification: "narrative",   // AC-12: no "fact" without SourceRef
    sources: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates suggestions for all requested fields.
 *
 * Routing is derived exclusively from the FieldRequest.copilot_route
 * pre-resolved by the client from Appendix A metadata (MD-01, AC-26).
 *
 * Returns individual results including errors for partial failures (§13.2).
 */
export async function generateSuggestions(
  req: SuggestRequest
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  if (req.emptyFields.length === 0) {
    return { items: [], errors: [] };
  }

  // Batch: 1 LLM call for all fields (~3× faster than sequential per-field calls).
  if (req.emptyFields.length >= 2) {
    try {
      return await generateBatchSuggestions(req);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[suggest-service] batch suggest failed, sequential fallback", msg);
    }
  }

  return generateSequentialSuggestions(req);
}

/**
 * Generates retry suggestions for all queued fields in a single batch call.
 *
 * RT-INV-11: This function processes ALL retryFields in one invocation — one
 * HTTP request at the endpoint level. It MUST NOT be called per-field.
 *
 * Server incorporates previousSuggestion and feedback per field (§7.4).
 */
async function generateSequentialRetrySuggestions(
  retryFields: RetryFieldRequest[],
  context: {
    entityType: EntityType;
    scopeFieldValue: string;
    workId: string;
    workTitle?: string | null;
  }
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  const started = Date.now();
  const acceptedFacts: Record<string, string> = {};
  const { entityType, scopeFieldValue, workId, workTitle } = context;

  const items: SuggestionItem[] = [];
  const errors: Array<{ field: string; code: string; message: string }> = [];

  for (let i = 0; i < retryFields.length; i++) {
    const rfr = retryFields[i];
    if (i > 0 && LLM_CALL_GAP_MS > 0) {
      await sleep(LLM_CALL_GAP_MS);
    }

    const meta = getFieldMetadata(entityType, rfr.field);
    const route = meta?.copilot_route ?? "narrative";

    try {
      let item: SuggestionItem;
      if (route === "fact") {
        item = await processFact({
          entityType,
          scopeFieldValue,
          field: rfr.field,
          workId,
          workTitle,
          acceptedFacts,
          previousSuggestion: rfr.previousSuggestion,
          feedback: rfr.feedback,
        });
      } else {
        item = await processNarrative({
          entityType,
          scopeFieldValue,
          field: rfr.field,
          workTitle,
          acceptedFacts,
          previousSuggestion: rfr.previousSuggestion,
          feedback: rfr.feedback,
        });
      }

      if (!item.value.trim()) {
        errors.push({
          field: rfr.field,
          code: "EMPTY_RESULT",
          message: "模型未返回有效建议，请补充反馈后重试",
        });
        continue;
      }

      items.push(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[suggest-service] retry field failed", { field: rfr.field, error: msg });
      errors.push({ field: rfr.field, code: "PROVIDER_ERROR", message: msg });
    }
  }

  console.info("[suggest-service] sequential retry done", {
    entityType,
    fieldCount: retryFields.length,
    itemCount: items.length,
    errorCount: errors.length,
    durationMs: Date.now() - started,
  });

  return { items, errors };
}

export async function generateRetrySuggestions(
  retryFields: RetryFieldRequest[],
  context: {
    entityType: EntityType;
    scopeFieldValue: string;
    workId: string;
    workTitle?: string | null;
  }
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  if (retryFields.length === 0) {
    return { items: [], errors: [] };
  }

  try {
    return await generateBatchRetrySuggestions(retryFields, context);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[suggest-service] batch retry failed, sequential fallback", msg);
  }

  return generateSequentialRetrySuggestions(retryFields, context);
}
