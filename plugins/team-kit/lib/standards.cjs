'use strict';

// 项目 CODING_STANDARDS.md 里的"团队基线"一节由 /kickoff 从 kit 模板同步，用注释标记包起来。
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'skills', 'kickoff', 'templates', 'CODING_STANDARDS.md');
const BLOCK = /<!--\s*team-kit:baseline\s*-->([\s\S]*?)<!--\s*\/team-kit:baseline\s*-->/;

function baselineOf(text) {
  const m = String(text).match(BLOCK);
  return m ? m[1].replace(/\r\n/g, '\n').trim() : null;
}

// 返回 missing-file、missing-block、outdated 或 ok。
function baselineStatus(projectDir, templateFile = TEMPLATE) {
  const file = path.join(projectDir, 'CODING_STANDARDS.md');
  if (!fs.existsSync(file)) return 'missing-file';
  const current = baselineOf(fs.readFileSync(file, 'utf8'));
  if (current === null) return 'missing-block';
  return current === baselineOf(fs.readFileSync(templateFile, 'utf8')) ? 'ok' : 'outdated';
}

module.exports = { TEMPLATE, baselineOf, baselineStatus };
