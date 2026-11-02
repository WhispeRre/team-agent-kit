# 收料

收集团队成员手上好用的 prompt、skill、工作流、工具和规范。

1. 先发[需求问卷](SURVEY.md)，弄清大家最常做什么、最常在哪一步纠正 agent。
2. 每份材料附一张[投稿卡](TEMPLATE.md)。
3. 原始文件放进 `intake/inbox/<提交人>/`。这个目录不进 git，因为原始材料里常有密钥和客户信息。
4. 维护者在本仓库运行 /intake，把材料转成草稿 skill、经验卡或内核提案；处理记录写在 [LOG.md](LOG.md)。

同学用 /promote 导出的经验文件不走 /intake，直接用 `scripts/import-lessons.cjs` 导入，见 [运维](../docs/operations.md) 的"收经验"。
