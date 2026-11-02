# 以 Cursor 插件作为分发单元，默认打包成一个安装文件

发给大家的东西全部放在 `plugins/<名字>/` 下，每个都是完整的 Cursor 插件；插件之外的目录（intake、drafts、evals、lessons/incoming）是维护用的，不分发。默认用 `scripts/pack.cjs` 把插件打包成一个 Node 安装文件，直接发给同学运行，装进 `~/.cursor/plugins/local/`：不要求大家有 git、GitHub 或团队版套餐，macOS 和 Windows 用同一个文件。经验回流也走文件：`/promote` 导出，负责人用 `scripts/import-lessons.cjs` 导入。仓库根目录保留团队市场格式（`.cursor-plugin/marketplace.json`），以后用上团队版可以直接导入、自动下发。

选插件，是因为它是唯一能把规则、skill、hook 和 MCP 打包在一起的格式；代价是 hooks 和规则只在 Cursor 里生效，其他工具只能用其中的 skills。选文件分发的代价是更新要手动重发，同学手上的版本可能不一致。
