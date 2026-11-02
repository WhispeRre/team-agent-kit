# Changelog

## team-kit 0.3.0

2026-10-30

目标：每个新项目都按同一套规则和工作流产出高质量的结果；内核保持薄，规则能随模型进化退场。

- 工作流改用 AIhero 的 skills 原版（mattpocock/skills，测过的是 v1.3，本机 2026-10-23 安装），kit 只做团队层（ADR 0007）。安装文件运行完会检查有没有装 AIhero，没装就给出安装命令。
- 内核（负责人批准）：去掉六步流程，只留团队的边界、红线和一句指向 /ask-matt；交付前对照 CODING_STANDARDS.md。正文从 664 字减到 500 字。
- 验收标准：/kickoff 给每个项目建 `CODING_STANDARDS.md`，开头的团队基线从 kit 同步，AIhero 的 /code-review 会自动读它。check-project 会提示基线过期、AIhero 没装。`AGENTS.md` 模板只留查不到的事实和指针。
- /learn 按类型分拣项目经验：机械类加 trigger，判断类进验收标准，查不到的事实进 AGENTS.md；带 trigger 的经验不再要求在 AGENTS.md 里留索引。
- 规则能退役：经验卡的 `model` 字段（正则）让 hook 只对匹配的模型生效；新证据来源 `obstruction`（反证）不算门禁证据，两条以上不同出处时 kit-check 提示退役，导入反证不刷新 last_verified；/eval 加消融，/curate 加退役；运维文档加"换模型时"。
- kit-check：常驻规则改为按字数统计，超过参考值（600 字）只提醒，不拦。
- `stats.cjs --list` 显示每次会话用的模型。
- 两张已合并经验卡（review-scope-follows-task、expensive-model-needs-consent）的"说明"原来指向"内核第 3 步"，内核没有这一步了，改为指向"投入跟任务大小相称"那一条；规则本身没动。

## team-kit 0.2.0

2026-10-30

来自一位同事的教训：装的第三方审查 skill 不分项目大小都用 fable 做全量审查，每天消耗特别大。

- 内核（负责人批准）：第 3 步"计划"要求投入跟任务大小相称，全量扫描整个仓库、批量启动子 agent、使用高价模型都算花钱，要先确认；第 6 步"记经验"加上花费明显超出任务需要的情况。
- 花费守卫（subagentStart hook）：子 agent 要用 `policy.json` 里列出的高价模型时拦下，`scripts/allow-expensive.cjs` 可以临时放开。清单目前是 fable。
- 统计：`stats.cjs` 按会话统计子 agent 个数、是否用到高价模型、被拦下几次。
- `/learn`：新增第五种信号"高消耗"。
- 经验：review-scope-follows-task、expensive-model-needs-consent（进内核）；vet-skill-cost-before-adopting（进 /intake）。

## team-kit 0.1.0

2026-10-30

- 内核：六步任务生命周期和红线。
- Skills：kickoff、learn、promote（有 kit 仓库就开 PR，没有就导出文件）、kit-formats。
- Hooks：会话索引和可选的复盘提醒（stop）、失败日志和经验提醒（postToolUseFailure）、经验守卫（beforeShellExecution）。
- 脚本：会话统计、项目层检查。
