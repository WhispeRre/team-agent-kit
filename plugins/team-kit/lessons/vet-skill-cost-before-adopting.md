---
id: vet-skill-cost-before-adopting
level: team
status: merged
scope: workflow/intake
applies_when: always
severity: high
created: 2026-10-30
last_verified: 2026-10-30
merged_into: .cursor/skills/intake/SKILL.md
---

# 收进别人写的 skill 前先查成本：会不会不分任务大小全量扫描、批量开子 agent、写死高价模型

## 证据
- 2026-10-30 | outcome | 同事反馈：第三方全量审查 skill | 装了一个审查 skill，不分项目大小都用 fable 做全量审查，每天消耗特别大

## 说明
成员自己装的 skill 不经过 kit，kit 管不到安装这一步。兜底有两层：subagentStart hook 拦下 policy.json 里的高价模型；stats 按会话统计子 agent 个数和高价模型的使用，/learn 据此找"高消耗"信号。
