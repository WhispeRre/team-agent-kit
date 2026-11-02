# 经验卡

一张卡记一条经验，一张卡一个文件。项目里放在 `lessons/<id>.md`；kit 仓库里按状态放在 `lessons/incoming/`、`lessons/rejected/` 或 `plugins/<插件>/lessons/`。

## 示例

```markdown
---
id: lark-cli-powershell-json-file
level: team
status: inbox
scope: tool/lark-cli
applies_when: Windows PowerShell
platform: win32
created: 2026-10-30
last_verified: 2026-10-30
trigger: lark-cli
---

# 在 PowerShell 里调用 lark-cli 时，把 JSON 载荷写成文件，再用 `@相对路径` 传入

## 证据
- 2026-10-23 | handoff | 社区资源拓展自动化/交接说明.md | PowerShell 会拆开行内 JSON
- 2026-10-30 | tool-error | 会话 3f2a9c1e | 行内 JSON 报 Unexpected token，改用 @data/feishu/row.json 后写入成功

## 说明
可选：为什么、反例、怎么复现。
```

## 字段

| 字段 | 必填 | 取值 |
|---|---|---|
| `id` | 是 | 小写字母、数字和连字符，和文件名一致 |
| `level` | 是 | `project`：只对本项目成立；`team`：换个项目也成立 |
| `status` | 是 | 见下方"状态" |
| `scope` | 是 | `tool/<工具>`、`domain/<领域>`、`workflow/<流程>`、`project` 或 `core` |
| `applies_when` | 是 | 成立的前提（系统、工具版本、数据源、模型）；没有前提写 `always` |
| `created` | 是 | 创建日期，`YYYY-MM-DD` |
| `last_verified` | 否 | 最近一次有新证据的日期 |
| `severity` | 否 | `normal`（默认）；`high`：造成过花钱、丢数据或对外出错 |
| `model` | 否 | `any`（默认）；只在某些模型上成立时，写匹配模型名的正则（不区分大小写）。hook 只对匹配的模型提醒和守卫，换模型时要重新验证 |
| `platform` | 否 | 只在某些系统上成立时写，逗号分隔：`darwin`、`win32`、`linux` |
| `trigger` | 否 | 正则，不区分大小写；"工具名、命令、报错"命中时，hook 会把这条经验提醒给 agent |
| `enforce` | 否 | `remind`（默认）；`ask`：执行命中 trigger 的 shell 命令前要人确认。需要配合 trigger |
| `merged_into`、`reason`、`pr`、`approved_by` | 否 | 晋升和整理时填写。`merged_into` 写 kit 仓库内的路径；`approved_by` 是负责人对证据不足的卡的担保 |

## 状态

- 项目里：`inbox`（agent 写的候选）→ `accepted`（人确认过）→ `submitted`（已提给团队）；或者 `rejected`（在"说明"里写原因）、`stale`。
- kit 里：`incoming`（待整理）→ `merged`（已合并进 skill、内核或 policy.json，填 `merged_into`）；或者 `rejected`（填 `reason`）、`stale`（规则过时或碍事，已经退役，在 `reason` 写依据）。

hook 只把项目里 `accepted` 和插件里 `merged` 的卡当作生效经验。

## 证据行

格式是 `- 日期 | 来源 | 出处 | 一句话`。来源只能是：

- `correction`：用户纠正
- `tool-error`：工具报错
- `retry`：失败后换了做法才成功
- `handoff`：交接文档或 SOP
- `review`：人工评审
- `eval`：回归用例或对比测试
- `outcome`：下游结果，比如回复率、打印成功率、账单和消耗
- `obstruction`：反证，这条规则碍事了，比如用户嫌确认太多、要求跳过某一步，或者守卫拦下后用户放开、结果正常。追加在被反对的那张卡上

出处写会话 id、文件路径或链接。门禁按"不同出处"计数，同一次会话的多条证据只算一条，反证不算。

## 写法

- 标题就是规则：一句祈使句，写该怎么做。
- 一张卡只写一条经验；同一件事再发生时追加证据，不新建卡。
- trigger 只匹配真正相关的命令或报错，范围越窄越好。
- 密钥只写放在哪，客户信息用代号。
