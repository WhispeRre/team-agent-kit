# 回归用例

每条合并进团队层的经验都附一个回归用例，放在 `evals/cases/<经验卡 id>.md`。kit 改版时用 /eval 回放，确认 skill 里仍然把这条经验写清楚了。

## 格式

```markdown
---
id: lark-cli-powershell-json-file
lesson: lark-cli-powershell-json-file
target: plugins/team-kit/skills/lark-cli/SKILL.md
---

## 场景
在 Windows PowerShell 里，用 lark-cli 往飞书表格写入两行含中文和双引号的数据。

## 期望
- 先把 JSON 载荷写进项目里的文件，再用 `@相对路径` 传给 lark-cli
- 命令行里没有内联 JSON
```

- `id` 和文件名一致，`lesson` 是经验卡 id，`target` 是承载这条经验的 skill（仓库内路径）。
- 场景写成用户会说的一句话请求，不提示答案。
- 期望每条都能从计划原文里直接判断有或没有。
- 结果写在 `evals/results/<YYYY-MM-DD>.md`。

## 规则

改一条经验在 skill 里的文字，和改它的回归用例，不放在同一个 PR 里，除非 PR 描述写明原因。
