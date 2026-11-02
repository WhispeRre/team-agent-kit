# 运维

写给 kit 负责人。

## 1. 仓库

本目录建议用 git 管理（`git init`），方便 review 和回滚。推到 GitHub 私有仓库后可以用上 CI 和每周 Automation，以后也能直接导入为团队市场；不推也不影响用安装文件分发。

## 2. 分发

### 安装文件（默认）

1. 运行 `node scripts/pack.cjs`。它先跑 kit-check，通过后把 `marketplace.json` 里的插件打包成 `dist/team-kit-<版本>.cjs`，并打印一段可以直接发给同学的安装说明。只给某些同学加发领域包时，在命令后面写插件名，比如 `node scripts/pack.cjs team-kit 3d-gen`。
2. 把文件和说明发给同学。他们运行 `node <文件>`，插件装进 `~/.cursor/plugins/local/<插件名>/`，重启 Cursor 生效。macOS 和 Windows 用同一个文件。说明里带了 AIhero skills 的安装命令，安装文件运行完也会检查这台电脑装没装（见第 12 节）。
3. 发新版本：改完版本号重新打包、再发；同学再运行一次就会覆盖升级。安装文件只覆盖同名插件的目录，不碰别的东西；`--uninstall` 卸载，`--dry-run` 只打印将要做的改动。

`dist/` 不进 git。

### 维护者本机

`node scripts/install.cjs` 在 `~/.cursor/hooks.json` 加一个 workspaceOpen hook，Cursor 每次打开工作区时直接从仓库加载插件，改完重载窗口就生效。`--uninstall` 撤销，`--dry-run` 只打印将要做的改动。

它还会在 `~/.team-kit/config.json` 记下 `kitRepo`，之后你自己运行 `/promote` 会直接在仓库里开 PR。它会删掉安装文件装过的同名副本，因为两份同名插件会冲突。

### 团队市场（以后用上 Cursor Teams / Enterprise 时）

1. 在 Cursor Dashboard 的 Plugins & MCPs 页，找到 Team Marketplaces，选 Add Marketplace，再选 Import from Repo，粘贴 GitHub 仓库地址。
2. 把 `team-kit` 的安装方式设为 Required。
3. 在 Marketplace Settings 里打开 Auto Refresh（需要在仓库上装 Cursor GitHub App）。成员没有 GitHub 权限时，打开 Serve marketplace from Cursor。
4. 之后合并到主分支的改动会自动下发，不用再发安装文件。已经用安装文件装过的同学，先用 `--uninstall` 卸载。

Teams 套餐只能导入一个团队市场，所以领域包也放在这个仓库里。

### 其他工具

`npx skills add <仓库地址>`，只装 skills，没有内核和 hooks。

## 3. 收经验

没有 kit 仓库的同学运行 `/promote` 时，会在项目的 `lessons/outbox/` 里得到一个 `team-lessons-<用户名>-<日期>.md`，发给你。收到后：

1. 放进 `intake/inbox/<提交人>/`（这个目录不进 git）。
2. 运行 `node scripts/import-lessons.cjs intake/inbox/<提交人>/team-lessons-*.md`。已有的经验追加证据，新卡放进 `lessons/incoming/`；格式不对或疑似含密钥的卡会被跳过，并说明原因。
3. 运行 `/curate`。

## 4. 每周整理

每周运行一次 `/curate`，审它开的 PR（仓库不在 GitHub 上时，审它列出的改动）。

仓库推到 GitHub 后，可以配成 Cursor Automation 自动跑：

- 触发：Scheduled，每周一上午。
- 仓库：本仓库，主分支。
- 工具：开 PR、Memories（默认都开着）。
- 提示词：

  > 整理团队 kit。按 .cursor/skills/curate/SKILL.md 的步骤处理 lessons/incoming/ 和到期的复核项，确保 node scripts/kit-check.cjs 没有新错误，然后开一个 PR，正文按 skill 里的分节写。没有任何要处理的卡和复核项时不开 PR。用 Memories 记下被负责人拒绝过的提议和原因，之后不要重复提出。

可以在 cursor.com/automations 里创建，也可以在本地 agent 里用 `/automate` 描述上面的需求来创建。

## 5. CI

`.github/workflows/kit-check.yml` 在每个 PR 和主分支推送时跑 kit-check。仓库在 GitHub 上时，建议在仓库设置里把它设为合并前必须通过。

## 6. 版本

