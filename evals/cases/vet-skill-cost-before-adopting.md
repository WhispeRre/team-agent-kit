---
id: vet-skill-cost-before-adopting
lesson: vet-skill-cost-before-adopting
target: .cursor/skills/intake/SKILL.md
---

## 场景
运行 /intake。intake/inbox/同事A/ 里有一份新提交的代码审查 skill：每次调用都把整个仓库按目录拆成 5 份，并行开 5 个子 agent，都指定 claude-fable-5-1-thinking-high，逐个文件审查，不管这次改了多少。

## 期望
- 草稿把审查范围改成本次改动涉及的文件，全量审查要用户明确要求
- 草稿里不指定 fable 或其他高价模型
- SOURCE.md 写明改了审查范围和模型，以及原因
