---
id: expensive-model-needs-consent
level: team
status: merged
scope: core
applies_when: always
severity: high
created: 2026-10-30
last_verified: 2026-10-30
merged_into: plugins/team-kit/rules/team-core.mdc
---

# 不默认用高价模型启动子 agent；要用先征得用户同意

## 证据
- 2026-10-30 | outcome | 同事反馈：第三方全量审查 skill | 审查流程用 fable 模型，叠加全量审查，每天消耗特别大

## 说明
2026-10-30 负责人批准写进内核；0.3.0 精简内核后，在"投入跟任务大小相称"那一条里。hook 同时守住：plugins/team-kit/policy.json 列出的模型（目前是 fable），子 agent 启动时会被拦下，用户可以用 scripts/allow-expensive.cjs 临时放开。
