/**
 * SPEC-D3-001 §4.4 — normative UI copy (zh-CN fixed locale until i18n)
 */

export const DISCOVERY_NARRATIVE_HINT =
  "叙事发现以正文为先。请勿单独使用关键词列表、运行时场景表导出或章节目录元数据作为唯一输入。";

export const DISCOVERY_FORBIDDEN_INPUTS = [
  "仅关键词列表",
  "仅运行时场景标识或场景表导出",
  "仅章节目录元数据",
] as const;

export const DISCOVERY_EXAMPLES = [
  {
    label: "合规",
    example:
      "来自不同章节、描述红色婚礼的三段摘录（凯特琳视角抵达、背叛、余波），按故事阅读顺序排列；总字数 ≥ 512",
    verdict: "通过",
  },
  {
    label: "不合规",
    example: "单行「红色婚礼、罗柏、瓦德·佛雷、凯特琳」",
    verdict: "未通过（NG-05）",
  },
  {
    label: "不合规",
    example: "仅导出场景表标题/章号，无叙事摘录",
    verdict: "未通过（NG-06）",
  },
  {
    label: "不合规",
    example: "仅粘贴章节目录（章号 + 标题列表），无叙事正文",
    verdict: "未通过（NG-06）",
  },
  {
    label: "合规",
    example:
      "操作者撰写并经确认的摘要 ≥ 768 字，勾选确认框；可无摘录",
    verdict: "通过（摘要模式）",
  },
] as const;
