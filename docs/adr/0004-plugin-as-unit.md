# 以 Cursor 插件作为分发单元：团队成员用团队市场，其他人用安装文件

发给大家的东西全部放在 `plugins/<名字>/` 下，每个都是完整的 Cursor 插件；插件之外的目录（intake、drafts、evals、lessons/incoming）是维护用的，不分发。团队成员用团队市场：仓库根目录是团队市场格式（`.cursor-plugin/marketplace.json`），导入后 `team-kit` 设为 Required，跟着 main 自动下发。团队之外的人用安装文件：`scripts/pack.cjs` 把插件打包成一个 Node 安装文件，发布到仓库的 GitHub Releases 页，一行命令下载运行，装进 `~/.cursor/plugins/local/`；不用装 git，macOS 和 Windows 用同一个文件；打不开 GitHub 的同学，直接把文件发给他。安装文件不提交进仓库：它是生成物，提交进去容易和源码对不上，发布页上的每个文件都对应一个 tag。经验回流也走文件：`/promote` 导出，负责人用 `scripts/import-lessons.cjs` 导入。

选插件，是因为它是唯一能把规则、skill、hook 和 MCP 打包在一起的格式；代价是 hooks 和规则只在 Cursor 里生效，其他工具只能用其中的 skills。团队市场目前只跟 main，合并就等于发给所有成员，所以 main 上的每次改动都要先过 kit-check 和回归。安装文件的更新靠开对话时的提醒和本人同意，手上的版本可能不一致。没让个人用 Cursor 里的"从 GitHub 导入插件"：它目前会卡在第一次导入时的提交，而且会盖过本地安装的同名插件。
