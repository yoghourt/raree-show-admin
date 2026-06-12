/**
 * SPEC-D2-002 + SPEC-D2-003 — Enrichment Copilot Suggest Service
 *
 * Fact-route: Connector First (Option B) → EvidenceBundle → normalize → SuggestionItem
 * SC-03 when no source profile or no evidence.
 */

import type {
  SuggestRequest,
  SuggestionItem,
  RetryFieldRequest,
  FieldRequest,
  EntityType,
} from "@/lib/ai/copilot-types";
import type { WorkSourceContext } from "@/lib/ai/evidence-types";
import { queryEvidenceBundle } from "@/lib/ai/connector-orchestrator";
import { callCopilotTextLlm } from "@/lib/ai/copilot-text-llm";
import {
  parseBatchCopilotValues,
  parseCopilotFieldValue,
} from "@/lib/ai/parse-copilot-value";
import {
  bundleToConfidence,
  normalizeEvidence,
} from "@/lib/ai/normalize-evidence";
import { getFieldMetadata, getFieldLabel } from "@/lib/ai/field-registry";

const LLM_CALL_GAP_MS = Number(
  process.env.COPILOT_LLM_CALL_GAP_MS ?? process.env.GEMINI_CALL_GAP_MS ?? 400
);

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
    confidence: "yellow",
    classification: "narrative",
    sources: [],
  };
}

