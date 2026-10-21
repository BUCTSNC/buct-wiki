# 发布与 PR 预览

GitHub Actions 构建，Wrangler 发布到 Cloudflare Worker `buct-wiki`。

## 工作流

模板仓库 `BUCTSNC/buct-wiki` 的 `.github/workflows/`：

| 文件 | 触发条件 | 操作 |
| --- | --- | --- |
| `build.yml` | 其他工作流调用 | 统一安装依赖、测试、构建，按需上传产物 |
| `workers-release.yml` | `main` 更新、`content-updated` 事件或手动运行 | 构建并发布正式站 |
| `pr-preview-build.yml` | 指向 `main` 的 PR 创建、更新、重新打开或进入合并队列 | 测试并构建模板，支持外部 fork |
| `content-preview-build.yml` | 内容仓库调用 | 使用模板 `main` 构建内容 PR 或合并队列提交 |
| `pr-preview-deploy.yml` | 预览构建结束 | 成功时发布预览，回报结果和链接 |

内容仓库 `BUCTSNC/buct-wiki-content` 调用模板的共享预览工作流。其 `trigger-release.yml` 在 `main` 更新或手动运行时发送 `content-updated`，触发模板发布。

正式发布分为 `build` 和 `deploy` 两个 job。构建成功后，部署 job 下载本次运行的 `production-build` 产物并发布，不重复构建。Cloudflare 凭据仅供部署步骤使用。

两个仓库的合并队列均通过 `merge_group` 验证队列提交的生产模式构建。仅 PR 使用 `--mode preview`、上传产物并发布预览。先合入模板工作流，再合入内容工作流；在两个仓库的分支规则中将各自的构建 job 设为必需检查，并启用 Merge queue。

共享构建后，模板检查为 `build / build`，内容检查为 `build / build / build`。已有必需检查规则需改选对应的新检查。

## Cloudflare

正式域名为 `wiki.snc.moe`，PR 预览使用 `workers.dev`。部署配置统一维护在 `wrangler.jsonc`；修改域名、绑定、Smart Placement 或日志设置时更新此文件。

在 Worker 所属账户中创建 **Account-owned API Token**：

| 权限 | 范围 | 需要时机 |
| --- | --- | --- |
| Individual Workers → Editor | `buct-wiki` | 正式发布和 PR 预览 |
| Workers → Metadata Read-Only | 该账户的 Workers 产品 | 部署元数据检查 |
| Zone → Workers Routes → Write | `snc.moe` | 正式发布同步 `routes` 中的自定义域名；PR 预览不需要 |

在两个仓库的 **Settings → Secrets and variables → Actions** 分别添加：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 各自的 Token |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Worker 所属账户 ID |

## GitHub App

内容仓库通过 App 通知模板发布：

1. 在 `BUCTSNC` 的 **Settings → Developer settings → GitHub Apps** 创建 App。Homepage URL 填 `https://github.com/BUCTSNC/buct-wiki`，关闭 Webhook，安装范围选 **Only on this account**。
2. Repository permissions 设置 **Contents: Read and write**，其余保持默认。
3. 安装到 `BUCTSNC`，仅选择 `buct-wiki`。
4. 复制 **Client ID**，通过 **Generate a private key** 下载 PEM。在内容仓库的 **Settings → Secrets and variables → Actions** 添加：

   | 类型 | 名称 | 值 |
   | --- | --- | --- |
   | Variable | `HELPER_APP_CLIENT_ID` | Client ID |
   | Secret | `HELPER_APP_PRIVATE_KEY` | 完整 PEM 内容，保留首尾标记和换行 |

App Token 在任务结束时撤销。构建使用 Actions 自动提供的 `GITHUB_TOKEN`，无需另设 Secret。

## PR 预览

两个仓库的 PR 在同一个 Worker 下独立发布。以 PR #12 为例：

| 仓库 | 预览地址 |
| --- | --- |
| 模板 | `pr-12-buct-wiki.<账户子域>.workers.dev` |
| 内容 | `content-pr-12-buct-wiki.<账户子域>.workers.dev` |

成功后，PR 评论提供固定预览地址和本次部署链接；失败时提供日志链接。

PR 和合并队列构建不持有 Cloudflare 凭据。预览发布任务校验 PR 来源和提交，只接收静态产物，使用模板默认分支的配置与 Worker 代码。预览不绑定正式 D1，页面禁用反馈提交和阅读量请求。

关闭 PR 不删除预览，由 Cloudflare 按数量淘汰：

- 每个 Worker：免费套餐 100 个 Preview，付费套餐 500 个，两个仓库共享。
- 每个 Preview：100 次部署。
- GitHub 构建产物：保留 3 天。

## 启用与验证

1. 核对 `wrangler.jsonc` 与线上配置，关闭 Cloudflare Git 自动构建。
2. 配置上述 Cloudflare 和 GitHub App 凭据。
3. 先合入模板工作流，再合入内容工作流。`workflow_run` 入口须位于默认分支；外部贡献者的首次运行可能需要批准。
4. 在内容仓库运行 **Trigger release**，确认模板 **Workers release** 成功。
5. 分别创建模板和内容 PR，检查预览链接。

Node、pnpm 和 Wrangler 版本见 `package.json`。本地检查：

```bash
pnpm install --frozen-lockfile
pnpm run test:preview
pnpm run test:worker
pnpm run build:cloudflare
pnpm exec wrangler deploy --dry-run
```

`build:cloudflare` 需要环境变量 `GITHUB_TOKEN`，用于读取贡献者信息；预览构建加 `--mode preview`。`--dry-run` 仅检查打包，不发布到 Cloudflare。

参考：[Previews](https://developers.cloudflare.com/workers/previews/)、[Workers 权限](https://developers.cloudflare.com/workers/authorization/workers/)。
