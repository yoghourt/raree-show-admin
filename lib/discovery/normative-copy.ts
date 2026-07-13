/**
 * SPEC-D3-001 §4.4 — normative UI copy (zh-CN fixed locale until i18n)
 * SPEC-VDC-001 — Runtime vocabulary strings sourced from lib/locale
 */

import { messages } from "@/lib/locale";

export const DISCOVERY_NARRATIVE_HINT = messages.discovery.narrativeHint;

export const DISCOVERY_FORBIDDEN_INPUTS = [
  "仅关键词列表",
  messages.discovery.forbiddenRuntimeTableExport,
  "仅章节目录元数据",
] as const;

export const DISCOVERY_EXAMPLES = [
  {
    label: messages.discovery.composer.exampleGood,
    example:
      "来自不同章节、描述红色婚礼的三段摘录（凯特琳视角抵达、背叛、余波），按故事阅读顺序排列；总字数足够",
    verdict: "可用",
  },
  {
    label: messages.discovery.composer.exampleBad,
    example: "单行「红色婚礼、罗柏、瓦德·佛雷、凯特琳」",
    verdict: "不够（只有关键词）",
  },
  {
    label: messages.discovery.composer.exampleBad,
    example: messages.discovery.forbiddenCatalogExportExample,
    verdict: "不够（只有目录）",
  },
  {
    label: messages.discovery.composer.exampleBad,
    example: "仅粘贴章节目录（章号 + 标题列表），无叙事正文",
    verdict: "不够（只有目录）",
  },
  {
    label: messages.discovery.composer.exampleGood,
    example: "自己写好并勾选确认的摘要，字数足够；可以没有摘录",
    verdict: "可用（摘要方式）",
  },
] as const;