async function processFact(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  workId: string;
  workTitle?: string | null;
  sourceContext: WorkSourceContext | null | undefined;
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
    sourceContext,
    acceptedFacts,
    previousSuggestion,
    feedback,
  } = params;

  if (!sourceContext) {
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

  const bundle = await queryEvidenceBundle({
    workId,
    entityType,
    scopeFieldValue,
    field,
    sourceContext,
  });

  if (process.env.SOURCE_CONNECTOR_DEBUG === "1" && bundle.diagnostics.length > 0) {
    console.info("[suggest-service] connector diagnostics", {
      field,
      scopeFieldValue,
      tier: bundle.tier,
      matched: bundle.matched,
      diagnostics: bundle.diagnostics,
      connectors: bundle.evidenceItems.map((i) => i.connectorId),
    });
  }

  if (!bundle.matched || bundle.evidenceItems.length === 0) {
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

  const { value, sources } = await normalizeEvidence(bundle, entityType, field);
  if (!value.trim()) {
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

  return {
    field,
    value,
    confidence: bundleToConfidence(bundle),
    classification: "fact",
    sources,
  };
}

async function generateOptionBSuggestions(
  req: SuggestRequest
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  const started = Date.now();
  const factFields = req.emptyFields.filter((f) => f.copilot_route === "fact");
  const narrativeFields = req.emptyFields.filter(
    (f) => f.copilot_route === "narrative"
  );

  const items: SuggestionItem[] = [];
  const errors: Array<{ field: string; code: string; message: string }> = [];
  const acceptedFacts: Record<string, string> = {};

  for (let i = 0; i < factFields.length; i++) {
    const fr = factFields[i];
    if (i > 0 && LLM_CALL_GAP_MS > 0) await sleep(LLM_CALL_GAP_MS);

    try {
      const item = await processFact({
        entityType: req.entityType,
        scopeFieldValue: req.scopeField,
        field: fr.field,
        workId: req.workId,
        workTitle: req.workTitle,
        sourceContext: req.sourceContext,
        acceptedFacts,
      });
      if (!item.value.trim()) continue;
      items.push(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ field: fr.field, code: "PROVIDER_ERROR", message: msg });
    }
  }

  if (narrativeFields.length > 0) {
    if (LLM_CALL_GAP_MS > 0) await sleep(LLM_CALL_GAP_MS);

    try {
      const prompt = buildBatchFieldPrompt({
        entityType: req.entityType,
        scopeFieldValue: req.scopeField,
        workTitle: req.workTitle,
        fields: narrativeFields,
      });
      const raw = await callCopilotTextLlm(prompt);
      const values = parseBatchCopilotValues(
        raw,
        narrativeFields.map((f) => f.field)
      );

      for (const fr of narrativeFields) {
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

      errors.push(
        ...collectEmptyFieldErrors(
          narrativeFields.map((f) => f.field),
          values,
          false
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      for (const fr of narrativeFields) {
        errors.push({ field: fr.field, code: "PROVIDER_ERROR", message: msg });
      }
    }
  }

  console.info("[suggest-service] option B batch done", {
    entityType: req.entityType,
    factCount: factFields.length,
    narrativeCount: narrativeFields.length,
    itemCount: items.length,
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
    if (i > 0 && LLM_CALL_GAP_MS > 0) await sleep(LLM_CALL_GAP_MS);

    try {
      const item =
        fr.copilot_route === "fact"
          ? await processFact({
              entityType: req.entityType,
              scopeFieldValue: req.scopeField,
              field: fr.field,
              workId: req.workId,
              workTitle: req.workTitle,
              sourceContext: req.sourceContext,
              acceptedFacts,
            })
          : await processNarrative({
              entityType: req.entityType,
              scopeFieldValue: req.scopeField,
              field: fr.field,
              workTitle: req.workTitle,
              acceptedFacts,
            });

      if (!item.value.trim()) continue;
      items.push(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ field: fr.field, code: "PROVIDER_ERROR", message: msg });
    }
  }

  console.info("[suggest-service] sequential suggest done", {
    entityType: req.entityType,
    fieldCount: req.emptyFields.length,
    itemCount: items.length,
    durationMs: Date.now() - started,
  });

  return { items, errors };
}

async function generateOptionBRetry(
  retryFields: RetryFieldRequest[],
  context: {
    entityType: EntityType;
    scopeFieldValue: string;
    workId: string;
    workTitle?: string | null;
    sourceContext?: WorkSourceContext | null;
  }
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  const items: SuggestionItem[] = [];
  const errors: Array<{ field: string; code: string; message: string }> = [];
  const acceptedFacts: Record<string, string> = {};

  const factRetries: RetryFieldRequest[] = [];
  const narrativeRetries: RetryFieldRequest[] = [];

  for (const rfr of retryFields) {
    const route = getFieldMetadata(context.entityType, rfr.field)?.copilot_route;
    if (route === "fact") factRetries.push(rfr);
    else narrativeRetries.push(rfr);
  }

  for (let i = 0; i < factRetries.length; i++) {
    const rfr = factRetries[i];
    if (i > 0 && LLM_CALL_GAP_MS > 0) await sleep(LLM_CALL_GAP_MS);

    try {
      const item = await processFact({
        entityType: context.entityType,
        scopeFieldValue: context.scopeFieldValue,
        field: rfr.field,
        workId: context.workId,
        workTitle: context.workTitle,
        sourceContext: context.sourceContext,
        acceptedFacts,
        previousSuggestion: rfr.previousSuggestion,
        feedback: rfr.feedback,
      });

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
      errors.push({ field: rfr.field, code: "PROVIDER_ERROR", message: msg });
    }
  }

  if (narrativeRetries.length > 0) {
    try {
      const prompt = buildBatchRetryPrompt({
        entityType: context.entityType,
        scopeFieldValue: context.scopeFieldValue,
        workTitle: context.workTitle,
        retryFields: narrativeRetries,
      });
      const raw = await callCopilotTextLlm(prompt);
      const values = parseBatchCopilotValues(
        raw,
        narrativeRetries.map((r) => r.field)
      );

      for (const rfr of narrativeRetries) {
        const value = (values[rfr.field] ?? "").trim();
        if (!value) {
          errors.push({
            field: rfr.field,
            code: "EMPTY_RESULT",
            message: "模型未返回有效建议，请补充反馈后重试",
          });
          continue;
        }
        items.push({
          field: rfr.field,
          value,
          confidence: "yellow",
          classification: "narrative",
          sources: [],
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      for (const rfr of narrativeRetries) {
        errors.push({ field: rfr.field, code: "PROVIDER_ERROR", message: msg });
      }
    }
  }

  return { items, errors };
}

export async function generateSuggestions(
  req: SuggestRequest
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  if (req.emptyFields.length === 0) {
    return { items: [], errors: [] };
  }

  const hasFact = req.emptyFields.some((f) => f.copilot_route === "fact");

  if (req.emptyFields.length >= 2 || hasFact) {
    return generateOptionBSuggestions(req);
  }

  return generateSequentialSuggestions(req);
}

export async function generateRetrySuggestions(
  retryFields: RetryFieldRequest[],
  context: {
    entityType: EntityType;
    scopeFieldValue: string;
    workId: string;
    workTitle?: string | null;
    sourceContext?: WorkSourceContext | null;
  }
): Promise<{ items: SuggestionItem[]; errors: Array<{ field: string; code: string; message: string }> }> {
  if (retryFields.length === 0) {
    return { items: [], errors: [] };
  }

  return generateOptionBRetry(retryFields, context);
}
