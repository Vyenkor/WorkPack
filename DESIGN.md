---
version: alpha
name: WorkPack
description: "A calm, light, information-dense Windows desktop tool for tracking project paperwork. Cool neutral canvas (#f4f5f7) and near-white surfaces, separated by quiet hairlines rather than shadows. Ink is near-black blue-gray (#1b1e24), not pure black. One low-saturation blue-gray accent (#3d5674) is reserved for primary actions, active navigation, selection, focus and links. Status stays separate: done green, pending brown, not-applicable gray, error red, always paired with a text label. Chinese-first typography: Microsoft YaHei UI, body at 14px with 1.6 line height, nothing below 12px."

colors:
  primary: "#3d5674"
  primary-hover: "#324860"
  primary-soft: "#e7edf3"
  on-primary: "#ffffff"
  focus-ring: "#3d5674"
  canvas: "#f4f5f7"
  surface: "#fbfcfd"
  surface-subtle: "#f0f1f4"
  surface-hover: "#e8eaee"
  sidebar: "#f3f4f6"
  hairline: "#e4e6eb"
  hairline-strong: "#d0d3da"
  control-border: "#6e7582"
  ink: "#1b1e24"
  ink-secondary: "#3d4450"
  ink-muted: "#5c6570"
  status-done: "#1d6b4a"
  status-done-soft: "#e6f1eb"
  status-pending: "#8f5a24"
  status-pending-soft: "#f6efe6"
  status-na: "#5c656e"
  status-na-soft: "#eef0f2"
  danger: "#a33b34"
  danger-soft: "#f6eceb"
  overlay: "rgba(27, 30, 36, 0.3)"

typography:
  page-title:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  section-title:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  card-title:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0
  body:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  label:
    fontFamily: "Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Segoe UI, sans-serif"
    fontSize: 13px
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
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  stat-number:
    fontFamily: "Segoe UI, Microsoft YaHei UI, sans-serif"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0
  mono:
    fontFamily: "Cascadia Mono, Consolas, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
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
    height: 36px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0 16px
    height: 36px
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
    height: 36px
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
    height: 36px
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

