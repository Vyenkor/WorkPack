# UI 改版验收记录

2026-11-05 · [PR #30](https://github.com/Vyenkor/WorkPack/pull/30)

## 完成内容

工作台、项目列表、项目详情、待处理、文件库、存储设置、事项抽屉及六类表单已按暖色精简设计完成。标题采用本机宋体，保留统一圆角、细线、陶土色操作和必要错误信息；不恢复被删除的副标题。实际截图保存在 [evidence/final](evidence/final/01-home.png)。

- 菜单使用 `relatedTarget` 判断焦点去向，修复删除、导入点击丢失；长菜单滚动和视口边缘定位可用，Esc、编辑后以及触发按钮滚出视口时返回原控件（[补充回归](evidence/final/menu-scroll.txt)）。
- 路径复制通过经 IPC 来源校验和长度校验的桌面写入接口完成，没有开放浏览器剪贴板权限或读取接口。
- 文件完成筛选在共享模型中直接检查该文件的待办及附件，不再绕过项目完成率逻辑。删除失效的项目进度缓存函数。
- 附件重定位或删除后恢复抽屉焦点；保存中锁定表单、阻止重复提交和关闭，失败后保留用户输入。
- 抽屉整理为全宽操作区、名称、日期和经办人；移除隐藏旧节点和附件重复计数。待办使用统一复选框。长标题、名称、路径和最小窗口已检查。
- 工作台入口改为真实动作“打开文件库”。工作空间菜单仅介绍本次更新，支持键盘关闭和恢复焦点。
- 删除未使用的 Element Plus，更新 README、产品与技术文档以及 docs 中旧截图。

## 验证

| 检查 | 结果 |
| --- | --- |
| 类型检查、生产构建 | 通过 |
| Vitest | 21 项通过 |
| Python | 76 项通过 |
| Electron / Playwright | 11 项通过；安装后应用测试在本机跳过，交由 Windows CI 执行 |
| 三种窗口 | 1600×1000、1280×800、1050×700；全部主页面、抽屉、六类表单无横向页面溢出 |
| npm audit | 0 漏洞（包括开发依赖） |
| Windows 安装包、安装、启动、卸载 | 已通过；[构建及冒烟验证](https://github.com/Vyenkor/WorkPack/actions/runs/41960523572)，最新提交状态同时见 PR 检查 |

原始输出：[构建](evidence/final/build.txt)、[单元与文档测试](evidence/final/unit.txt)、[端到端](evidence/final/e2e.txt)、[依赖审计](evidence/final/audit.json)。上层 evidence 中的 checkpoint 文件是暂停时的历史结果，不能作为当前验收结果。

端到端还覆盖：分类重命名和删除、导入导出、原生选择器取消、失效目录和附件、重定位、已完成及未完成筛选、持久化、删除取消、未保存编辑确认、长文本、恶意 HTML 按纯文本显示、旧数据多个模板附件、菜单滚动与键盘、保存失败重试及重复提交。

## 页面截图

| 页面 | 1600×1000 | 1280×800 | 1050×700 |
| --- | --- | --- | --- |
| 工作台 | [查看](evidence/final/1600-工作台.png) | [查看](evidence/final/1280-工作台.png) | [查看](evidence/final/1050-工作台.png) |
| 项目列表 | [查看](evidence/final/1600-项目.png) | [查看](evidence/final/1280-项目.png) | [查看](evidence/final/1050-项目.png) |
| 项目详情 | [查看](evidence/final/1600-project.png) | [查看](evidence/final/1280-project.png) | [查看](evidence/final/1050-project.png) |
| 待处理 | [查看](evidence/final/1600-待处理.png) | [查看](evidence/final/1280-待处理.png) | [查看](evidence/final/1050-待处理.png) |
| 文件库 | [查看](evidence/final/1600-文件库.png) | [查看](evidence/final/1280-文件库.png) | [查看](evidence/final/1050-文件库.png) |
| 设置 | [查看](evidence/final/1600-settings.png) | [查看](evidence/final/1280-settings.png) | [查看](evidence/final/1050-settings.png) |
| 抽屉 | [查看](evidence/final/1600-drawer.png) | [查看](evidence/final/1280-drawer.png) | [查看](evidence/final/1050-drawer.png) |

六类弹窗截图以 `1600-modal-*`、`1280-modal-*`、`1050-modal-*` 命名。另有 [首次工作台](evidence/final/01-home.png)、[模板操作菜单](evidence/final/library-menu.png)、[完成后的文件清单](evidence/final/drawer-completed.png)、[长文本抽屉](evidence/final/long-drawer.png)、[长菜单](evidence/final/legacy-scroll-menu.png)。

截图来自实际 Electron 运行，使用隔离测试数据。另存 Windows CI 的 [工作台](evidence/final/windows-home.png)、[文件清单](evidence/final/windows-drawer.png)、[最小窗口表单](evidence/final/windows-minimum-project-modal.png)，完整 Windows 截图随 PR 的 WorkPack-UI-evidence 产物保存。设计图保留在 UI精简版；日期、路径、系统字体和原生日期输入显示会因平台而异。装饰插图采用带纹理的本地 SVG，不声称与生成参考图逐像素相同。

## 自审与依赖修复

- 检查运行源码及样式：没有退休流程控件、旧状态菜单、隐藏的抽屉标题节点、Element Plus 默认样式或失效引用。早期静态 demo 和暂停时的交接记录保留为历史资料，不进入安装包。
- `GHSA-g3hv-75wg-m249` 涉及构建链的 minimatch 9/10；覆盖为 11.0.4。旧 glob/asar 使用的 minimatch 3/5 保持兼容，未全局强行替换。新增真实打包筛选及 ASAR 中文文件写入/读取测试。
- 运行时继续保持 contextIsolation、sandbox、webSecurity，禁用 Node 集成、新窗口和任意导航；IPC 校验主窗口、主 frame 及页面来源。Vue 模板按文本渲染用户内容。
- `build.files` 排除 Agent 设计稿、测试证据及 demo；打包依赖测试验证白名单和排除规则。

本次继续使用 PR #30；完成检查后转为可审查状态，不自动合并或发布正式版本。
