/**
 * Discovery UI copy — fixed zh-CN until i18n.
 *
 * Data-layer field keys (name, displayName, etc.) stay English in payloads;
 * only operator-facing labels live here.
 */

import type { DiscoveryCandidateType } from "@/lib/discovery/propose-types";
import type { ReviewItemStatus } from "@/lib/discovery/review-types";

export const DISCOVERY_PAGE_TITLE = "叙事发现";
export const DISCOVERY_PAGE_SUBTITLE =
  "叙事优先的发现会话。锁定叙事后方可生成候选（Propose）。";

export const DISCOVERY_CANDIDATE_TYPE_LABELS: Record<
  DiscoveryCandidateType,
  string
> = {
  character: "角色",
  location: "地点",
  story: "故事单元",
  scene: "场景",
};

export const REVIEW_STATUS_LABELS: Record<ReviewItemStatus, string> = {
  pending: "待审核",
  edited_pending_accept: "已编辑 · 待采纳",
  discarded: "已丢弃",
  accepted: "已采纳",
};

export const CONFIDENCE_LABELS: Record<"green" | "yellow" | "red", string> = {
  green: "置信度高",
  yellow: "置信度中",
  red: "置信度低",
};

/** Common Candidate / form field labels for Review UI */
export const CANDIDATE_FIELD_LABELS: Record<string, string> = {
  displayName: "显示名称",
  summary: "摘要",
  fields: "字段",
  evidence: "依据",
  name: "名称",
  house: "家族",
  description: "描述",
  signatureQuote: "标志性台词",
  region: "地区",
  title: "标题",
  boundaryHint: "边界提示",
  chapter_title: "章节标题",
  chapter_number: "章节序号",
};

export function candidateFieldLabel(key: string): string {
  return CANDIDATE_FIELD_LABELS[key] ?? key;
}

export const discoveryReviewUi = {
  panelTitle: "人工审核",
  panelDescription:
    "每条候选须单独审核；采纳后仍停留本页，可继续处理其余结果。",
  tabReview: "待审核",
  tabAccepted: "已采纳暂存",
  flowHintReview: "审核并采纳候选后，查看「已采纳暂存」确认内容",
  flowHintReviewDone: "所有候选已处理完毕",
  flowHintAccepted: "确认内容无误后，前往 Rollout 持久化并投影",
  flowHintAcceptedEmpty: "暂无已采纳的 Story / Scene 候选",
  nextStepAccepted: "已采纳暂存",
  nextStepRollout: "前往 Rollout 投影",
  noReviewItems: "暂无待审核候选",
  pipelineBanner: "发现流水线",
  fullRePropose: "全部重新生成",
  fullReProposing: "全部重新生成中…",
  accept: "采纳",
  edit: "编辑",
  discard: "丢弃",
  regen: "重新生成",
  regening: "重新生成中…",
  confirmRegen: "确认重新生成",
  noFields: "无字段内容",
  tierLabel: (tier: number) => `层级 ${tier}`,
  goCreateCharacter: "前往创建角色（预填表单）",
  goCreateLocation: "前往创建地点（预填表单）",
  editAfterAcceptHint: "名称有误可先编辑修正，再打开预填创建页",
  typeProposeFailed:
    "该类型生成失败 — 可重试本类型，或使用「全部重新生成」重新生成全部类型。",
  retryType: (typeLabel: string) => `重试${typeLabel}`,
  retryingType: "重试本类型中…",
  acceptedStoryStaging: "已采纳的故事单元（暂存）",
  acceptedSceneStaging: "已采纳的场景候选（暂存）",
  goRollout: "前往 Rollout 投影",
  editAfterAcceptSceneHint:
    "章节序号 chapter_number 须为 ≥1 的整数；POV 名（如 Bran I）请写在 chapter_title。",
  editStagingHint: "修改后暂存区与 Rollout 队列会同步更新。",
  revokeAccept: "取消采纳",
  confirmRevokeAccept:
    "确定取消采纳？将回到上方待审核列表，并从 Rollout 待处理队列移除。",
  editDialogTitle: "编辑候选",
  editDialogAccepted:
    "保存后仍为已采纳状态；预填创建页与暂存区会同步更新。",
  editDialogPending:
    "保存后进入「已编辑 · 待采纳」，仍需采纳后才能进入生产流程。",
  fieldsJsonLabel: "字段（JSON）",
  fieldsJsonParseError: "字段 JSON 解析失败",
  regenDialogTitle: "重新生成候选",
  regenDialogDescription: "可选反馈将传给重新生成接口。",
  feedbackPlaceholder: "操作者反馈（可选）",
  retryTypeDialogTitle: (typeLabel: string) => `重试${typeLabel}生成`,
  retryTypeDialogDescription:
    "仅重新生成该类型候选；已成功的类型不受影响。可选反馈将一并提交。",
  confirmRetry: "确认重试",
  retrying: "重试中…",
  fullReProposeConfirmTitle: "确认全部重新生成？",
  fullReProposeConfirmDescription:
    "将替换整个候选集合；未采纳的审核进度会丢失。",
  confirmFullRePropose: "确认重新生成",
} as const;