本文件是 WorkPack 界面的设计依据，供开发者和 AI agent 修改界面时参照。文件头部的 token 是唯一的取值来源，正文说明这些值的用途和交互规则。格式遵循 [Google Stitch DESIGN.md](https://stitch.withgoogle.com/docs/design-md/specification/)。

## Overview

WorkPack 是给项目交付、物流和培训岗位的办公人员使用的 Windows 桌面工具，用户每天要在大量文件清单里找出“还缺什么”。界面的目标是**安静、清楚、高信息密度**：

- 浅色、中性、低饱和的背景。层级靠间距、对齐、细边框和轻微的表面色差，不靠阴影、渐变、光晕或大面积品牌色。
- 强调色是低饱和的冷灰蓝，只用于主要按钮、当前导航、选中、焦点、链接和少量交互强调，不做装饰。
- 状态色与强调色分开，并且始终配文字标签。
- 用户大多不是技术人员：文案直白，操作结果立即可见，删除这类不可逆操作之前一定要确认。

风格参考 Notion 的温和极简和 Linear 的克制原则，但 WorkPack 使用浅色主题，并以中文排版为准。

## Colors

颜色方向是 neutral / quiet / crisp / dense：中性、安静、清楚、密。不是绿色品牌的 SaaS 仪表盘。具体色值写在头部 token 里，页面不得另写一套 HEX。

### Neutral

- `canvas` 是窗口背景，`surface` 是面板和卡片。两者只差一个轻微的冷灰阶，不要拉成纯白对深灰的强反差。
- `sidebar` 使用中性表面，不带明显强调色。
- `surface-subtle` 用于表头和面板底栏。`surface-hover` 只比普通 `surface` 略深，用来表示悬停。
- `hairline` 和 `hairline-strong` 是安静的分隔线，不能单独作为控件边界。控件边界用 `control-border`。
- 文字分三级：`ink` 用于标题和正文，对比度要高，但不是纯黑；`ink-secondary` 用于次要正文和按钮；`ink-muted` 用于说明、表头和时间，明确退后，也是最浅的文字色。
- 禁用状态通过 `surface-subtle` 背景和去掉悬停效果来表达，不通过调低文字颜色或透明度。

### Accent

`primary` 是低饱和冷灰蓝。`primary-hover` 只用于主要按钮的悬停，`primary-soft` 是低饱和浅底，`focus-ring` 用同一冷灰蓝、清晰可见，不加高饱和光晕。`on-primary` 只放在 `primary` 填充上。

Accent 只用于：主要操作、当前导航、选中、焦点、链接、进度条，以及少量交互强调。每个视图里的主要按钮不超过一个。不要用 Accent 做大面积色块或装饰。

- 悬停：用 `surface-hover`，只比普通表面略有区别。
- 选中：比悬停更明确，但仍用浅表面或细边界，不要铺成大块 Accent。
- 当前导航：`nav-item-active` 使用 `primary-soft` 浅底，文字和图标用 `primary`。
- 焦点：3px `focus-ring`，偏移 2px。鼠标点击不显示焦点框。

### 状态色（最重要）

状态色继续与 Accent 分离。Done、Pending、Not Applicable、Error 各用自己的色相。背景可以降低饱和度，让标签更克制，但语义必须一眼能分开，并且必须有文字标签。不能把状态色改成 Accent。

| 状态 | 文字 | 背景 | 含义 |
| --- | --- | --- | --- |
| 已完成 | `status-done` | `status-done-soft` | 步骤完成，附件有效 |
| 待处理 | `status-pending` | `status-pending-soft` | 待准备、待填写、待签字、待归档、未上传 |
| 不适用 | `status-na` | `status-na-soft` | 不参与完成率计算 |
| 错误 | `danger` | `danger-soft` | 附件失效、目录失效、操作失败、删除 |

状态色只能表示状态。状态必须同时用文字表达（如“待签字”），不能只靠颜色区分。

### 对比度要求

- 文字和背景的组合对比度不低于 4.5（WCAG AA）。
- 焦点框 `focus-ring` 和控件边框 `control-border` 在所有背景色（`surface`、`canvas`、`surface-subtle`、`surface-hover`、`sidebar`）上的对比度不低于 3（WCAG 1.4.11 非文本对比度）。
- `hairline`、`hairline-strong` 只用于装饰性分隔，不能作为识别控件的唯一边界。

新增颜色时也必须满足这些要求。

## Typography

- 字体栈：`"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif`。英文和数字跟随系统字体，不单独引入网络字体。
- 正文用 `body`（14px / 1.6），表格和表单用 `body-sm`（13px），说明文字用 `caption`（12px）。**任何需要阅读的文字不小于 12px。**
- 中文不使用负字间距，也不全大写。标题通过字重（600）和字号区分，不使用斜体。
- 统计数字、进度百分比和日期使用 `font-variant-numeric: tabular-nums`，保证数字对齐。
- 文件路径使用 `mono`，过长时从中间截断，并在悬停提示中显示完整路径。

## Layout

WorkPack 是桌面端高信息密度操作界面，不是营销页。布局要让用户在一屏里扫到更多有效信息。信息密度接近 Linear 一类桌面生产力工具：紧凑、可扫描、少装饰。

### 页面结构

- 窗口最小宽度 1050px。左侧导航在 1180px 及以上为 240px，1050–1180px 时为 216px。内容区最大宽度 1400px，左右内边距 `spacing.xl`（1050–1180px 时改为 `spacing.lg`，见 Responsive Behavior）。
- 主内容占满这条内容区的横向空间。待处理、文件清单、项目列表这类数据密集页面优先提高横向利用率。
- 不要为了装饰再套一层更窄的最大宽度，也不要用大面积留白把内容挤在中间。
- 窗口骨架是：侧边导航 + 顶栏（面包屑、全局搜索）+ 内容区。内容区内部是一条工具栏，然后是数据或功能区。

### 间距

布局间距只用 `spacing` token，并且都是 4px 的倍数：

| 关系 | token | 尺寸 |
| --- | --- | --- |
| 同一信息组内部 | `xs`–`sm` | 8–12px |
| 控件之间 | `sm`–`md` | 12–16px |
| 面板内部 | `md`–`lg` | 16–24px |
| 不同内容区块之间 | `lg`–`xl` | 24–32px |
| 页面级主要区域之间 | `xl`–`xxl` | 32–40px |

- 数据页里，大于 `xxl`（40px）的间距不能用来制造呼吸感。页面级主要区域之间才用到 `xxl`。空状态，以及整页只有一个主动作的稀疏页面，可以超过 `xxl`，让唯一的内容和操作处在可读的位置。
- 相同层级、相同用途的组件使用相同间距。不要给每个组件单独写一套 margin / padding。
- 组件 token 里已经写明的内边距继续有效，例如 `panel` 的 20px（落在 `md`–`lg`）、`table-row` 的 12px，以及按钮和输入框的高度。布局引用这些 token，不要在外面再加一层临时间距。

### 信息密度

- 默认紧凑。一屏尽量展示更多有效记录。
- 数据、文件、任务、记录用表格或紧凑列表。不要把每一条记录包成独立卡片。
- 卡片只用于项目和事项这类需要概览的对象，并且卡片网格要铺满内容区宽度。
- 不为了呼吸感加大行高、段间距或区块间距。
- 次要信息不得占用与主要信息相同的布局权重。

### 工具栏

工具栏默认保持单行，单行状态高度为 36–44px。当可用宽度不足，继续单行会导致控件压缩、截断或溢出时，允许操作组整体换行。换行后的工具栏高度由内容决定，不再受 36–44px 限制。

默认单行顺序：

`页面标题 | 搜索 | 筛选 | 排序 | 主要操作`

- 主要操作靠右。每个视图最多一个主要按钮（见 Components）。
- 搜索、筛选、排序组成稳定操作组，顺序固定。某一项不存在时，后面的控件前移，不留空位。换行时这一组一起换，不把每个控件拆成独立行。
- 标题、说明、搜索、筛选各自占一整行不符合本规范。说明文字若必须出现，用 `caption` 跟在标题同一行。
- 内部控件使用现有高度：`button-small` 28px，`button-primary`、`button-secondary`、`text-input` 36px。不要为了守住 44px 把搜索框压扁。

### 表格与列表

数据密集页面使用稳定列，不平均分列。列宽按重要性分配：

| 列 | 宽度 |
| --- | --- |
| 名称 / 标题 | 吃掉剩余空间，是最宽的列 |
| 状态 | 固定或较窄 |
| 时间 | 稳定宽度，不随相邻列伸缩 |
| 类型 / 大小 | 较窄 |
| 操作 | 固定宽度，靠右 |

- 表头和数据行使用同一套列定义，边界对齐。图标、状态标签、操作按钮的有无不得把列左右推开。
- 与 Components 一致：数字列右对齐，状态列居中，操作列固定在右侧。
- 横向空间不够时表格横向滚动；文件名列和操作列保持可见（见 Responsive Behavior）。

### 行高与垂直密度

- 单行数据行的目标高度是 32–40px。现有 `table-row` 的 padding 是 12px，加上 `body-sm` 单行，实际大约 45px。收紧这个 token 之前，单行行高以组件 token 为准，不要为了贴进 32–40px 去裁切文字。收紧项记在 Known Gaps。
- 内容本身超过一行时，行高随内容增高，不受 40px 限制。这包括两行文件名、错误信息、辅助 metadata、多行状态说明，以及行内 Badge、操作按钮或其他控件确实需要额外垂直空间的情况。
- 不要为了呼吸感把单行数据行做成 48px、56px 或 64px。单行文本使用 `body-sm`，不要再加大行高。
- 不通过裁切内容、固定 `height` 或 `overflow: hidden` 把多行内容压进 32–40px。项目卡片和事项卡片继续作为概览组件，不把所有内容都改成表格。
- 常规按钮和输入框 28–36px，对应现有组件 token，不另设高度。工具栏高度见上一节。

### 对齐

同一页面保持稳定的轴线，重点是这些边界：

- 页面标题的左缘
- 工具栏的左右缘
- 面板边界
- 表格列边界
- 列表内容的基线
- 表头和数据行

不同区域不要各自用 margin 挪出一个不同的左侧起点。对齐靠 Grid、Flex 和固定列，不靠一次性的 margin 修正。

### 面板

- 面板只表示一块明确的功能区，不是装饰容器。
- 能用 `spacing`、`divider` 或分列表达层级时，不要新增面板。
- 不要卡片套卡片，不要在面板里再包一层无功能的容器，也不要给每个信息组各做一个面板。
- 多个面板并排时按功能重要性分配宽度，不要机械地 50/50。次要面板更窄。

### 主次信息

主信息得到更多空间。以文件列表为例，权重大小是：

文件名称 > 状态 / 修改时间 > 类型 / 大小 > 辅助信息

字段数量相同也不平均分列。次要 metadata 用 `caption`，并放在更窄的列里。

### 扫描效率

布局先服务快速扫描。用户应能直接认出：当前页面、当前选中对象、核心名称、当前状态、关键属性和可执行操作。

- 上下文里已经有的信息不要再重复显示。页面标题已经是项目名时，列表里不要再放一列项目名。
- 层级不清时调整列宽、顺序和对齐。不要靠加一段说明文字来补救。
- 选中行仍使用同一列网格，不另起缩进。

## Elevation & Depth

- 默认层级：`app-canvas` 上放 `surface` 面板，面板用 1px `hairline` 边框分隔，**不加阴影**。行与行、区块与区块之间用 `divider`，需要更明显的分隔时用 `divider-strong`。
- 阴影只用于浮在内容之上的元素：弹窗、抽屉、下拉菜单和提示条，统一使用 `0 12px 32px rgba(27, 30, 36, .16)`。
- 可点击卡片悬停时，边框改为 `hairline-strong`，可以加一层很浅的阴影，但不要位移或放大。
- 弹窗遮罩使用 `modal-overlay`（`overlay` 已包含 30% 不透明度）。

### 边框

Stitch 的组件 token 不支持边框属性，边框统一按下表设置，宽度都是 1px：

| 组件 | 边框颜色 |
| --- | --- |
| `panel`、`modal`、卡片、表格外框 | `hairline` |
| `button-secondary`、`button-small` | `control-border`（白底按钮放在白色面板上，必须有看得见的轮廓） |
| `text-input`、下拉框、复选框 | `control-border`，聚焦时改为 `focus-ring` |
| 可点击卡片悬停 | `hairline-strong` |
| `status-*` | 无边框 |
| `toast-success`、`toast-error`、`banner-warning` | 对应文字色的 20% 透明度 |
- 键盘焦点统一使用 `focus-indicator`：3px 的 `focus-ring` 外框，偏移 2px。鼠标点击不显示焦点框（使用 `:focus-visible`）。

## Shapes

- 标签和小元素用 `rounded.sm`–`md`，按钮和输入框用 `md`，面板、卡片和弹窗用 `xl`，状态标签用 `pill`。
- 同一层级的元素圆角保持一致，不要混用多种圆角。

## Components

- **按钮**：主要按钮 `button-primary` 每个视图最多一个；其他操作用 `button-secondary`（边框见 Elevation & Depth 中的边框表）；表格和卡片内的操作用 `button-small` 或文字链接；删除用 `button-danger-text`，放在操作组的最后。不可用的按钮用 `button-disabled`，并通过悬停提示说明原因。按钮文案用动词，不超过 4 个字，如“新建项目”“上传”“完成”。
- **返回按钮**：使用 16px 线性 `chevron-left` 图标配合简短文字，不使用文本箭头；悬停时只改变背景、边框和图标位置，保持方向明确。
- **输入框**：`text-input` 边框为 `control-border`；获得焦点时（`text-input-focused`）边框改为 `focus-ring`，并加一圈 3px 的 `primary-soft` 光晕。标签放在输入框上方。必填项在提交时校验，错误信息用 `danger` 显示在字段下方。
- **侧边导航**：`nav-item` 和 `nav-item-active`，待处理数量用 `status-pending` 的圆角数字徽标显示。
- **表格**：表头用 `table-header`，行用 `table-row`，可点击行悬停时用 `table-row-hover`。操作列固定在右侧。数字列右对齐，状态列居中。列宽、行高和横向利用率见 Layout。
- **状态标签**：`status-done`、`status-pending`、`status-na`，文字格式固定为“已准备”“待签字”“不适用”。
- **流程标识**：流程统一使用同一图标和主色，不按流程名称区分颜色。
- **进度条**：6px 高，轨道为 `status-na-soft`，填充为 `progress-fill`，旁边同时显示百分比数字。
- **弹窗**：`modal` 宽 640px，编辑流程和清单项时可以加宽到 820px。标题在左上，关闭按钮在右上，操作按钮在右下，取消在前、确认在后。
- **提示条**：`toast-success` 3 秒后自动消失；`toast-error` 一直显示，并带关闭按钮，直到用户关闭或进行下一次操作（已实现）。
- **横幅**：`banner-warning` 用于项目目录失效这类需要用户处理的问题，横幅内必须提供修复操作按钮（如“重新定位”）。
- **空状态**：图标、一句话说明、一个主要操作按钮，不写营销式文案。

## Interaction Patterns

标注“已实现”的是当前代码的行为，标注“规划”的是后续改造方向。新功能应遵循这里的规则。

- **即时反馈**（已实现）：保存后在当前位置显示“已保存”，全局操作结果用提示条告知。操作进行中，相关按钮禁用并显示“保存中…”。
- **弹窗键盘操作**（已实现）：打开弹窗时焦点移入弹窗，`Tab` 在弹窗内循环，`Esc` 关闭；有未保存修改时，关闭前需要确认。
- **弹窗初始焦点**（已实现）：打开弹窗时焦点直接落在第一个输入框上。
- **卡片键盘操作**（已实现）：项目和事项卡片可以用 `Tab` 聚焦，按 `Enter` 或空格打开。
- **不可逆操作确认**（已实现）：删除前的确认文字要说清楚会删除什么、保留什么，例如“项目文件夹和实际文件会保留”。
- **错误提示持久显示**（已实现）：见 Components 中的提示条。
- **状态点击切换**（已实现）：清单中的四个步骤为可点击的状态标签，点一下在“待完成”和“已完成”之间切换，“不适用”放进更多菜单。“准备”步骤没有可用附件时不可点击，悬停时提示“请先上传文件”。
- **侧边抽屉**（规划）：从项目页打开事项时，改为从右侧滑出抽屉（宽 720px），不离开项目页。
- **拖拽上传**（规划）：把文件拖到清单行上即可上传到该清单项；拖拽悬停时该行显示 `primary` 虚线边框。
- **全局搜索**（规划）：`Ctrl+K` 打开搜索面板，可以搜索项目、事项和文件，用方向键选择，按 `Enter` 跳转。
- **待处理分组**（规划）：待处理页支持按项目或负责人分组，并记住上次使用的筛选条件。

## Content & Copy

- 使用简体中文，语气直接。用“项目”“事项”“流程”“文件项”“附件”这几个固定名词，不要混用“模板配置”“任务”等说法。
- 标题说明“是什么”，按钮说明“做什么”，错误信息说明“怎么办”，例如“项目文件夹已失效，请先重新定位项目目录”。
- 不写欢迎语、口号或重复标题的说明文字，空状态不超过一句话。
- 日期格式：列表中写“9月23日”，详情中写“2026/9/23”。

## Do's and Don'ts

### Do

- 用 token 取值，不要在组件中硬编码颜色和字号。
- 状态同时用颜色和文字表达。
- 保持高信息密度，但每行只放一类信息。
- 布局间距只用 `spacing` token；相同层级、相同用途使用相同间距。
- 数据用表格或紧凑列表。工具栏默认单行；宽度不够时，搜索、筛选、排序作为一组换行。
- 失效、缺失这类问题要就地提示，并附上修复入口。

### Don't

- 不要使用小于 12px 的文字，也不要使用比 `ink-muted` 更浅的文字色；禁用状态不要靠调低透明度表达。
- 不要让类型色使用橙色或绿色，也不要用状态色做装饰。
- 不要给普通面板加阴影，也不要在悬停时移动或放大元素。
- 不要使用 Element Plus 默认的蓝色主题色 `#409eff`；使用 Element Plus 组件时，要覆盖成本文件的 token。
- 不要使用暗色主题、渐变背景或大面积品牌色块。
- 不要把标题、搜索、筛选各自占一整行，也不要为每条记录套一张卡片。宽度不够时按工具栏规则整组换行。
- 不要卡片套卡片，也不要用临时 margin 错开同一页的左边界。数据页不要用大于 `spacing.xxl` 的留白；空状态和整页只有一个主动作的稀疏页面可以例外。
- 不要把单行数据行加到 48px、56px 或 64px 来制造呼吸感。多行内容按内容增高，不要为了守住 40px 把文件名、错误信息或状态说明裁掉。

## Responsive Behavior

WorkPack 只运行在桌面端，需要适配的是窗口宽度，不是移动设备：

- 1180px 及以上：导航 240px，流程卡片三列，事项卡片两列。
- 1050–1180px：导航收窄到 216px，流程卡片两列，内容区左右内边距改为 `spacing.lg`。
- 表格超出宽度时横向滚动，第一列（文件名）和操作列保持可见。列宽仍按重要性分配，不改成平均分列。
- 窗口变窄、继续单行会导致控件压缩、截断或溢出时，搜索、筛选、排序作为一组换行，主要操作仍靠右。换行后高度由内容决定。不要拆成标题、搜索、筛选各占一行。
- 可点击区域至少 28×28px，主要按钮高度 36px。

## Agent Prompt Guide

- 强调色 `#3d5674`，背景 `#f4f5f7`，面板 `#fbfcfd`，边框 `#e4e6eb`，正文 `#1b1e24`，辅助文字 `#5c6570`。状态色仍与强调色分开。
- 状态：完成 `#1d6f4c` / `#e8f5ed`，待处理 `#9a5412` / `#fff2e5`，不适用 `#5f6a64` / `#eef1ef`，错误 `#b3261e` / `#fdecea`。
- 示例提示词：“按照 DESIGN.md 把事项详情中的清单状态下拉框改为 `status-done` / `status-pending` 样式的可点击状态标签，遵循 Interaction Patterns 中的状态点击切换规则。”

## Iteration Guide

1. 每次只改一个组件，并用 `components` 里的 token 名称指代它。
2. 修改后运行 `npx @google/design.md lint DESIGN.md` 检查格式。
3. 新增组件变体时，单独添加一个 token，不要修改已有 token 的含义。
4. 规划中的交互实现后，把 Interaction Patterns 里对应的“规划”改为“已实现”。

## Known Gaps

上述已按规范落地的部分：可读文字至少 12px；辅助文字、焦点框和控件边框符合对比度要求；类型色与状态色分开；普通面板不加阴影、悬停不位移；清单状态点击只在待完成与已完成之间切换，不适用需用更多菜单；错误提示一直显示直到关闭或下一次操作；弹窗打开时焦点落在第一个输入框。`src/renderer/src/style.css` 顶部的 CSS 变量与本文件 token 一致，选择器不再靠文末补丁覆盖。

仍待后续处理：

- 禁用按钮仍把文字改成 `ink-muted`，规范要求用 `surface-subtle` 背景而不是浅字色。
- `.brand strong` 仍有负字距。
- 弹窗宽度 650px，规范为 640px。
- 仍全局引入 Element Plus 默认样式，有主题蓝泄漏风险。
- 工作台、项目列表、待处理和文件清单已按本文件的中性色与 Layout 落地。项目和事项卡片仍是概览组件。文件清单行含附件和状态控件，高度随内容增高。
- 其余页面和弹窗里仍有非 4 倍数间距。单行 `table-row` 的组件 token 仍是 12px 内边距，约 45px，没有用固定高度或裁切去压到 32–40px。

以下内容受 Stitch 格式限制，只写在正文里，接入 CSS 变量时需要从正文取值：

- 边框颜色（见 Elevation & Depth 中的边框表）。
- 浮层阴影 `0 12px 32px rgba(27, 30, 36, .16)`。
