# 开发与发布

## 本地运行

项目使用 Node.js 26 和 npm，依赖版本由 `package-lock.json` 锁定。`npm ci` 会触发 `postinstall`，为 Electron 编译 better-sqlite3 原生模块；本机需要能运行 node-gyp 的 Python 和 C++ 构建环境。

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm start
```

Vue 3 与 TypeScript 负责界面，Electron 主进程通过固定 IPC 接口操作 SQLite 和文件。窗口启用上下文隔离、沙箱及权限限制。

| 位置 | 内容 |
| --- | --- |
| `src/main/index.ts` | 窗口、IPC、系统对话框 |
| `src/main/service.ts` | SQLite、文件副本及待办规则 |
| `src/main/storage.ts` | 存储位置及数据迁移 |
| `src/preload/index.ts` | 界面可调用的接口 |
| `src/renderer` | Vue 界面及公共资源 |
| `src/shared/model.ts` | 共享类型、进度及筛选计算 |
| `tests` | 服务测试、静态检查及 Electron 回归 |
| `build` | ICO 图标及安装向导脚本 |

界面修改遵循 [DESIGN.md](../DESIGN.md)，提交约定见 [AGENT.md](../AGENT.md)。

## 测试

```bash
npm test
npm run test:e2e
```

`npm test` 依次运行 Vitest 和 Python `unittest`，覆盖服务行为、文档链接、设计 token、构建和安装配置。测试脚本会寻找 Python 3.9 或更高版本。单独运行 Python 检查：

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

`npm run test:e2e` 先构建，再用 Playwright 启动真实 Electron 窗口。`playwright.config.ts` 将界面测试限定为 `*.spec.ts`，服务测试使用 `*.test.ts`。

`WORKPACK_TEST_DATA=<目录>` 指定隔离数据目录。测试中的项目和原件也放入临时目录，结束后清理。`tests/installed-app.spec.ts` 在设置 `WORKPACK_INSTALLED_EXE` 时验证实际程序的建库、中文路径和重启数据保留。

## 复现 README 截图

```bash
npm run build
node scripts/capture-readme.cjs
```

脚本通过应用接口创建 4 个演示项目、4 个事项、5 个模板和 9 个文件项，导入有效 DOCX 临时文件，在实际窗口中保存工作台、项目、事项抽屉、待处理和文件库截图。

图片覆盖到 `docs/assets`。示例数据库、项目目录和临时原件在 `finally` 中清理；清理前验证路径属于 `Agent/Codex/artifacts` 下的专用临时目录。日常工作空间的数据继续保留。

## 品牌资源

```bash
npm run brand:sync
```

程序、安装和卸载图标共用灰色 `build/icon.ico`，包含 16px 至 256px 七种尺寸。运行窗口使用 `src/renderer/public/icon.png`，README 品牌图和 `docs/assets/social-preview.png` 使用同一灰色风格。

## Windows 打包

```bash
npm run pack
npm run dist
```

`pack` 在 `release` 下生成程序目录，`dist` 生成 `WorkPack-<版本>-Setup.exe`。在 Windows 上构建，以保证 better-sqlite3 原生模块与目标系统一致。

安装向导支持安装范围、目录和桌面快捷方式选项。自动部署示例：

```text
WorkPack-<版本>-Setup.exe /S /currentuser /D=C:\Apps\WorkPack
```

`/D=` 放在最后，路径不加引号；`--no-desktop-shortcut` 跳过桌面快捷方式。静默卸载使用 `"Uninstall WorkPack.exe" /S /currentuser`，保留工作空间数据。

## CI 与发布

[CI 工作流](../.github/workflows/ci.yml) 在 PR 和 main 推送时运行。Linux 检查类型与单元测试；Windows 运行界面回归、构建安装包，再执行 `scripts/installer-smoke.ps1` 完成安装、启动、重启及卸载检查。运行截图保存为 `WorkPack-UI-evidence`，安装包保存为 `WorkPack-Setup`。

[发布工作流](../.github/workflows/release.yml) 由版本标签触发：

1. 同步更新 `package.json` 和 `package-lock.json` 的版本，验证后合入 main。
2. 在对应提交上打标签并推送，例如：

```bash
git tag v0.3.1
git push origin v0.3.1
```

流水线核对标签与包版本，完成 Windows 测试、构建和安装检查后创建 GitHub Release，上传安装包。发布记录使用实际完成的功能和验证结果。
