# WorkPack

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/workpack-logo-on-light.png">
  <img alt="WorkPack" src="src/renderer/src/assets/workpack-logo.png" width="260" height="72">
</picture>

WorkPack 是一个面向 Windows 的本地桌面应用，按项目整理业务文件，并跟踪每份文件在具体事项中的待办。

## 使用方式

1. 在**文件库**添加文件模板，填写用途，并按需放入分类；可以从电脑导入模板原件。
2. 新建项目。应用会在设置的项目存储位置下创建同名文件夹。
3. 在项目中创建事项，勾选需要的文件库模板。每份模板会在事项中生成独立文件项，模板原件若存在，会复制到项目目录。
4. 每份文件默认有“准备文件”待办，也可以自行添加其他待办。完成后勾选；准备文件需要先有可用文件。

在工作空间菜单中可以打开**设置 → 存储**，分别选择项目、模板和工作空间数据的位置。三个位置都有默认值，无需首次使用时强制选择。更改模板或工作空间位置时，应用会复制已有数据并在成功后切换，原目录保留。

工作台、项目和事项显示待办完成率；待处理页列出事项文件，支持查看全部、未完成和已完成文件，可按项目、客户、经办人和完成状态筛选，也可按项目或经办人分组。

## 数据存放

| 数据 | 默认位置 |
| --- | --- |
| 工作空间数据库 `workpack-v3.sqlite` 和设置指针 | Electron 应用数据目录，Windows 下通常为 `%APPDATA%\WorkPack` |
| 文件库的模板原件 | 应用数据目录下的 `templates/` |
| 新建项目的目录、工作副本和附件 | 文档目录下的 `WorkPack/项目/<项目名称>/` |

数据库、模板和项目目录均可在设置中分别修改。旧版 `workpack.sqlite` 不会自动迁移或删除；新版从空业务库开始。更改工作空间数据库位置时，应用会从当前连接生成一致的单文件副本。项目目录被移动后，可在项目页重新定位。

项目文件夹包含 `.workpack-project.json` 标记和 `事项/<日期>_<事项ID>/<文件项ID>/` 下的工作副本。删除项目或附件记录会保留实际文件；删除事项会删除该事项目录及其中的工作副本和附件。

## 技术栈

- 界面：Vue 3、TypeScript、自有组件与设计 token
- 桌面：Electron、electron-vite
- 数据：SQLite（better-sqlite3），输入校验使用 zod
- 打包：electron-builder（Windows NSIS 安装包）
- 测试：Vitest（服务层）、Python `unittest`（文档与构建检查）、Playwright（Electron 端到端）

界面进程不能直接访问文件系统和数据库。所有磁盘和数据库操作都在主进程中执行，预加载脚本只暴露固定的接口，窗口启用了上下文隔离和沙箱。

## 目录结构

```text
src/
├── main/index.ts         # Electron 主进程：窗口、IPC 接口、系统对话框
├── main/service.ts       # 业务核心：SQLite 读写、文件复制、待办规则
├── main/storage.ts       # 存储位置与数据复制
├── preload/index.ts      # 向界面暴露 window.workpack 接口
├── renderer/             # Vue 界面（App.vue 与事项清单组件）
└── shared/model.ts       # 共享类型、进度与缺口计算
tests/                    # Vitest 服务测试与 Python 检查
demo/                     # 早期静态网页原型，可直接用浏览器打开，数据不持久化
scripts/test.cjs          # 用 Electron 自带的 Node 运行 Vitest（匹配 better-sqlite3 原生模块）
scripts/installer-smoke.ps1  # 在 Windows 上安装、启动、卸载安装包的检查脚本
build/                    # 安装包资源：程序图标 icon.ico 和安装向导脚本 installer.nsh
docs/assets/              # 深色主题下垫了浅底的侧栏标志、界面截图，以及可作仓库社交预览的 social-preview.png
DESIGN.md                 # 界面设计规范（设计 token 与交互规则），修改界面前先阅读
产品设计文档_MVP.md
技术方案_MVP.md
```

