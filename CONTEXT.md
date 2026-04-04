# Raree Show — 项目上下文

## 基本信息
- 目标：国际远程前端工作
- 计划：60天冲刺，当前第2天，阶段一（第1-20天）
- 沟通语言：中文

---

## raree-show-web

**仓库**：https://github.com/yoghourt/raree-show-web
**线上地址**：https://raree-show-web.vercel.app
**技术栈**：Next.js 14 App Router · TypeScript · Tailwind CSS · Gemini API · Cloudinary · Vercel

### 已完成
- 作品列表页、作品详情页、场景幻灯片页
- Gemini API 集成（流式输出，AI 场景问答）
- 第一个模范 PR：`feat/ai-scene-assistant`
- README 完成（架构说明、ADR、项目结构）✅

### 数据
- 136 个角色、256 个地点、8 个场景、74 张人物肖像图

### 关键文件
- `src/components/raree/SceneExperience.tsx` — 场景客户端组件
- `src/components/raree/SceneAssistant.tsx` — AI 问答悬浮球
- `src/app/api/scene-assistant/route.ts` — Gemini API Route Handler
- `data/scenes.json` — 场景数据

### 下一步
- 补充 scenes.json（随原著阅读进度）
- 录制 Demo GIF 替换 README placeholder

---

## raree-show-admin

**仓库**：https://github.com/yoghourt/raree-show-admin
**线上地址**：https://raree-show-admin.vercel.app/scenes
**技术栈**：Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui · Vercel

### 已完成
- PR #1：项目初始化 + Mock CRUD + 部署 Vercel ✅
  - 深色侧边栏 layout（AppSidebar）
  - Scenes 列表、新增、编辑、删除
  - TSID 完整显示（无截断）

### 关键文件
- `components/scenes/SceneTable.tsx` — 场景表格
- `components/layout/AppSidebar.tsx` — 侧边导航
- `lib/mock-data.ts` — Mock 数据
- `hooks/useScenes.ts` — CRUD 状态管理

### 下一步
- PR #2：`feat/supabase-migration` — 迁移 Supabase，替换 mock 数据层

---

## 工作流约定
- 分支规范：`feat/xxx` → `dev` → `main`
- Commit：有真实产出才提交，附规范英文描述
- 每日最小闭环：一个工程行为 + 一次英文技术输出
- 对话中断恢复：把此文件内容贴给 Claude 即可