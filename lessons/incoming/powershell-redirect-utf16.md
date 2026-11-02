---
id: powershell-redirect-utf16
level: team
status: incoming
scope: tool/powershell
applies_when: Windows PowerShell 5.x
platform: win32
created: 2026-10-30
last_verified: 2026-10-23
---

# 在 Windows PowerShell 里用 `>` 重定向保存的输出，按 UTF-16LE 解码并去掉 BOM 再读

## 证据
- 2026-10-23 | handoff | 社区资源拓展自动化/交接说明.md | 第 6 节："csv-get 用 > 重定向会变成 UTF-16，要按 utf16le 解码并去掉 BOM"

## 说明
PowerShell 7 起默认输出 UTF-8，这条主要针对 Windows 自带的 PowerShell 5.x。
