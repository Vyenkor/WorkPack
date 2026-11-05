---
version: alpha
name: WorkPack
description: "Warm ivory desktop UI, charcoal type, terracotta actions, flush full-height sidebar, fine dividers and Chinese serif headings. Match the approved concise UI references under Agent/Codex/UI精简版."

colors:
  primary: "#ac4526"
  primary-hover: "#a64022"
  primary-soft: "#eee3d7"
  on-primary: "#ffffff"
  focus-ring: "#ac4526"
  canvas: "#faf9f5"
  surface: "#faf9f5"
  surface-subtle: "#f0ede7"
  surface-hover: "#ece7df"
  sidebar: "#f0eee7"
  hairline: "#e3ddd3"
  hairline-strong: "#c7bdb0"
  control-border: "#877d71"
  ink: "#302f2b"
  ink-secondary: "#514c45"
  ink-muted: "#6d685f"
  status-done: "#346b35"
  status-done-soft: "#e8efe4"
  status-pending: "#8f5a24"
  status-pending-soft: "#f6efe6"
  status-na: "#625e57"
  status-na-soft: "#eeeae3"
  danger: "#a33b34"
  danger-soft: "#f6eceb"
  overlay: "rgba(48, 47, 43, 0.3)"

typography:
  page-title:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  section-title:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  card-title:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0
  body:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  label:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  stat-number:
    fontFamily: "Segoe UI, Microsoft YaHei UI, sans-serif"
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  sm: 4px
  md: 8px
  lg: 8px
  xl: 12px
  shell: 0px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 40px

components:
  app-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  divider:
    backgroundColor: "{colors.hairline}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.hairline-strong}"
    height: 1px
  control-boundary:
    backgroundColor: "{colors.control-border}"
    height: 1px
  focus-indicator:
    backgroundColor: "{colors.focus-ring}"
    rounded: "{rounded.md}"
    height: 3px
  modal-overlay:
    backgroundColor: "{colors.overlay}"
  button-disabled:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 44px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0 16px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0 16px
    height: 44px
  button-small:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: 0 10px
    height: 28px
  button-danger-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 10px
    height: 44px
  text-input-focused:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  nav-item:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 20px
  table-header:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 10px 12px
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 12px
  table-row-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
  status-done:
    backgroundColor: "{colors.status-done-soft}"
    textColor: "{colors.status-done}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  status-pending:
    backgroundColor: "{colors.status-pending-soft}"
    textColor: "{colors.status-pending}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  status-na:
    backgroundColor: "{colors.status-na-soft}"
    textColor: "{colors.status-na}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  progress-fill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    height: 6px
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 24px
  toast-success:
    backgroundColor: "{colors.status-done-soft}"
    textColor: "{colors.status-done}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  toast-error:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  banner-warning:
    backgroundColor: "{colors.status-pending-soft}"
    textColor: "{colors.status-pending}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
---

# WorkPack 设计规范

## Overview

以 `Agent/Codex/UI精简版` 中确认的五张精简图为视觉依据，项目列表、事项抽屉及六类弹窗使用同目录的补充设计图。布局传达信息；不添加重复标题的副标题、英文眉题、默认“暂无说明”或解释操作方式的段落。用户输入的备注、必要错误和迁移提醒保留。

## Colors

暖白 `canvas` 和 `surface` 铺满内容区域，暖灰 `sidebar` 用于全高侧栏。Accent 是陶土色 `primary`；`primary-soft` 用于当前导航，`surface-hover` 用于悬停。状态与品牌色分离：`status-done` 表示完成，`status-pending` 表示待办，`danger` 表示错误或删除。所有状态同时包含文字。

颜色以头部 token 为准。正文对比度至少 4.5，控件边框和焦点至少 3。装饰性细线使用 hairline；输入控件使用 control-border。

## Typography

中文界面正文使用 Microsoft YaHei UI、Microsoft YaHei、PingFang SC、Segoe UI。页面及区块标题使用本机宋体家族，数字可使用标题字体；控件保持无衬线。可读文字不得小于 12px。不使用中文负字间距。

标题 48px、区块 28px、正文 16px、辅助元数据 14px；1050–1180px 窗口收为标题 40px、区块 24px、正文 14px。路径为等宽字，设置中允许换行显示完整路径，项目辅助栏使用缩略路径并提供完整 title 与复制操作。

## Layout

### 页面结构

窗口最小宽度 1050px，侧栏在 1050–1180px 为 216px，更宽时占窗口 17%，最大 272px。内容最大宽度 1440px，默认左右 padding 为 spacing.xxl，窄窗口改为 spacing.lg。顶栏只放面包屑与搜索。

品牌图形来自 `src/renderer/src/assets/workpack-logo.png`，使用原图形并配深色 WorkPack 字样，在侧边栏内水平居中，左右留白相等。原图蓝色不进入界面色板。

### 一级布局

Level 0 画布为暖白；Level 1 侧栏从窗口顶部到底部，右侧为顶栏与可滚动内容。rounded.shell 为 0，不保留旧版三块浮动圆角壳层或外围灰色沟槽。不加阴影。Level 2 信息使用对齐、间距和细线分区，不要卡片套卡片。