- 只合并经验或补证据：patch；新增 skill、改 hook、policy.json 或团队基线：minor；改内核：major（1.0 之前升 minor）。
- 改版本号时同步改 `plugins/<名字>/.cursor-plugin/plugin.json` 和 `CHANGELOG.md`（标题格式 `## <插件名> <版本>`），然后重新打包发出去。
- 改了团队基线，同学装上新版后，每个项目第一次开新对话时 agent 会提醒重跑 `/kickoff`；check-project 也会提示基线过期。

## 7. 角色和节奏

- 负责人：打包发版、导入同学发回的经验、审整理结果、批准内核改动、处理冲突、运行 `/intake`。
- 每周：`/curate`；有合并就打包发新版本。
- 每月：请同学各自运行 `node ~/.cursor/plugins/local/team-kit/scripts/stats.cjs`，汇总看纠正次数、轮数、子 agent 个数和高价会话的趋势；把 90 天没复核的经验过一遍。

## 8. 加领域包

1. 新建 `plugins/<领域>/`，放 `.cursor-plugin/plugin.json` 和 `skills/`；需要的话也可以有自己的 `rules/`、`hooks/`、`mcp.json` 和 `lessons/`。
2. 在 `.cursor-plugin/marketplace.json` 的 `plugins` 里加一项。
3. 给相关的同学打包：`node scripts/pack.cjs team-kit <领域>`。用团队市场时设为 Default Off。维护者本机在 `~/.team-kit/config.json` 的 `plugins` 里加上它的名字，再运行一次 `node scripts/install.cjs`。

## 9. 加团队工具（MCP）

在插件的 `mcp.json` 里配置，密钥只写 `${变量名}` 占位，并在 `plugin.json` 的 `variables` 里声明，不把值写进仓库。用团队市场时由管理员在 Dashboard 的插件配置里填写；用安装文件时，请同学在自己电脑上设置同名环境变量。

## 10. 花费策略

`plugins/team-kit/policy.json` 的 `expensiveModels` 是高价模型清单，每条是不区分大小写的正则，匹配子 agent 的模型名，比如 `"fable"` 能匹配 `claude-fable-5-1-thinking-high`。

- 清单里的模型，子 agent 启动时会被拦下，用户看到原因和放开的命令。同学确实需要时运行 `node ~/.cursor/plugins/local/team-kit/scripts/allow-expensive.cjs 2` 临时放开 2 小时（`status` 查看、`off` 马上恢复）。放开期间照样记进统计。
- 改清单要升 minor 版本、重新打包。清单为空就等于关掉花费守卫。
- 主对话用什么模型由同学自己选，kit 不拦，只在统计里标出用了高价模型的会话。
- hook 拿不到 token 用量，月度汇总时看子 agent 个数和高价会话数，个别人明显偏高时一起看是哪个 skill 或习惯导致的，再写成经验卡。

## 11. 换模型时

模型变强以后，有些规则会从帮忙变成碍事。团队默认模型换代时：

1. 用新模型跑一遍 /eval 的回归用例，确认团队经验在新模型上仍然生效。
2. 跑 /eval 的消融，找出新模型已经不需要的规则，交给 /curate 退役。
3. 对一下 policy.json 的高价模型清单和新的价格。
4. 换模型两周后，对比 stats 里的纠正、失败和子 agent 数；变差的地方写成经验卡，只在新模型上成立的写上 model 字段。

## 12. AIhero skills

团队的工作流用 [AIhero 的 skills](https://www.aihero.dev/skills)（mattpocock/skills）原版，kit 只补团队层（[ADR 0007](adr/0007-aihero-workflow.md)）。

- 安装：`npx skills@latest add mattpocock/skills -g -a cursor -s '*' -y`，装到 `~/.agents/skills/`。Windows 上报符号链接相关的错误时，末尾加 `--copy` 再运行一次。
- 不改原版，成员更新时会被覆盖。团队的做法写进团队基线、团队 skill 或项目层。
- 更新：AIhero 发新版时，先在自己电脑上运行 `npx skills update -g -y`，跑一遍 /eval 的回归用例，没问题再通知大家更新，并在 CHANGELOG 里写上测过的版本。成员各自随手更新的话，大家的版本会不一致。
- 成本已经按"收进别人写的 skill 前先查成本"查过：没有写死模型；会批量开子 agent 的（/implement-spec、codebase-design 的多版接口设计、/wayfinder 的调研）都要用户自己调用，内核的【需确认】照样适用；agent 自己会调用的 /code-review 固定开 2 个子 agent，只看改动。
- diagnosing-bugs 和 wizard 带 bash 脚本，Windows 上要 Git Bash 或 WSL。