## 开发

需要 Node.js 和 npm。依赖版本由 `package-lock.json` 锁定。

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

打包必须在 Windows 上进行。在 Linux 或 macOS 上交叉打包时，安装包里会带上当前系统版本的 better-sqlite3 原生模块，装到 Windows 上无法打开数据库。

## 安装与卸载

`WorkPack-<版本>-Setup.exe` 是中文安装向导，依次可以：

- 选择只为当前用户安装（默认，不需要管理员权限），或为这台电脑的所有用户安装；
- 选择安装目录；
- 在“附加任务”页决定是否创建桌面快捷方式（默认勾选）。开始菜单快捷方式总会创建。

安装后可以在 Windows 设置的“应用”中，或运行安装目录里的 `Uninstall WorkPack.exe` 卸载。卸载向导可选“删除工作空间记录”，默认不勾选；勾选后只删除默认系统目录下的工作空间数据库及设置，不删除项目文件、模板原件或自选位置的数据。静默卸载不清理工作空间数据。

批量部署时可以静默安装：`WorkPack-<版本>-Setup.exe /S /currentuser /D=C:\路径\WorkPack`。`/D=` 必须放在最后，路径不加引号；加上 `--no-desktop-shortcut` 不创建桌面快捷方式。静默卸载：`"Uninstall WorkPack.exe" /S /currentuser`。

安装程序和程序图标的资源在 `build/`：`build/icon.ico` 是程序图标，`build/installer.nsh` 定义了安装附加任务和卸载数据选项。

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

## 持续集成

推送到 `main` 以及所有拉取请求都会运行 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)，包含两个任务，都使用 Node.js 26（当前 Active LTS）：

- **Ubuntu**：先安装编译原生模块所需的工具链（C++ 编译器、Python 3、`libatomic1`），再依次执行 `npm ci`、`npm run typecheck` 和 `npm test`。`npm ci` 会触发 `postinstall`，为当前 Electron 版本重新编译 better-sqlite3。
- **Windows**：执行 `npm ci`、`npm run typecheck`、`npm test` 和 `npm run test:e2e`，再用 `npm run dist` 打出安装包，然后运行 [`scripts/installer-smoke.ps1`](scripts/installer-smoke.ps1)：静默安装到带空格和中文的目录，检查快捷方式、卸载程序和“应用和功能”登记，用 [`tests/installed-app.spec.ts`](tests/installed-app.spec.ts) 启动已安装的程序建项目、重启并确认数据还在，最后静默卸载并确认清理干净。安装包会作为构建产物 `WorkPack-Setup` 上传，可以在该次运行的页面下载试装。

`tests/installed-app.spec.ts` 只在设置了 `WORKPACK_INSTALLED_EXE` 时运行，本地执行 `npm run test:e2e` 会跳过它。

## 发布

发布由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 完成：

1. 修改 `package.json` 里的 `version`（例如 `0.1.0`），合入 `main`。
2. 在该提交上打同版本的标签并推送：`git tag v0.1.0 && git push origin v0.1.0`。

流水线会检查标签和 `package.json` 版本一致，在 Windows 上测试、打包并跑一遍安装包检查，全部通过后创建 GitHub Release，附上 `WorkPack-<版本>-Setup.exe`。安装包没有代码签名，首次运行时 Windows SmartScreen 可能提示“已保护你的电脑”，需要点“更多信息”再点“仍要运行”。

## 首版范围

首版不包含账号体系、多人协作、跨电脑同步、云端存储、电子签章或审批流。详细设计见 [产品设计文档](产品设计文档_MVP.md) 和 [技术方案](技术方案_MVP.md)。

## 协作约定

见 [AGENT.md](AGENT.md)：每次改动后都要提交对应的 git commit，并编写或更新测试，确保所有测试通过后再交付。涉及界面、样式或交互的修改，要先阅读并遵循 [DESIGN.md](DESIGN.md)。