### 间距

使用 4px 倍数的 spacing token：xs、sm、md、lg、xl、xxl。空状态可扩大留白，但移除说明后要收紧空白行。相同层级保持一致。

### 工具栏

页面标题及主要操作位于同一行；搜索、筛选独立排列在其下。待处理先状态标签，再筛选，再分组。按窗口宽度整体换行，不能压缩输入框内容。排序仅在有真实功能时提供。按钮 44px，紧凑按钮 36px。

### 表格与列表

文件库使用表格，项目使用横向列表，待办使用稳定列。列宽优先文件名称，再状态、客户及经办人，操作靠右。长名称可换行；必要时横向滚动。禁止为补空白而造假记录。

### 行高与垂直密度

文件库行目标 88px，项目概览行约 100px，待处理根据内容自适应。多行名称、Badge、附件及错误需要的垂直空间不得裁切。控件最小点击区域 28px。事项在主列表保留轻量概览。

### 主次信息

文件名称 > 状态及修改时间 > 类型及大小 > 辅助信息。无需每个值都加一个次要标签；通过列和布局表达含义。用户输入内容不能作为“说明过多”而被删除。

## Elevation & Depth

普通页面、列表无阴影。弹窗、抽屉、下拉菜单使用 `0 12px 32px rgba(48, 47, 43, .16)`。遮罩使用 overlay。下拉菜单保持在视口内；弹窗与抽屉隔离背景交互。

## Shapes

按钮及输入框 8px，弹窗和引导区域 12px，圆形头像 50%。页面壳层直角。插图为装饰性，本机加载，不承载文字或交互。

## Components

- 主按钮陶土色，次按钮描边，低频与危险操作收进更多菜单。模板文件统一使用文件图标和主色。
- 工作台保留确认图的引导区与入口；有项目后隐藏首次创建引导。
- 菜单保留编辑、导入、移除记录和删除对象的区别；不可逆删除需确认，并说明磁盘文件是否保留。
- 六类表单统一标题、关闭、字段、取消和提交，不添加教学说明。必要字段标签不能移除。
- 文件库保留“待办清单由各事项单独管理。”，存储设置保留迁移提醒，细节由展开入口呈现。
- Toast 成功三秒消失，错误持续显示直到关闭或下一次操作。

## Interaction Patterns

- **侧边抽屉**（已实现）：720px，不离开项目页，不离开待处理页。`Tab` 在抽屉内循环，Esc 返回；背景 inert。关闭后返回原触发控件或相邻记录。有未保存修改时，关闭前需要确认。
- **表单**（已实现）：初始焦点落在首个输入框，Tab 循环；关闭恢复原焦点；保存中不重复提交或关闭。
- **全局搜索**（已实现）：Ctrl+K 聚焦搜索，Enter 跳转到匹配项目或事项，未匹配时显示错误。不是尚不存在的搜索结果面板。
- **待处理状态**（已实现）：全部包含所有文件项；未完成和已完成根据文件待办及附件可用性判断。筛选、分组在本机持久化，清除不重置分组。
- **文件库**（已实现）：名称及文件名搜索、分类筛选、编辑与分类管理、导入导出、移除记录；附件失效时禁用导出。
- **路径**（已实现）：复制完整路径；存储位置使用原生选择器。迁回旧目录前需处理旧数据库，不承诺自动清理或自动备份。
- **更多菜单**（已实现）：键盘打开后聚焦首个可用操作，方向键移动，Esc 返回触发按钮，点击外部关闭。

## Content & Copy

简体中文。标题说明对象，按钮说明动作。页面不添加说明性副标题，空状态只保留短标题和必要操作。英文眉题、被圈出的说明、重复元数据不允许恢复。错误、用户备注、文件失效及数据迁移信息保留。新增入口必须有真实行为，不能是装饰按钮。

## Do's and Don'ts

使用 token，保留可读对比度及焦点。不要恢复冷灰蓝壳层，不要全局引入组件库默认蓝色样式，不要硬编码示例数据，不要引入远程字体。删除图中说明后，不能再用另一句相同意思的副标题补回。

## Responsive Behavior

验证 1600×1000、1280×800 和 1050×700。小窗口保留所有操作，可滚动而不裁切。弹窗最大高度为视口减去 48px，抽屉不遮住整个侧栏。避免横向页面溢出；表格可内部滚动。

## Agent Prompt Guide

先读确认图，再补齐无图页面设计。只做有功能依据的控件；不增加无用说明。最终以真实 Electron 截图核对，不把生成图片当作运行截图。

## Iteration Guide

更新 token 和实现后，运行设计对比度检查、类型检查、单元测试和 Electron 端到端测试。新增交互要覆盖键盘、取消、错误、窄窗口及长文本。提交 PR 前自查旧 UI 残留、无效引用、缺陷及安全问题。

## Known Gaps

设计参考包含示例数据；运行时必须显示本机真实数据。原图的手绘纹理使用本机装饰性插图呈现。日期、路径、字体渲染随系统变化，不能把参考图里的用户路径硬编码成真实数据。
