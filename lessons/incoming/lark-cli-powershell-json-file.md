---
id: lark-cli-powershell-json-file
level: team
status: incoming
scope: tool/lark-cli
applies_when: Windows PowerShell
platform: win32
created: 2026-10-30
last_verified: 2026-10-23
trigger: lark-cli
---

# 在 PowerShell 里调用 lark-cli 时，把 JSON 载荷写成文件再用 `@相对路径` 传入，带值的参数写成 `--highlight=false` 这样的连写形式

## 证据
- 2026-10-23 | handoff | 社区资源拓展自动化/交接说明.md | 第 6 节："PowerShell 会拆开行内 JSON"，`--highlight=false` 必须连写

## 说明
例：载荷放在 `data/feishu/row.json`，命令里写 `@data/feishu/row.json`（相对项目根目录）。
