# 团队 Agent Kit

全团队共享的 agent 环境，以 Cursor 插件分发；这个仓库同时是整理团队经验的地方。架构见 docs/architecture.md，术语见 GLOSSARY.md。

## 完成标准

- `node scripts/kit-check.cjs` 没有错误。
- 改了 skill 或经验：对应的回归用例通过（/eval）。
- 改了插件内容：plugin.json 的版本号和 CHANGELOG.md 已更新。

## 真实数据在哪

- 发给所有人的只有 `plugins/<名字>/` 里的内容，其余目录是维护用的。
- 团队已合并的经验在 `plugins/team-kit/lessons/`，待整理的在 `lessons/incoming/`，被拒的在 `lessons/rejected/`。
- `intake/inbox/` 是成员提交的原始材料，不进 git。
- `dist/` 是 `scripts/pack.cjs` 生成的安装文件，不进 git。

## 环境与常用命令

- 环境：Node 18 以上，零依赖；成员有 macOS 也有 Windows（PowerShell）。
- 检查仓库：`node scripts/kit-check.cjs`
- 检查某个项目的项目层：`node scripts/kit-check.cjs --project <目录>`
- 打包安装文件：`node scripts/pack.cjs`（输出在 dist/）
- 发布到 GitHub Releases：`node scripts/pack.cjs --release`（只从推送过的 main 发布；加 `--dry-run` 只看不发）
- 导入同学发回的经验：`node scripts/import-lessons.cjs <文件>`
- 维护者本机加载：`node scripts/install.cjs --dry-run` 先看会改什么（详见 docs/operations.md）

## 危险操作

- 改 `plugins/team-kit/rules/`（内核）：影响所有人的每一轮对话，需要负责人批准，版本升 major（1.0 之前升 minor）。
- 改 `plugins/team-kit/policy.json`：加进去的模型，所有人的子 agent 都会被拦下，需要负责人批准。
- 修改或删除 `plugins/*/lessons/`、`evals/cases/` 里已有的条目：它们是评判标准，走 PR 并写明原因。
- `node scripts/install.cjs`（不带 `--dry-run`）：会改本机的 `~/.cursor/hooks.json`，先征得用户同意。

## 已知坑

<!-- /learn 确认的项目级经验，一行一条：- <规则>〔<经验卡 id>〕 -->

## 指针

- 维护流程：/intake 处理材料，/curate 整理经验，/eval 回归和对比
- 三种标准文档的格式：`plugins/team-kit/skills/kit-formats/`
