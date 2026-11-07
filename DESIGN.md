---
version: alpha
name: WorkPack
description: "Linear-inspired light desktop workspace with a compact sidebar, a rounded content surface, dense rows and indigo actions."

colors:
  primary: "#505bc7"
  primary-hover: "#454fb2"
  primary-soft: "#e8eafd"
  on-primary: "#ffffff"
  focus-ring: "#505bc7"
  canvas: "#ededee"
  surface: "#f8f8f9"
  surface-subtle: "#efeff1"
  surface-hover: "#e9e9ed"
  nav-selected: "#e1e1e2"
  sidebar: "#ededee"
  hairline: "#eeeef0"
  hairline-strong: "#c9c9d0"
  control-border: "#85858f"
  ink: "#222225"
  ink-secondary: "#424249"
  ink-muted: "#5e5e68"
  status-done: "#444eaf"
  status-done-soft: "#e7e9fa"
  status-pending: "#80541a"
  status-pending-soft: "#fbf1dc"
  status-na: "#595963"
  status-na-soft: "#e9e9ed"
  danger: "#a23845"
  danger-soft: "#f9e8eb"
  overlay: "rgba(34, 34, 37, 0.28)"

typography:
  page-title:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  section-title:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  card-title:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0
  body:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 15px
    fontWeight: 450
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.6
    letterSpacing: 0
  label:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 12px
    fontWeight: 450
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  stat-number:
    fontFamily: "Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  sm: 4px
  md: 8px
  lg: 8px
  xl: 12px
  shell: 12px
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
    height: 34px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0 16px
    height: 34px
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
    height: 34px
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
    height: 34px
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
    padding: 4px 8px
    height: 34px
  nav-item-active:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 4px 8px
    height: 34px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 16px 24px
  table-header:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 8px 12px
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
    height: 4px
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

以用户提供的 Linear 浅色桌面项目列表截图为视觉基准。主界面采用灰白工作区、紧凑侧栏、无衬线文字、对齐的列表列和蓝紫色操作反馈。[Linear 设计参考](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md)用于补充控件和分隔线的规则。WorkPack 使用本机项目、事项、文件和模板数据。

## Colors

灰色 `canvas` 与 `sidebar` 包围较亮的 `surface`。蓝紫色 `primary` 用于主操作、焦点及当前资料进度。`primary-soft` 用于轻量选中状态，侧栏当前项使用 `nav-selected` 中性底，悬停使用 `surface-hover`。蓝紫色 `status-done` 表示完成，琥珀色表示待办或路径异常，红色表示错误或删除。状态同时显示文字、图形或数值。

正文与背景对比度至少 4.5，控件边框和焦点至少 3。装饰分隔线使用更浅的 `hairline`，仅保留必要的表头与状态边界；数据行、详情统计及分区优先用间距组织。输入边界使用 `control-border`。

## Typography

使用 Linear 当前应用的字体栈，英文及数字优先使用随应用打包的 Inter Variable 4.1。后续回退依次为 SF Pro Display、Apple 系统字体、Segoe UI、Roboto、Oxygen、Ubuntu、Cantarell、Open Sans、Helvetica Neue 和 sans-serif。中文由系统选择该栈支持的 CJK 字体。中文保留默认字距。

字号采用 Linear 的应用级比例。正文和项目名称 15px，辅助文字、输入控件及按钮 13px，标签 12px，页面标题 18px。正文默认字重 450，操作与列表名称 500，分区标题 600。各页面空状态提示统一为 13px、450 字重，行高 1.5。正文行高 1.5，进度数字采用等宽数字。长路径使用 13px 的等宽系统字体。