export const discoveryHandoffUi = {
  backToDiscovery: "← 返回叙事发现",
  breadcrumbDiscovery: "叙事发现",
} as const;

export const discoveryComposerUi = {
  sessionConflict:
    "当前作品已存在另一个发现会话。请关闭其他标签页后刷新。",
  narrativeGuideTitle: "叙事输入引导",
  forbiddenInputsTitle: "禁止作为唯一输入：",
  examplesTitle: "示例",
  examplesDescription: "合规与不合规输入示例",
  exampleGood: "合规",
  exampleBad: "不合规",
  narrativeInputTitle: "叙事输入",
  lockedDescription: (lockedAt: string) => `已锁定 · ${lockedAt}`,
  draftDescription: (min: number, current: number) =>
    `草稿 · 至少需要 ${min} 字 · 当前 ${current} 字`,
  inputModeLabel: "输入模式",
  excerptBundleMode: (min: number) => `跨章摘录（≥ ${min} 字）`,
  approvedSummaryMode: (min: number) => `经确认的摘要（≥ ${min} 字）`,
  inputModeSwitchHint: "切换输入模式会清空当前叙事草稿，字数从 0 重新计算。",
  excerptLabel: (index: number) => `摘录 #${index}`,
  removeExcerpt: "删除",
  sourceLabelPlaceholder: "来源标签（可选），如第 47 章 — 凯特琳视角",
  excerptPlaceholder:
    "粘贴叙事正文…（勿使用关键词列表，如「红色婚礼、罗柏、佛雷、凯特琳」）",
  addExcerpt: "添加摘录",
  operatorSummaryRequired: "经确认摘要（必填）",
  operatorSummaryOptional: "操作者摘要（可选）",
  operatorSummaryPlaceholder: "粘贴或撰写摘要正文…",
  excerptBundleSummaryHint:
    "摘录模式下摘要不能替代摘录；仅填摘要会触发校验失败。",
  summaryAttested:
    "我确认此摘要准确代表待发现的叙事内容。",
  importFlagsTitle: "导入标记（仅用于门槛校验，不会写入锁定 bundle）",
  catalogOnlyFlag: "内容仅来自章节目录导出，未添加叙事正文",
  runtimeExportOnlyFlag: "内容仅来自运行时场景列表/元数据导出",
  gateFailedTitle: "叙事门槛校验未通过",
  lockNarrative: "锁定叙事",
  unlockNarrative: "解锁叙事",
  startPropose: "开始生成候选",
  proposing: "候选生成中…",
  lockConfirmTitle: "确认锁定叙事输入？",
  lockConfirmDescription:
    "锁定后叙事内容在生成与审核完成前不可编辑，需显式确认。",
  confirmLock: "确认锁定",
  cancel: "取消",
} as const;
