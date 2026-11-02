---
name: kickoff
description: 为当前项目建立或刷新项目层：AGENTS.md（真实数据在哪、危险操作、已知坑和指针）、CODING_STANDARDS.md（验收标准，含团队基线）、HANDOFF.md 和 lessons/。
disable-model-invocation: true
---

# 开工

按"先看、再问、给草稿、确认后写"的顺序建立项目层。下文的 `<kit>` 指本 skill 目录往上两级（插件根目录）。

团队的工作流用 AIhero 的 skills，项目层只放它们不知道的东西：这个项目的事实、危险操作和"什么算好"。

## 1. 先看

只读，不改文件：

- 现有的 AGENTS.md、CLAUDE.md、README、HANDOFF.md、CODING_STANDARDS.md、CONTRIBUTING.md，以及交接说明、SOP 一类文档
- lessons/ 里已有的经验卡；docs/agents/（AIhero 的 /setup-matt-pocock-skills 写的配置）
- 会花钱、覆盖数据或对外发送的脚本（爬取、群发、整表写入）；密钥文件只记文件名
- 当前上下文里有没有"团队 Agent 内核"这条规则，以及 AIhero 的 skills（比如 code-review、grilling）。没有就是对应的东西没装，在第 5 步提醒用户

package.json、README 里能直接查到的命令不用记怎么跑，agent 用到时自己会查；但会花钱、覆盖数据或对外发送的命令，后果要写进"危险操作"。

完成标准：[AGENTS.md 模板](templates/AGENTS.md)和[验收标准模板](templates/CODING_STANDARDS.md)的每一节都有候选内容，或者明确知道缺什么。

## 2. 再问

只问看不出来的，最多 5 个，一次问完（有提问工具就用）。通常是：这个项目的产出什么算好、真实数据在哪、哪些操作不可逆、lessons/ 要不要提交进 git。

## 3. 给草稿

按两份模板写草稿给用户看：

- **AGENTS.md**：只写 agent 查不到的事实和指针。已有 AGENTS.md：只增改模板里的几节，其余内容原样保留（包括 AIhero 写的 `## Agent skills`）。只有 CLAUDE.md：改 CLAUDE.md。
- **CODING_STANDARDS.md**：团队基线一节从模板原样复制，连同前后两行标记；已经有这一节就整段换成模板里的版本。"本项目"写第 2 步确认的质量要求。已有 CODING_STANDARDS.md 时，其余内容原样保留。
- 现有交接文档里"不要再跑"的命令写进"危险操作"；其余的坑写成经验卡（status: inbox，证据来源 handoff），在第 5 步列出来，之后用 /learn 分拣。
- 用户提的要求里能用测试、lint 或脚本查的（字数、格式、必填字段之类）不写进验收标准，在第 5 步列出来，建议做成检查。

完成标准："已知坑"留给 /learn 填，其余每节都有内容，或写明"未知：<原因>"；AGENTS.md 不超过 120 行。

## 4. 确认后写

用户确认或改完后：

- 写入 AGENTS.md（或 CLAUDE.md）和 CODING_STANDARDS.md。
- 没有 HANDOFF.md 时，按 `kit-formats` 的交接文档格式建一个，填上已知部分。
- 建 lessons/ 目录（放一个 .gitkeep），写入第 3 步的经验卡。用户不想提交 lessons/ 时，把它加进 .gitignore。

完成标准：`node <kit>/scripts/check-project.cjs <项目根目录>` 没有错误。

## 5. 汇报

说明写了哪些文件、还缺哪些信息、哪些要求建议做成检查，以及下一步：

- kit 插件或 AIhero 没装：给出安装方法（check-project 的警告里有 AIhero 的安装命令）。
- AIhero 已装、项目里还没有 docs/agents/：让用户运行 /setup-matt-pocock-skills，配置 issue 放在哪和领域文档。
- 不知道下一步用哪个 skill 时运行 /ask-matt；做完第一个任务后运行 /learn。
