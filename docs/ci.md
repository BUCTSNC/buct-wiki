# CI：发布与 PR 预览

正式站与两个仓库的 PR 预览均由 **GitHub Actions 构建、Wrangler 推送到 Cloudflare Workers**，共用已有 Worker `buct-wiki`。Cloudflare 不拉取代码或执行构建。

| 配置 | 用途 |
| --- | --- |
| `wrangler.jsonc` | Worker 入口、静态资源、D1、日志和追踪配置 |
| `worker/index.ts` | 反馈与阅读量 API 路由 |
| `.github/workflows/workers-release.yml` | 模板 `main`、内容更新通知、手动触发正式发布 |
| `.github/workflows/pr-preview-build.yml` | 构建模板 PR，包括外部 fork |
| `.github/workflows/content-preview-build.yml` | 使用可信模板与内容 PR 的确切提交构建 |
| `.github/workflows/pr-preview-deploy.yml` | 校验静态产物、发布原生 Worker Preview、更新 PR 评论与 GitHub Deployment |

## 从 Pages 切换

1. 确认现有 Worker 名称为 `buct-wiki`，核对其域名和绑定。正式 D1 为 `afa6757e-4b3b-4acb-9bf1-f8820daab528`，绑定名为 `DB`。域名由控制台管理，本次配置不声明新域名或路由；切换前需将线上其他变量和绑定同步到仓库，避免部署时遗漏。
2. 模板仓库设置 Secret `CLOUDFLARE_API_TOKEN`：限定到 `buct-wiki` 的 **Individual Workers → Editor** 权限，不授予账户级 D1 权限。设置 Variable `CLOUDFLARE_ACCOUNT_ID`。
3. 内容仓库也设置上述账户 ID 与自己的 API Token，Token 同样限定到 `buct-wiki` 的 **Individual Workers → Editor**，不需要 D1 权限。共享工作流在调用仓库的上下文执行，因此需要调用方提供凭据。
4. 关闭旧 Pages 与新 Worker 上重复的 Git 自动构建。域名迁移、旧 Pages 部署和项目的删除不由工作流执行，旧预览链接不会自动变成 Workers 链接。
5. 先合入模板工作流，再合入内容仓库的入口。检查 `Workers release`，然后分别更新模板与内容 PR 验证预览。`workflow_run` 发布入口必须已存在于默认分支，首次外部贡献者的 Actions 可能需要维护者批准。

凭据只放 GitHub Secrets，不需要 CI `.env`。内容更新通知使用组织拥有的 GitHub App，配置见下文。旧 `TEMPLATE_DISPATCH_TOKEN` 和 `CLOUDFLARE_DEPLOY_HOOK` 不再使用。

Node 和 pnpm 版本分别由 `package.json` 的 `engines.node` 和 `packageManager` 声明，工作流直接读取，不单独维护版本号。

Wrangler 版本只在 `package.json` 的开发依赖中声明，并由 `pnpm-lock.yaml` 锁定。本地和 CI 均通过 `pnpm exec wrangler` 使用该版本，工作流不再额外安装 Wrangler。正式发布和预览共用 `wrangler.jsonc`，由 Wrangler 原生解析，脚本不读取或生成部署配置。

## 正式站与静态资源

Astro 仍输出静态站点到 `dist/`。匹配的 HTML、CSS、JS 和图片由 Workers Static Assets 直接提供；`"run_worker_first": ["/api/*"]` 只让 API 优先执行 Worker，不将所有文章访问送进服务端代码。缺失页面使用构建产物中的 `404.html`。

`POST /api/feedback` 与 `POST /api/page-views` 保留原有请求格式和 D1 SQL。已知 API 的其他 HTTP 方法返回 405，未知 API 返回 404。D1 绑定只赋予 Worker 访问数据库的能力；这两个公开接口仍不要求用户登录。

正式发布流程为「构建 → `wrangler deploy`」，不执行数据库建表或迁移。日志和追踪已在 `wrangler.jsonc` 启用，采样率为 1，包含 invocation logs。错误检测通过 `"issues": { "enabled": true }` 启用；这是 Wrangler 支持的字段名，非 `observability.issue_detection`。静态资源直接命中不会产生用户 Worker 的调用日志。

## PR 预览

使用项目锁定版本 Wrangler 的原生 `wrangler preview`（当前为 open beta）。每个 PR 是 `buct-wiki` 下的独立 Preview，不创建独立的 Worker 或 Pages 项目：

- 模板 PR：`pr-12-buct-wiki.<账户子域>.workers.dev`。
- 内容 PR：`content-pr-12-buct-wiki.<账户子域>.workers.dev`。
- 每次部署还有独立的 Deployment URL，可用于对照历史版本。

机器人从 Wrangler 的 `--json` 结果读取实际网址，更新同一条评论。GitHub Deployment 记录 pending、success 或 failure；失败展示运行日志，过期提交不覆盖当前 PR 的评论。

