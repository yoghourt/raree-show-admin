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
  SourceRef,
} from "@/lib/ai/copilot-types";
import type {
  EvidenceBundle,
  WorkSourceContext,
} from "@/lib/ai/evidence-types";
import {
  queryEvidenceBundle,
  queryNarrativeContextBundle,
} from "@/lib/ai/connector-orchestrator";
import { callCopilotTextLlm } from "@/lib/ai/copilot-text-llm";
import {
  parseBatchCopilotValues,
  parseCopilotFieldValue,
} from "@/lib/ai/parse-copilot-value";
import {
  bundleToConfidence,
  normalizeEvidence,
} from "@/lib/ai/normalize-evidence";
import { messages } from "@/lib/locale";
import { getFieldMetadata, getFieldLabel } from "@/lib/ai/field-registry";
import { ensureUndiciProxyDispatcherForGemini } from "@/lib/ai/undici-proxy-bootstrap";

const LLM_CALL_GAP_MS = Number(
  process.env.COPILOT_LLM_CALL_GAP_MS ?? process.env.GEMINI_CALL_GAP_MS ?? 400
);

const NARRATIVE_EVIDENCE_CHAR_BUDGET = 5500;

class NarrativeGroundingError extends Error {
  readonly code = "SOURCE_UNAVAILABLE" as const;
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "NarrativeGroundingError";
    this.field = field;
  }
}

function toSuggestFieldError(
  field: string,
  e: unknown
): { field: string; code: string; message: string } {
  if (e instanceof NarrativeGroundingError) {
    return { field: e.field || field, code: e.code, message: e.message };
  }
  const msg = e instanceof Error ? e.message : String(e);
  return { field, code: "PROVIDER_ERROR", message: msg };
}

