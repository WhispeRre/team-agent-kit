'use strict';

// 检查一个项目的项目层：node check-project.cjs [项目目录]
const path = require('path');
const { checkProject } = require('../lib/cards.cjs');

const dir = path.resolve(process.argv[2] || process.cwd());
const { cards, findings } = checkProject(dir);
for (const f of findings) console.log(`${f.level === 'error' ? '✗ 错误' : '! 警告'}  ${f.file}：${f.message}`);
const errors = findings.filter((f) => f.level === 'error').length;
console.log(`检查 ${dir}：${cards.length} 张经验卡，${errors} 个错误，${findings.length - errors} 个警告。`);
process.exitCode = errors ? 1 : 0;
