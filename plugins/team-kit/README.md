# team-kit

团队 Agent Kit 的核心插件，提供团队层。工作流用 AIhero 的 skills，需要另外安装：`npx skills@latest add mattpocock/skills -g -a cursor -s '*' -y`。

- 规则：`rules/team-core.mdc` 是团队内核（边界和红线），每轮对话生效。
- Skills：`/kickoff` 建立项目层，包括验收标准 `CODING_STANDARDS.md`（团队基线的模板在 `skills/kickoff/templates/`）；`/learn` 复盘，`/promote` 提交团队经验；`kit-formats` 是三种标准文档的格式，agent 按需读取。
- Hooks：新对话开始时，项目还没有项目层、团队基线过期或 AIhero 没装，提醒一次（每个项目一次，团队基线变了再一次）；在本机 `~/.team-kit/` 记录会话索引、工具失败和子 agent；工具失败时按经验卡的 trigger 提醒 agent；执行命中 `enforce: ask` 经验的命令前要求人确认；子 agent 要用 `policy.json` 里的高价模型时拦下。
- `lessons/`：已合并的团队经验卡，hook 用它们做提醒和守卫。
- `policy.json`：团队的高价模型清单。
- `scripts/`：`stats.cjs` 会话统计；`check-project.cjs` 检查项目层，包括团队基线是否过期、AIhero 装没装；`allow-expensive.cjs` 临时放开高价模型。

需要 Node 18 以上。设计说明在 kit 仓库的 `docs/architecture.md`。
