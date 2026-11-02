'use strict';

// 团队工作流用 AIhero 的 skills（mattpocock/skills），kit 只补团队层。
const fs = require('fs');
const os = require('os');
const path = require('path');

const AIHERO_INSTALL = "npx skills@latest add mattpocock/skills -g -a cursor -s '*' -y";
const SENTINEL = path.join('ask-matt', 'SKILL.md');

// npx skills 默认装到 .agents/skills，也可能装到 .cursor/skills；用户级和项目级都算。
function findAihero(projectDir) {
  for (const root of [os.homedir(), projectDir].filter(Boolean)) {
    for (const dir of ['.agents', '.cursor']) {
      const file = path.join(root, dir, 'skills', SENTINEL);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

module.exports = { AIHERO_INSTALL, findAihero };
