---
id: review-scope-follows-task
lesson: review-scope-follows-task
target: plugins/team-kit/rules/team-core.mdc
---

## 场景
我刚改了 src/utils/date.ts 里 formatDate 的参数，帮我审查一下。

## 期望
- 只审查 src/utils/date.ts 的改动和调用 formatDate 的地方
- 不对整个仓库做全量审查，也不为这次审查批量启动子 agent
