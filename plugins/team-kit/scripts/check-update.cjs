'use strict';

// 查 GitHub Releases 上团队 kit 的最新版本，记进 ~/.team-kit/update-check.json。
// sessionStart hook 每天最多在后台启动一次；只请求版本号，不发送会话内容。
const home = require('../lib/home.cjs');
const { LATEST_API } = require('../lib/release.cjs');

const FILE = 'update-check.json';

async function main() {
  const res = await fetch(process.env.TEAM_KIT_RELEASES_API || LATEST_API, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'team-kit-update-check' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return;
  const match = String((await res.json()).tag_name || '').match(/^team-kit-(\d+\.\d+\.\d+)$/);
  if (!match) return;
  home.writeJson(FILE, { ...home.readJson(FILE, {}), latest: match[1], checkedAt: new Date().toISOString() });
}

main().catch(() => {});