构建在无 Cloudflare 凭据的 runner 中执行；发布使用默认分支的可信代码，不执行 PR 的构建脚本。产物校验拒绝符号链接和特殊文件，并确认首页存在。校验通过后，产物仅复制到可信 checkout 的 `dist/`。Wrangler 使用该 checkout 的锁定依赖、主配置及 Worker 入口执行 `pnpm exec wrangler preview`，外部 PR 的服务端代码不会被部署。

主配置声明 `"previews": {}`，由原生 Preview 隔离生产设置，不继承正式 D1 绑定；命令使用 `--ignore-base-config` 忽略控制台的 Previews Base 设置。即使产物中含有 `wrangler.jsonc`、JavaScript 或同名 API 文件，也只会进入 `dist/`，不会覆盖主配置或可信 Worker 入口。预览包含可信 API 代码，但没有 D1 绑定，无法读写正式数据库。

预览构建使用 `pnpm run build:cloudflare --mode preview`。Astro 内置的 `import.meta.env.MODE === 'preview'` 关闭反馈和阅读量请求，表单保留供审阅并提示不会提交，阅读量显示 `--`。生成贡献者元数据使用工作流自带、只读的 `GITHUB_TOKEN`，不需要自定义预览环境变量。`workers.dev` 预览由 Cloudflare 原生添加 `X-Robots-Tag: noindex`，发布脚本不修改构建产物中的 `_headers`。

## 预览保留

预览完全使用 Cloudflare 的原生数量上限，不运行定时或手动清理任务，也不在 PR 关闭时主动删除：

- 免费套餐下，每个 Worker 最多 100 个 Preview；付费套餐为 500 个。两个仓库共享这个上限。达到上限后，Cloudflare 淘汰最久未部署的 Preview。
- 每个 Preview 最多保留 100 次部署，超过后淘汰最旧部署。
- 未达到上限时，已关闭 PR 的预览仍可能保留；被淘汰的预览及历史部署链接会失效。GitHub 构建 Artifact 单独保留 3 天。

## D1 运行时绑定

网站通过 `DB` 绑定访问现有数据库，反馈与阅读量功能继续使用 D1。CI 不持有 D1 API 写权限，不管理数据库结构；需要调整表结构时由维护者单独执行。`d1/page_views.sql` 和 `d1/feedback.sql` 保留为建表参考及本地 API 测试使用，不会在发布时自动执行。

## 内容仓库与验证

### GitHub App 配置

1. 在 `BUCTSNC` 组织的 **Settings → Developer settings → GitHub Apps** 创建 App。Homepage URL 可以填写模板仓库网址；关闭 Webhook，不需要回调地址或额外服务器。安装范围选择仅当前账户。
2. Repository permissions 仅授予 **Contents: Read and write**；Metadata 为默认只读，不需要 Actions、Workflows 或组织权限。
3. 将 App 安装到 `BUCTSNC`，选择 **Only select repositories → buct-wiki**。App 只需访问接收通知的模板仓库。
4. 在 App 设置中复制 **Client ID**，并通过 **Generate a private key** 下载 PEM 私钥。在内容仓库 `BUCTSNC/buct-wiki-content` 的 **Settings → Secrets and variables → Actions** 配置：

   | 类型 | 名称 | 值 |
   | --- | --- | --- |
   | Variable | `HELPER_APP_CLIENT_ID` | App 的 Client ID |
   | Secret | `HELPER_APP_PRIVATE_KEY` | PEM 文件完整内容，保留首尾标记和换行 |

5. 两边工作流合入 `main` 后，在内容仓库手动运行 **Trigger release**，确认模板仓库出现 **Workers release** 运行。成功后可删除旧的 `TEMPLATE_DISPATCH_TOKEN` Secret。

工作流使用固定提交版本的官方 [actions/create-github-app-token](https://github.com/actions/create-github-app-token)，只为模板仓库申请 `Contents: write` 的临时安装 Token，任务结束时自动撤销。私钥只存入 Secret，不提交到仓库。普通构建继续使用 Actions 自动提供的只读 `GITHUB_TOKEN`。

### 触发与检查

内容仓库的构建和发布两个预览工作流继续调用模板 `main` 上的共享工作流，无需复制 Workers 发布实现。内容仓库的 `Trigger release`（`.github/workflows/trigger-release.yml`）在 `main` 更新后发送 `content-updated` 通知，由模板的 `Workers release` 排队构建最新内容并发布；通知不接受任意构建地址或分支参数。通知工作流与部署平台无关，通知成功只表示已请求发布。

```bash
pnpm run test:preview
pnpm run test:worker
pnpm run build
pnpm exec wrangler deploy --dry-run
```

API 测试使用内存 SQLite，预览测试使用模拟 API，不需要真实 Token。预览完整构建需提供只读 `GITHUB_TOKEN`。仅本地 dry-run 不等于验证过线上发布，首次接入仍需检查真实 Actions 与 PR 链接。

参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[原生 Previews](https://developers.cloudflare.com/workers/previews/)、[预览配置](https://developers.cloudflare.com/workers/previews/configuration/)。
