# SCC 代码统计（SCC Code Counter）

基于 [SCC（Succinct Code Counter）](https://github.com/boyter/scc) 与 [CLOC（Count Lines of Code）](https://github.com/AlDanial/cloc) 的跨平台代码统计桌面应用，集**多目录统计、图表分析、生产力评估与报告导出**于一体，支持 **SCC / CLOC 双统计引擎一键切换**。

技术栈：**electron-egg（ee-core）+ Vue 3 + Vite + Naive UI + ECharts**，包管理 **pnpm**。

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 代码统计 | **SCC / CLOC 引擎切换**（页面右上角，选择持久化）；多目录选择（单选/批量）、排除目录 / 排除扩展名 / 仅包含扩展名过滤、`--by-file` 等选项、实时统计与取消、摘要卡片 / 语言统计 / 目录汇总 / 文件明细表格、导入 SCC 导出的 JSON / CSV 统计文件 |
| 目录管理 | 常用目录的增删改与备注、默认排除目录与扩展名规则维护、一键「快速统计」（应用默认规则后跳转统计分析）、「填入统计」回填代码统计页 |
| 统计分析 | ECharts 图表：语言分布（环形图）、语言规模（代码/注释双柱）、代码构成（代码/注释/空白堆叠柱）、文件排行 Top20、复杂度排行 Top15（CLOC 结果自动隐藏）、多目录对比分组柱状图 |
| 生产力估算 | 参数化估算模型：编码生产率、人月折算人日、人力成本单价、团队人数、每日工时、测试用例密度、缺陷密度、设计编码占比；输出编码工作量/工时、总工作量、工期、测试用例数、缺陷数、人力成本；代码行数可手动覆盖；参数自动持久化 |
| 数据导出 | Excel 工作簿（摘要/语言统计/目录汇总/文件明细/生产力估算 多工作表）、自包含 HTML 报告（内联样式、离线可开、可打印为 PDF）、JSON 完整数据（可再次导入本应用并保留引擎标记）；导出前可预览并勾选包含内容 |
| 设置 | 默认引擎选择；SCC / CLOC 双引擎各自的内置/自定义路径配置与可用性校验（版本号、生效路径）；生产力估算默认参数；清除统计历史 / 重置全部配置 |

所有统计数据与配置仅保存在本机（用户数据目录），不上传任何远程服务器。

## 双引擎说明

应用内置两套统计引擎，结果归一化为同一结构（语言分布 / 文件明细 / 多目录汇总），下游的分析图表、生产力估算与导出流程完全一致：

| 能力 | SCC 4.1.0 | CLOC 2.10 |
| --- | --- | --- |
| 语言分布 / 文件明细 / 多目录汇总 | ✅ | ✅ |
| 圈复杂度、字节数、ULOC | ✅ | ❌（相关图表与卡片自动隐藏） |
| `.gitignore` / `.ignore` 规则、去重开关 | ✅ | ❌（选项自动禁用；CLOC 默认不应用 gitignore） |
| Windows 运行方式 | 内置 `scc.exe` | 内置官方独立 `cloc.exe`（自带 Perl 运行时） |
| Linux/macOS 运行方式 | 内置 `scc` | 内置官方 `cloc.pl` + **系统 Perl**（需已安装 Perl，macOS/多数 Linux 自带） |
| 已知限制 | — | Windows 下 cloc 受系统代码页影响，**可能漏计非 ASCII（中文）文件名的文件**，此类项目建议使用 SCC |

引擎内置文件位于 `build/extraResources/`：`scc/{windows-x64,linux-x64,darwin-x64,darwin-arm64}/` 与 `cloc/{windows-x64/cloc.exe, cloc.pl}`（来源：两个项目的官方 GitHub Releases；cloc 采用 GPL-2.0+ 许可证，随应用分发时请一并遵循）。

CLOC 的调用等价命令（默认参数）：

```bash
cloc --csv --by-file --exclude-dir=.git,.hg,.svn,node_modules,... --exclude-ext=exe,dll --include-ext=go,py <目录1> <目录2> ...
```

## 目录结构

```
scc-front/
├── electron/                  # 主进程（ee-core 规范）
│   ├── main.ts                # 入口（含 --selftest 自检通道）
│   ├── selftest.ts            # 主进程服务链路自检
│   ├── config/                # default / local / prod 配置
│   ├── preload/               # lifecycle / bridge / preload
│   ├── controller/            # common / codestats（双引擎分发）/ storage / exporter
│   ├── service/               # scc / cloc（双引擎）/ storage（JSON 持久化）/ import / export / common（共享工具）
│   └── types.ts               # 类型与默认配置（与前端 defaults.js 保持一致）
├── frontend/                  # 渲染进程（Vue 3 + Vite + Naive UI + ECharts）
│   └── src/
│       ├── api/               # IPC 频道定义 + invoke 封装（参数净化）+ mock（浏览器演示模式）
│       ├── assets/            # 打包资源（logo、微信打赏二维码）
│       ├── store/             # 全局响应式状态（统计结果、配置、草稿、引擎状态）
│       ├── components/        # 摘要卡片 / 语言表格 / 估算参数表单 / 图标
│       └── views/             # stats / dirs / analysis / estimate / export / settings / about
├── cmd/                       # ee-bin 与 electron-builder 配置（win / mac / linux）
├── build/
│   ├── extraResources/
│   │   ├── scc/               # 内置 SCC 可执行文件（windows-x64 / linux-x64 / darwin-x64 / darwin-arm64）
│   │   └── cloc/              # 内置 CLOC（windows-x64/cloc.exe + cloc.pl 脚本）
│   ├── icons/                 # 应用图标（icon.ico / icon.png / icon-mac.png）
│   └── selftest-sample/       # 自检样例代码目录
└── public/                    # dist（前端产物）与 electron（主进程产物）构建输出
```

## 环境要求

- Node.js ≥ 18（推荐 20/22）
- pnpm ≥ 9（本仓库使用 pnpm workspace：根目录 + frontend）

## 快速开始

```bash
# 1. 安装依赖（根目录与 frontend 一次完成）
pnpm install

# 2. 开发模式（并行启动 vite 前端与 electron，前端改动热更新）
pnpm dev

# 3. 仅构建产物
pnpm build            # = 构建前端 + 移动到 public/dist + 构建主进程

# 4. 预发布运行（加载 public/dist）
pnpm start

# 5. 打包安装程序（Windows nsis / macOS / linux deb）
pnpm build-w          # Windows x64
pnpm build-m          # macOS arm64（build-m-x86 为 x86_64）
pnpm build-l          # Linux x64
```

> 国内网络若 electron 二进制下载超时，本仓库 `.npmrc` 已配置 npmmirror 镜像，通常无需额外处理。

**打包产物**（Windows 本机打包示例）：

- `out/SCCCodeCounter-win-<版本>-x64.exe` — NSIS 安装程序（含内置双引擎），可直接分发
- `out/win-unpacked/` — 免安装绿色版，其中 `SCCCodeCounter.exe` 可直接运行
- `out/*.blockmap` 与 `out/latest.yml` — 增量更新与自动更新元信息
- Linux deb 包需在 Linux 环境构建（本机无法产出），由 CI 的 ubuntu 任务自动完成


## 浏览器演示模式

```bash
cd frontend && pnpm dev   # 打开 http://localhost:8080
```
脱离 Electron 直接在浏览器访问时，应用自动进入**演示模式**（顶栏有黄色标识），以内置演示数据驱动全部界面，便于前端开发与预览；导入与真实导出在该模式下被模拟。

## 内置 SCC 说明

- 应用默认使用**内置 SCC**（`build/extraResources/scc/<平台>/scc`），已随仓库提供 Windows x64、Linux x64、macOS x64 / arm64 四个平台的可执行文件（来源：[scc v4.1.0 Releases](https://github.com/boyter/scc/releases/tag/v4.1.0)）。
- 需要自定义时，在「设置」页切换为自定义路径（可指向可执行文件或其所在目录），保存后自动校验并显示版本号。
- 若当前平台未检测到内置 SCC，应用会在设置页给出明确提示。

## SCC 调用方式

应用内执行的等价命令（默认参数）：

```bash
scc --by-file --format json --exclude-dir .git,.hg,.svn,node_modules,dist,... <目录1> <目录2> ...
```

- 多目录一次调用完成；嵌套/重复目录会自动去重并提示。
- 结果解析为统一结构：`summary`（总汇总）、`languages`（语言维度）、`files`（文件维度，需启用 --by-file）、`rootDirs`（多目录时按选中目录汇总）。
- 最近一次成功结果持久化为 `lastResult`，重启应用自动恢复展示。

## 生产力估算模型

```
编码工作量(人日) = 有效代码行数 ÷ 编码生产率
编码工时(小时)   = 编码工作量 × 每日工时
总工作量(人日)   = 编码工作量 ÷ 设计编码占比
总工作量(人月)   = 总工作量 ÷ 人月折算人日
项目工期(月)     = 总工作量 ÷ 团队人数 ÷ 人月折算人日
测试用例数(个)   = 代码行数 ÷ 1000 × 测试用例密度
预计缺陷数(个)   = 代码行数 ÷ 1000 × 缺陷密度
预估人力成本(元) = 总工作量(人月) × 人力成本单价
```

默认参数：编码生产率 300 行/人日、人月 21.75 人日、人力成本 20000 元/人月、团队 5 人、每日 8 小时、测试用例密度 10 个/千行、缺陷密度 5 个/千行、设计编码占比 40%。均为经验值，可在界面中手工调整并自动保存。

## 数据与配置存储位置

- 配置与统计历史：`<用户数据目录>/storage/scc-config.json`（Windows 为 `%APPDATA%/scc-code-counter/storage/`）
- 运行日志：`~/.scc-code-counter/logs/`（开发模式下为项目 `./logs/`）

## 常见问题

- **提示「SCC 未就绪」**：进入设置页校验；自定义路径需指向可执行文件（或其所在目录），Windows 下为 `scc.exe`。
- **提示「CLOC 未就绪」**：Windows 使用内置独立 `cloc.exe` 无需安装；Linux/macOS 使用内置 `cloc.pl` 时需系统已安装 Perl（macOS 与多数 Linux 发行版自带），缺失时可在设置页自定义指向已安装的 cloc。
- **CLOC 结果缺少复杂度/字节图表**：CLOC 不提供这些指标，属预期行为；需要圈复杂度时切换回 SCC 引擎。
- **CLOC 在 Windows 漏计部分文件**：cloc.exe 受系统代码页影响，非 ASCII（中文）文件名的文件可能不被统计；此类项目建议使用 SCC 引擎。
- **打包后图标/资源缺失**：确认 `build/icons` 与 `build/extraResources` 存在（`node build/gen-icons.js` 可重新生成图标）。
- **大仓库统计慢**：默认 10 分钟超时，可先关闭「文件明细 (--by-file)」（文件排行/目录对比将不可用）；CLOC（Perl 实现）明显慢于 SCC，大仓库优先 SCC。
