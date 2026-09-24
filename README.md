# WorkPack

WorkPack 是一个面向 Windows 的本地桌面应用，用于按项目整理发货、收货、培训等业务文件，并跟踪每份文件的**准备、填写、签字、归档**状态。

它主要解决两个问题：每个业务事项应该有哪些文件，以及哪些文件还没有完成。

## 核心概念

```text
项目 → 多个业务事项 → 每个事项一份独立文件清单 → 清单项的附件
```

| 概念 | 说明 |
| --- | --- |
| 项目 | 一个客户项目，包含客户信息、负责人、项目文件夹和适用流程 |
| 流程 | 可复用的文件清单规则和空白模板文件，名称由用户定义 |
| 业务事项 | 项目中的一次具体活动，例如“第一批控制柜发货”，创建时选择流程并复制规则作为清单快照 |
| 清单项 | 事项需要完成的一份文件，逐项记录准备、填写、签字、归档四个步骤的状态 |

## 主要功能

- **项目管理**：新建项目时选择上级文件夹，自动创建同名项目目录，并把所选流程的模板文件复制进去；项目目录被移动后可以重新定位。
- **流程管理**：编辑文件项及其需要的步骤，导入、导出空白模板文件。修改流程不影响已创建的事项。
- **事项与清单**：按流程生成清单；名称与文件项匹配（或在流程中手动指定）的模板文件会自动复制为工作副本。每一步可标记为待完成、已完成或不适用，不适用的步骤不计入完成率。
- **附件归集**：附件会复制到项目目录，来源文件保持不变。重名文件自动改名，不会覆盖。文件被外部移动或删除时显示“附件失效”，可以重新定位或移除记录。
- **进度与待处理**：工作台、项目和事项都会显示完成率；“待处理”页汇总未上传、待填写、待签字、待归档的文件，支持筛选和搜索。

“准备”步骤必须有可用附件才能标为已完成；删除附件或附件失效时，该步骤会自动回到待完成。

## 数据存放

| 数据 | 位置 |
| --- | --- |
| SQLite 数据库 `workpack.sqlite` | Electron 应用数据目录（`userData`），Windows 下通常为 `%APPDATA%\workpack` |
| 流程的模板原件 | 应用数据目录下的 `templates/` |
| 项目文件和附件 | 用户选择的项目文件夹 |

项目文件夹结构：

```text
<项目名称>/
├── .workpack-project.json        # 项目标记，用于识别和重新定位项目，请勿删除
├── 模板文件/<流程目录>/            # 创建项目时复制的模板文件
└── <流程目录>/<日期>_<事项ID>/<清单项ID>/  # 事项的工作副本和附件
```

每台电脑的数据相互独立。数据库和项目文件夹是分开存放的，备份或迁移时两部分都要带上。不要把数据库放在 NAS 或共享目录中让多台电脑同时写入。

在应用中删除项目、事项或附件，只会删除数据库记录，项目文件夹和实际文件会保留。

## 技术栈

- 界面：Vue 3、TypeScript、Element Plus
- 桌面：Electron、electron-vite
- 数据：SQLite（better-sqlite3），输入校验使用 zod
- 打包：electron-builder（Windows NSIS 安装包）
- 测试：Vitest（服务层）、Python `unittest`（文档和界面文案检查）

界面进程不能直接访问文件系统和数据库。所有磁盘和数据库操作都在主进程中执行，预加载脚本只暴露固定的接口，窗口启用了上下文隔离和沙箱。

## 目录结构

```text
src/
├── main/index.ts         # Electron 主进程：窗口、IPC 接口、系统对话框
├── main/service.ts       # 业务核心：SQLite 读写、文件复制、状态规则
├── preload/index.ts      # 向界面暴露 window.workpack 接口
├── renderer/             # Vue 界面（App.vue 与清单、规则编辑组件）
└── shared/model.ts       # 共享类型、进度与缺口计算
tests/                    # Vitest 服务测试与 Python 检查
demo/                     # 早期静态网页原型，可直接用浏览器打开，数据不持久化
scripts/test.cjs          # 用 Electron 自带的 Node 运行 Vitest（匹配 better-sqlite3 原生模块）
DESIGN.md                 # 界面设计规范（设计 token 与交互规则），修改界面前先阅读
产品设计文档_MVP.md
技术方案_MVP.md
```

## 开发

需要 Node.js 和 npm。仓库同时保留了 `package-lock.json` 和 `pnpm-lock.yaml`。

```bash
npm ci              # 安装依赖；postinstall 会为 Electron 重新编译 better-sqlite3
npm run dev         # 开发模式启动
npm run typecheck   # 类型检查
npm run build       # 类型检查并构建到 out/
npm start           # 预览构建结果
```

打包 Windows 程序：

```bash
npm run pack        # 生成免安装目录到 release/
npm run dist        # 生成 NSIS 安装包 WorkPack-<版本>-Setup.exe
```

设置环境变量 `WORKPACK_TEST_DATA=<目录>` 可以让应用使用独立的数据目录，避免影响日常数据。

## 测试

```bash
npm test
```

`npm test` 会依次运行 Vitest 服务层测试和 `tests/test_*.py` 中的 Python 检查（文档、Demo、界面文案和 `DESIGN.md`），因此需要安装 Python 3.9 或更高版本（脚本会依次尝试 `python3`、`python`、`py -3`，并实际检查版本号，不会误用 Python 2）。只运行 Python 检查可以用：

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```

服务层测试使用临时目录和临时数据库，不会触碰真实数据。修改 `DESIGN.md` 后，还可以运行 `npx @google/design.md lint DESIGN.md` 检查格式。

`npm run test:e2e` 会先构建，再用 Playwright 运行 `tests` 下的 `*.spec.ts`。配置在 `playwright.config.ts`，不会加载 Vitest 的 `*.test.ts`。

## 首版范围

首版不包含账号体系、多人协作、跨电脑同步、云端存储、电子签章、审批流，也不会自动识别文件是否已填写或签字，这些状态都需要手动更新。详细设计见 [产品设计文档](产品设计文档_MVP.md) 和 [技术方案](技术方案_MVP.md)。

## 协作约定

见 [AGENT.md](AGENT.md)：每次改动后都要提交对应的 git commit，并编写或更新测试，确保所有测试通过后再交付。涉及界面、样式或交互的修改，要先阅读并遵循 [DESIGN.md](DESIGN.md)。
