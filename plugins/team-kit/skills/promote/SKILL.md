---
name: promote
description: 把项目里标为团队级的经验卡脱敏、泛化后提交给团队：有 kit 仓库就开 PR，没有就导出成一个文件发给 kit 负责人。
disable-model-invocation: true
---

# 提交团队经验

## 1. 找卡

项目 lessons/ 里 level: team 且 status: accepted 的卡。没有就告诉用户，结束。

## 2. 脱敏和泛化

逐张处理，改完给用户看：

- 删掉密钥、token、客户信息和内部链接，只留"去哪取"。
- 项目特有的路径和名字改成通用说法；applies_when 写清前提（系统、工具版本、模型），只在某个系统上成立的补 platform。
- 证据行保留日期和来源，出处改成"<项目名>/<文件名>"或会话 id。

完成标准：每张卡都过了这三项，用户确认。

## 3. 选提交方式

读 `~/.team-kit/config.json` 的 `kitRepo`。它指向一个 git 仓库，且工作区干净（`git status` 没有改动），走 4A；否则走 4B。

## 4A. 开 PR

在 kit 仓库里：

1. `git pull`，新建分支 `lessons/<用户名>-<YYYYMMDD>`。
2. 逐张卡处理：`plugins/*/lessons/`、`lessons/incoming/` 或 `lessons/rejected/` 里已有同 id 的卡，就把新证据行追加过去；没有就复制到 `lessons/incoming/`，status 改为 incoming。
3. 运行 `node scripts/kit-check.cjs`，有错先修。
4. 提交并 push。有 `gh` 就 `gh pr create`，标题"经验：<主题>"，正文列出每张卡的规则和证据条数；没有 `gh` 就把分支名告诉用户，请他在网页上开 PR。

完成标准：PR 已创建，或者用户拿到了分支名。

## 4B. 导出文件

把所有卡写进项目里的 `lessons/outbox/team-lessons-<用户名>-<YYYYMMDD>.md`：每张卡前面单独一行 `<!-- team-kit:card -->`，后面是这张卡的完整内容（front matter 加正文），卡的内容不做其他改动。

告诉用户这个文件的完整路径，请他发给 kit 负责人。

完成标准：文件已生成，用户知道发给谁。

## 5. 回写

项目里这些卡的 status 改为 submitted，加上 `pr: <PR 链接、分支名或导出文件名>`。