function entityTypeLabel(entityType: EntityType): string {
  return entityType === "character"
    ? "角色"
    : entityType === "location"
      ? "地点"
      : messages.copilot.readingRouteEntity;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatEvidenceBlock(bundle: EvidenceBundle | null): string {
  if (!bundle?.matched || bundle.evidenceItems.length === 0) {
    return "";
  }

  const parts: string[] = [];
  let used = 0;
  for (const item of bundle.evidenceItems) {
    const header = `[${item.sourceRef.label}]${item.sourceRef.url ? ` ${item.sourceRef.url}` : ""}`;
    const body = item.excerpt.trim();
    if (!body) continue;
    const chunk = `${header}\n${body}`;
    if (used + chunk.length > NARRATIVE_EVIDENCE_CHAR_BUDGET && parts.length > 0) {
      break;
    }
    parts.push(chunk);
    used += chunk.length;
  }

  if (parts.length === 0) return "";

  return `已检索到的资料摘录（权威来源；叙事草稿必须基于此）：
${parts.join("\n\n---\n\n")}`;
}

function narrativeGroundingRules(hasEvidence: boolean): string {
  if (hasEvidence) {
    return `- 你必须仅依据上方「已检索到的资料摘录」与已确认信息撰写；资料未写明的情节、官职、阵营、战役、死因一律不得编造
- 可用资料中的措辞做通顺改写与压缩，但不得添加资料以外的“听起来合理”的设定
- 若资料不足以写该字段，输出空字符串，不要用模型常识补全`;
  }
  return `- 当前没有可引用的外部资料摘录（SC-03）。可基于作品名与实体名起草，但必须标为不确定草稿心态：禁止捏造具体战役、军职履历、精确死因等未经证实细节；不确定则输出空字符串或极短谨慎表述
- 建议必须严格符合「该作品」世界观，禁止套用其他作品设定`;
}

/**
 * Public-franchise / encyclopedia works must not free-hallucinate biographies when
 * connectors fail (local AWOIAF 403 etc.). Original works keep SC-03 drafting.
 */
function mustRefuseUngroundedNarrative(
  sourceContext: WorkSourceContext | null | undefined,
  bundle: EvidenceBundle | null
): boolean {
  if (!sourceContext) return false;
  if (bundle?.matched && bundle.evidenceItems.length > 0) return false;
  const kind = sourceContext.profile.kind;
  return kind === "public_franchise" || kind === "encyclopedia";
}

function sourceUnavailableMessage(bundle: EvidenceBundle | null): string {
  const detail =
    bundle?.diagnostics
      .map((d) => d.message)
      .filter(Boolean)
      .slice(0, 2)
      .join("；") || "未匹配到 Tier-1/2 资料";
  return `外部资料暂不可用，已拒绝无依据编造。${detail}。请稍后重试或手动填写。`;
}

function sourcesFromBundle(bundle: EvidenceBundle | null): SourceRef[] {
  if (!bundle?.matched) return [];
  return bundle.evidenceItems.map((item) => item.sourceRef);
}

async function loadNarrativeContext(params: {
  workId: string;
  entityType: EntityType;
  scopeFieldValue: string;
  sourceContext: WorkSourceContext | null | undefined;
}): Promise<EvidenceBundle | null> {
  if (!params.sourceContext) return null;

  ensureUndiciProxyDispatcherForGemini();

  const bundle = await queryNarrativeContextBundle({
    workId: params.workId,
    entityType: params.entityType,
    scopeFieldValue: params.scopeFieldValue,
    sourceContext: params.sourceContext,
  });

  if (process.env.SOURCE_CONNECTOR_DEBUG === "1") {
    console.info("[suggest-service] narrative context diagnostics", {
      scopeFieldValue: params.scopeFieldValue,
      matched: bundle.matched,
      tier: bundle.tier,
      itemCount: bundle.evidenceItems.length,
      diagnostics: bundle.diagnostics,
    });
  }

  return bundle;
}

function buildFieldPrompt(params: {
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  workTitle?: string | null;
  acceptedFacts: Record<string, string>;
  previousSuggestion?: string;
  feedback?: string | null;
  evidenceBlock?: string;
}): string {
  const {
    entityType,
    scopeFieldValue,
    field,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
    evidenceBlock = "",
  } = params;

  const entityLabel = entityTypeLabel(entityType);
  const fieldLabel = getFieldLabel(entityType, field);
  const workContext = workTitle?.trim()
    ? `作品名称：${workTitle.trim()}`
    : "作品名称：（未提供）";
  const hasEvidence = Boolean(evidenceBlock.trim());

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
${evidenceBlock}
${retryContext}

要求：
- 仅输出该字段的建议内容，格式为 JSON 对象：{"value": "..."}
- 建议必须严格符合「${workTitle?.trim() || "该作品"}」的世界观与设定，禁止套用其他作品设定（例如《三体》中不得出现 Stark、Lannister 等《冰与火之歌》家族名）
${narrativeGroundingRules(hasEvidence)}
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
  acceptedFacts?: Record<string, string>;
  evidenceBlock?: string;
}): string {
  const {
    entityType,
    scopeFieldValue,
    workTitle,
    fields,
    acceptedFacts = {},
    evidenceBlock = "",
  } = params;
  const entityLabel = entityTypeLabel(entityType);
  const workContext = workTitle?.trim()
    ? `作品名称：${workTitle.trim()}`
    : "作品名称：（未提供）";
  const hasEvidence = Boolean(evidenceBlock.trim());

  const fieldLines = fields
    .map((f) => `  - "${f.field}"（${getFieldLabel(entityType, f.field)}）`)
    .join("\n");

  const keysList = fields.map((f) => `"${f.field}"`).join(", ");

  const acceptedContext =
    Object.entries(acceptedFacts).length > 0
      ? `已确认的信息：\n${Object.entries(acceptedFacts)
          .map(([k, v]) => `  - ${getFieldLabel(entityType, k)}: ${v}`)
          .join("\n")}`
      : "";

  return `你是一个辅助内容管理系统的助手，正在为文学作品的元数据字段提供建议值。

${workContext}
实体类型：${entityLabel}
实体名称：${scopeFieldValue}

${acceptedContext}
${evidenceBlock}

待填写字段（共 ${fields.length} 个）：
${fieldLines}

要求：
- 输出一个 JSON 对象，必须包含以上每个 key，值均为字符串
- key 列表：${keysList}
- 建议必须严格符合「${workTitle?.trim() || "该作品"}」的世界观与设定，禁止套用其他作品的设定（例如《三体》中不得出现 Stark、Lannister 等《冰与火之歌》家族名）
${narrativeGroundingRules(hasEvidence)}
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
  evidenceBlock?: string;
}): string {
  const {
    entityType,
    scopeFieldValue,
    workTitle,
    retryFields,
    evidenceBlock = "",
  } = params;
  const entityLabel = entityTypeLabel(entityType);
  const workContext = workTitle?.trim()
    ? `作品名称：${workTitle.trim()}`
    : "作品名称：（未提供）";
  const hasEvidence = Boolean(evidenceBlock.trim());

  const fieldBlocks = retryFields
    .map((r) => {
      const label = getFieldLabel(entityType, r.field);
      const feedbackLine = r.feedback?.trim()
        ? `  运营者反馈：${r.feedback.trim()}`
        : "  请提供一个与上次不同的建议。";
      return `  - "${r.field}"（${label}）\n  上一次建议：${r.previousSuggestion}\n${feedbackLine}`;
    })
    .join("\n");

  const keysList = retryFields.map((r) => `"${r.field}"`).join(", ");

  return `你是一个辅助内容管理系统的助手，正在为文学作品的元数据字段重新生成建议值。

${workContext}
实体类型：${entityLabel}
实体名称：${scopeFieldValue}

${evidenceBlock}

待重试字段（共 ${retryFields.length} 个）：
${fieldBlocks}

要求：
- 输出一个 JSON 对象，必须包含以上每个 key，值均为字符串
- key 列表：${keysList}
- 新建议必须不同于「上一次建议」，并采纳运营者反馈
- 建议必须严格符合「${workTitle?.trim() || "该作品"}」的世界观，禁止套用其他作品设定
${narrativeGroundingRules(hasEvidence)}
- 每个 key 都必须有字符串值；资料不足时该 key 可为 ""（不要用臆造史实填满）
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
  workId: string;
  workTitle?: string | null;
  sourceContext?: WorkSourceContext | null;
  acceptedFacts: Record<string, string>;
  previousSuggestion?: string;
  feedback?: string | null;
  /** Preloaded entity evidence (batch paths); if omitted, loads once here. */
  narrativeContext?: EvidenceBundle | null;
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

  const narrativeContext =
    params.narrativeContext !== undefined
      ? params.narrativeContext
      : await loadNarrativeContext({
          workId,
          entityType,
          scopeFieldValue,
          sourceContext,
        });

  if (mustRefuseUngroundedNarrative(sourceContext, narrativeContext)) {
    throw new NarrativeGroundingError(
      field,
      sourceUnavailableMessage(narrativeContext)
    );
  }

  const evidenceBlock = formatEvidenceBlock(narrativeContext);
  const prompt = buildFieldPrompt({
    entityType,
    scopeFieldValue,
    field,
    workTitle,
    acceptedFacts,
    previousSuggestion,
    feedback,
    evidenceBlock,
  });

  const raw = await callCopilotTextLlm(prompt);
  const value = parseCopilotFieldValue(raw);

  return {
    field,
    value,
    confidence: "yellow",
    classification: "narrative",
    sources: sourcesFromBundle(narrativeContext),
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
      workId,
      workTitle,
      sourceContext: null,
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
      workId,
      workTitle,
      sourceContext,
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
      workId,
      workTitle,
      sourceContext,
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
      errors.push(toSuggestFieldError(fr.field, e));
    }
  }

  if (narrativeFields.length > 0) {
    if (LLM_CALL_GAP_MS > 0) await sleep(LLM_CALL_GAP_MS);

    try {
      const narrativeContext = await loadNarrativeContext({
        workId: req.workId,
        entityType: req.entityType,
        scopeFieldValue: req.scopeField,
        sourceContext: req.sourceContext,
      });

      if (mustRefuseUngroundedNarrative(req.sourceContext, narrativeContext)) {
        const message = sourceUnavailableMessage(narrativeContext);
        for (const fr of narrativeFields) {
          errors.push({
            field: fr.field,
            code: "SOURCE_UNAVAILABLE",
            message,
          });
        }
      } else {
        const evidenceBlock = formatEvidenceBlock(narrativeContext);
        const narrativeSources = sourcesFromBundle(narrativeContext);

        const prompt = buildBatchFieldPrompt({
          entityType: req.entityType,
          scopeFieldValue: req.scopeField,
          workTitle: req.workTitle,
          fields: narrativeFields,
          acceptedFacts,
          evidenceBlock,
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
            sources: narrativeSources,
          });
        }

        errors.push(
          ...collectEmptyFieldErrors(
            narrativeFields.map((f) => f.field),
            values,
            false
          )
        );
      }
    } catch (e) {
      for (const fr of narrativeFields) {
        errors.push(toSuggestFieldError(fr.field, e));
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
              workId: req.workId,
              workTitle: req.workTitle,
              sourceContext: req.sourceContext,
              acceptedFacts,
            });

      if (!item.value.trim()) continue;
      items.push(item);
    } catch (e) {
      errors.push(toSuggestFieldError(fr.field, e));
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
      errors.push(toSuggestFieldError(rfr.field, e));
    }
  }

  if (narrativeRetries.length > 0) {
    try {
      const narrativeContext = await loadNarrativeContext({
        workId: context.workId,
        entityType: context.entityType,
        scopeFieldValue: context.scopeFieldValue,
        sourceContext: context.sourceContext,
      });

      if (mustRefuseUngroundedNarrative(context.sourceContext, narrativeContext)) {
        const message = sourceUnavailableMessage(narrativeContext);
        for (const rfr of narrativeRetries) {
          errors.push({
            field: rfr.field,
            code: "SOURCE_UNAVAILABLE",
            message,
          });
        }
      } else {
        const evidenceBlock = formatEvidenceBlock(narrativeContext);
        const narrativeSources = sourcesFromBundle(narrativeContext);

        const prompt = buildBatchRetryPrompt({
          entityType: context.entityType,
          scopeFieldValue: context.scopeFieldValue,
          workTitle: context.workTitle,
          retryFields: narrativeRetries,
          evidenceBlock,
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
            sources: narrativeSources,
          });
        }
      }
    } catch (e) {
      for (const rfr of narrativeRetries) {
        errors.push(toSuggestFieldError(rfr.field, e));
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
