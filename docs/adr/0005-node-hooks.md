# hook 和脚本用零依赖的 Node 编写，命令经 `node -e` 定位脚本

插件的 stop hook 在工作区根目录运行，Windows 上 hook 命令经 PowerShell 执行，所以 hook 命令不能用相对路径，也不能依赖某种 shell 的变量展开语法。hook 命令统一写成 `node -e "require(require('path').join(process.env.CURSOR_PLUGIN_ROOT,'hooks','kit-hook.cjs'))" <事件名>`，在 sh 和 PowerShell 下都成立。团队里已有项目的 Windows 环境只装了 Node、没有 Python，所以选 Node，并且不引入 npm 依赖。