来源为 [Linear 应用样式](https://static.linear.app/client/assets/style-nDwjYmzh.css)及其登录页的字体声明，核对日期为 2026年11月7日。Inter 的 OFL 许可随应用保存在 `licenses/Inter-OFL.txt`。

## Layout

### 页面结构

窗口最小宽度 1050px。侧栏宽度在 192px 至 232px 之间，优先容纳导航文字和计数。顶部统一预留 44px，用于页面导航工具、当前位置和全局搜索。主面板占据剩余高度并独立滚动。左下角单独显示 `src/renderer/src/assets/workpack-logo.png` 的灰度图形标。

顶部当前位置使用透明背景的文字面包屑，项目层级保留返回操作。侧栏选中项使用 500 字重。工作台使用收件箱图标，项目入口、列表和空状态使用立方体图标。文件库导航及其空状态使用同一文档编辑图标，参照用户提供的 Linear 图标轮廓。实际文件及打开文件夹操作分别保留文件和文件夹图标。

侧栏折叠、返回及前进工具始终与顶栏当前位置文字垂直居中对齐。折叠后内容区域扩展，工具保留在左上方，主面板左右外边距均为 8px，展开按钮持续可用。导航箭头根据本次窗口内的页面访问顺序启用。

窗口底部预留 40px 高的公共留白区，主面板在该区域上方结束。灰度图形标距窗口左侧 24px，在底部区域内垂直居中。侧栏展开和折叠使用相同的底部留白及图标位置。

### 一级布局

Level 0 为窗口和灰色侧栏，Level 1 为单一浅色工作面板，`rounded.shell` 为 12px。Level 2 使用行、列和细分隔线组织内容。弹窗、抽屉及菜单与工作面板分层。

### 间距

间距按 4px 栅格使用 `xs`、`sm`、`md`、`lg`、`xl`、`xxl`。空状态使用小图标、简短状态和必要操作。

### 工具栏

页面标题和主要操作同行，筛选及搜索控件靠近列表。待处理保留完成状态筛选、项目及经办人分组。筛选栏可换行，窄窗口收紧间距。按钮、搜索框、下拉框及分类筛选统一为 34px 高，相邻控件采用相同圆角并垂直对齐，宽度按文字内容安排；紧凑行内操作 28px。一级页面标题区统一使用 36px 行高，右侧主要操作保持同一顶边及右边位置；详情页更多菜单位于编辑按钮左侧，两个控件均为 34px 高。仅为可执行的排序和筛选显示入口。

### 表格与列表

项目列表按名称、客户、负责人、事项数、资料进度和操作对齐。待处理列表展示文件、关联项目及事项、待办状态和经办人。文件库使用模板表格。长文本可换行，文件库表格可在内容区内部横向滚动。

### 行高与垂直密度

项目行至少 48px，文件模板行至少 46px。待处理和事项行随名称、状态及附件内容展开。控件点击区域至少 28px，长标签和错误信息保留足够垂直空间。

### 主次信息

项目和文件名称优先，其次为归属、状态与进度。用户录入的备注、路径失效及迁移信息在相关页面展示。

## Elevation & Depth

窗口面板及列表用背景层次和细线区分。弹窗、抽屉和下拉菜单使用浮层阴影。打开模态交互时隔离背景，浮层保持在视口内。

## Shapes

按钮、输入框及选中导航采用 8px 圆角。内容面板、菜单和弹窗为 12px。状态标签采用 4px 圆角。进度条和头像使用圆角端点。

## Components

- 工作台优先展示待处理文件和最近项目。待处理行打开关联事项，项目行进入项目详情。
- 工作区菜单在侧栏顶部，首层为 184px 宽的紧凑菜单，仅显示 News 和设置。News 进入 264px 宽的二级更新日志，提供返回按钮；Esc 从二级返回首层，再次 Esc 关闭菜单。重新打开始终显示首层。当前导航通过 `aria-current` 和中性色背景标识。
- 项目及文件库把编辑、导入和删除收进更多菜单。删除确认说明本机文件的处理方式。
- 详情和事项抽屉使用紧凑标题、状态和分组行。六类表单保持一致的标题、关闭、字段和提交区域。
- 文件库使用文件图标及主色区分模板文件。存储设置保留必要的路径与迁移信息。
- Toast 成功三秒消失，错误持续到关闭或下次操作。

## Interaction Patterns

- **页面导航**（已实现）：返回与前进支持主页面及具体项目，支持 Alt+← 与 Alt+→。返回后进入其他页面会开始新的前进分支，已删除的项目从可返回目标中跳过。抽屉和表单打开期间背景工具不可操作，当前页筛选状态保留。
- **侧边抽屉**（已实现）：最大宽度 720px，在工作台、项目详情或待处理页就地打开。Tab 在抽屉内循环，Esc 返回，背景使用 inert。关闭后聚焦原触发控件或相邻记录。有未保存修改时，关闭前需要确认。
- **表单**（已实现）：初始焦点落在首个输入框，Tab 循环；关闭恢复原焦点；保存中不重复提交或关闭。
- **全局搜索**（已实现）：Ctrl+K 聚焦搜索，Enter 跳转到匹配项目或事项，未匹配时显示错误。
- **待处理状态**（已实现）：首次进入默认显示未完成，清除筛选恢复未完成；全部包含所有文件项；未完成和已完成根据文件待办及附件可用性判断。用户主动选择的筛选、分组在本机持久化，清除不重置分组。侧栏角标始终只计有缺口的文件。
- **文件库**（已实现）：名称及文件名搜索、分类筛选、编辑与分类管理、导入导出、移除记录；附件失效时禁用导出。
- **路径**（已实现）：复制完整路径；存储位置使用原生选择器。迁回旧目录前需处理旧数据库，不承诺自动清理或自动备份。
- **更多菜单**（已实现）：键盘打开后聚焦首个可用操作，方向键移动，Esc 返回触发按钮，点击外部关闭。

## Content & Copy

使用简体中文。页面标题直接命名对象，按钮直接描述动作。空状态使用一行文案和必要操作。保留用户备注、错误及数据迁移信息。

## Do's and Don'ts

使用共享颜色、间距和组件规则。真实资料进度显示百分比和进度条。界面使用本机字体和真实数据，入口对应 WorkPack 的实际行为。

## Responsive Behavior

核对 1600×1000、1280×800 和 1050×700。窄窗口优先保留项目及文件列，次要文本可换行，右侧面板可滚动。抽屉限制在侧栏以外的窗口宽度。弹窗最大高度为视口减去 48px。

## Agent Prompt Guide

以 Linear 浅色桌面截图为基准，优先还原导航、标题、行列密度和交互层级。依据 WorkPack 的现有数据与行为配置列和操作。以 Electron 实际运行截图核对。

## Iteration Guide

运行设计对比度检查、类型检查、单元测试和 Electron 端到端测试。涉及交互或尺寸时核对键盘、长名称和窄窗口。

## Known Gaps

参考截图中的优先级、日期、头像和历史趋势属于 Linear 的数据。WorkPack 的项目列表显示当前资料进度和已有项目字段。Windows 标题栏和字体由系统呈现。
