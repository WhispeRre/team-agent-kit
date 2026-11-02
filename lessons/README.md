# 团队经验卡

格式见 [经验卡说明](../plugins/team-kit/skills/kit-formats/lesson-card.md)。

| 位置 | 状态 | 谁放进来 |
|---|---|---|
| `lessons/incoming/` | incoming：待整理 | /promote、`scripts/import-lessons.cjs`、/intake |
| `plugins/team-kit/lessons/` | merged：已合并进 skill，随插件分发，hook 用它做提醒和守卫 | /curate |
| `lessons/rejected/` | rejected：被拒，留档用于去重 | /curate |

incoming 里现有的几张卡来自一份项目交接文档，是框架自带的示例输入。它们各只有一条证据，第一次运行 /curate 时会停在"等证据"：需要第二条不同出处的证据，或者负责人在卡上写 `approved_by: <名字>`，才会合并进团队 skill。
