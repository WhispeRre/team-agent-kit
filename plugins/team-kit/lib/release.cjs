'use strict';

// 用安装文件装的 kit 从这里升级：每次发布都附一个固定名字的 team-kit.cjs，
// 所以 releases/latest/download/team-kit.cjs 总是最新版。换仓库时改 REPO，pack.cjs 发布前会核对。
const REPO = 'WhispeRre/team-agent-kit';
const LATEST_ASSET = `https://github.com/${REPO}/releases/latest/download/team-kit.cjs`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;

// 下载失败时不能运行临时目录里上一次留下的旧文件，否则会悄悄装回旧版。
function installCommand(platform = process.platform) {
  return platform === 'win32'
    ? `curl.exe -fsSL ${LATEST_ASSET} -o "$env:TEMP\\team-kit.cjs"; if ($?) { node "$env:TEMP\\team-kit.cjs" }`
    : `curl -fsSL ${LATEST_ASSET} -o /tmp/team-kit.cjs && node /tmp/team-kit.cjs`;
}

module.exports = { REPO, LATEST_ASSET, LATEST_API, installCommand };
