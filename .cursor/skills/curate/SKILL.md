---
name: curate
description: 整理团队 kit：处理 lessons/incoming 的经验卡，过门禁后增量合并进 skill，写回归用例并归档，提议退役过时或碍事的规则，更新版本和 CHANGELOG，最后开 PR。每周由 Automation 运行，也可以手动运行。
disable-model-invocation: true
---

# 整理

只在 kit 仓库里运行。整理是**增量合并**：每次只改表达这条经验所需的几行，不整份重写 skill，整份重写会把已有的细节压没。

## 0. 基线

运行 `node scripts/kit-check.cjs`，记下已有问题。不属于本次的问题不修，写进 PR 描述。

## 1. 逐张处理 lessons/incoming/

每张卡依次判断，记下结论：

1. **级别**：level 不是 team 的，移到 lessons/rejected/，status: rejected，reason: 项目级经验。
2. **补证据**：plugins/*/lessons/ 里已有同一条经验（同 id 或讲同一件事），把证据行追加过去，更新 last_verified，删掉 incoming 里这张。
3. **门禁**：满足其一才能合并——两条以上证据来自不同出处；severity: high；卡上有 approved_by（负责人担保）。不满足的留在 incoming，结论"等证据"；在 incoming 超过 8 周的移到 lessons/rejected/，status: rejected，reason: 证据不足。
4. **冲突**：和现有 skill 或内核的说法矛盾的不合并，结论"冲突"，写出两边原话，留给负责人。
5. **落点**：按 scope 找目标。
   - `tool/x`、`domain/x`：plugins/team-kit/skills/x/。没有就按 create-skill 的规范新建，description 写清触发场景，比如"使用 lark-cli 读写飞书时"。
   - `workflow/x`：团队自己的工作流 skill（kickoff、learn、promote 等）。
   - 判断类经验（什么算好、容易判断错的地方）：plugins/team-kit/skills/kickoff/templates/CODING_STANDARDS.md 的团队基线一节，写在两行标记之间。项目重跑 /kickoff 时同步，check-project 会提示基线过期。
   - 问题出在 AIhero 的 skill：不改原版（成员更新时会被覆盖），团队的做法写进团队基线或团队 skill。
   - `core`：不改 rules/，只写进 PR 描述的"内核提案"。
   - 限制某个模型的经验：把模型加进 plugins/team-kit/policy.json 的 `expensiveModels`（不区分大小写的正则），hook 会拦下用它的子 agent；规则文字按 scope 另找落点。
   - model 字段不是 any 的经验（只在某些模型上成立）：不写进内核和 skill 正文，因为那会对所有模型生效；用 trigger 让 hook 只对匹配的模型提醒。写不出 trigger 的，留在 incoming，结论"等证据"。
6. **合并**：在目标 skill 里加最少的文字表达这条经验，保留 applies_when 的前提。skill 超过 500 行时，把参考内容拆到同目录的文件里。
7. **回归用例**：按 evals/README.md 写 evals/cases/<id>.md。
8. **归档**：卡移到 plugins/team-kit/lessons/，status: merged，merged_into 填目标 skill 在仓库内的路径。

另外看一遍 lessons/rejected/：被拒之后又追加了新证据的卡，移回 incoming 重新走一遍。

完成标准：incoming 里只剩"等证据"和"冲突"的卡，每张卡都有结论。

## 2. 草稿

drafts/ 里已经完成对比测试（evals/results/ 有记录）且胜出的草稿，移进 plugins/team-kit/skills/，按新增 skill 处理版本。

## 3. 复核与退役

列出 plugins/*/lessons/ 里 last_verified 超过 90 天的经验，写进 PR 的"待复核"一节，不自动删除。

满足其一的经验提议退役：kit-check 提示有两条以上不同出处的反证；/eval 消融结果是"可退役"。退役就是从目标里删掉对应的文字（或 policy.json 的条目），卡改为 status: stale，reason 写依据，回归用例一起删掉。合并进内核的只写进"内核提案"。

## 4. 版本

只合并经验或补证据：patch；新增 skill、改 hook、policy.json 或团队基线：minor；改内核：major（1.0 之前升 minor）。同步改对应插件的 `.cursor-plugin/plugin.json` 和 CHANGELOG.md（标题格式 `## <插件名> <版本>`）。

## 5. 验证

`node scripts/kit-check.cjs` 没有新错误；对改动过的 skill 运行 /eval 的回归用例。

## 6. 开 PR

分支 `curate/<YYYYMMDD>`，标题"整理：<YYYY-MM-DD>"。在 Automation 里用自带的开 PR 工具；手动运行时用 git 和 gh。

正文分节：合并（卡和落点）、补证据、等证据、冲突（需要负责人决定）、退役、内核提案、待复核、回归结果、kit-check 基线问题。

没有任何要处理的卡、复核和退役项时，不开 PR。
