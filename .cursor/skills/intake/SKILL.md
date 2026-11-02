---
name: intake
description: 处理团队成员提交的材料（prompt、skill、工作流、工具、SOP、交接文档），转成 kit 的草稿 skill、经验卡或内核提案。收到新材料后运行。
disable-model-invocation: true
---

# 收料

把 intake/inbox/ 里的原始材料转成 kit 资产。原始材料不进 git，进 git 的只有转出来、脱敏过的东西。各类资产该去哪一层，见 docs/architecture.md 的"四层"一节。

## 1. 列清单

列出 intake/inbox/ 下的所有材料，去掉 intake/LOG.md 里已经记录过的。每份材料附的投稿卡（intake/TEMPLATE.md 格式）一起读。

## 2. 分类和转换

每份材料判断类型，按下表转换：

| 类型 | 转成 | 放在 |
|---|---|---|
| prompt、工作流说明、别人写的 skill | 草稿 skill，按 create-skill 和 writing-for-agents 的规范改写 | drafts/<名字>/SKILL.md，来源和证据写进同目录的 SOURCE.md |
| 工具（MCP、CLI、脚本） | 讲清"怎么用、有什么坑"的草稿 skill；MCP 配置里的密钥用 `${变量名}` 占位 | drafts/<名字>/ |
| 交接文档、SOP、会话摘录 | 经验卡，来源写 handoff，先脱敏 | lessons/incoming/ |
| 通用规范、团队约定 | 内核提案 | drafts/core-proposals.md |

和已有 skill 或其他草稿做同一件事的，记进 drafts/OVERLAPS.md，等 /eval 做对比测试。

prompt、工作流和 skill 转成草稿前先查成本：会不会不分任务大小就全量扫描整个仓库、一次开一批子 agent，或者写死 plugins/team-kit/policy.json 里的高价模型。有的话，草稿改成按任务范围处理、不指定模型，大投入的步骤标【需确认】，并在 SOURCE.md 写明改了什么、为什么。

完成标准：每份材料都有产出，或者有不收的理由；转成草稿的材料都查过成本。

## 3. 记录

在 intake/LOG.md 追加一行：日期、材料、类型、产出路径（或不收的理由）。

## 4. 检查

运行 `node scripts/kit-check.cjs`，确认没有密钥和格式错误。
