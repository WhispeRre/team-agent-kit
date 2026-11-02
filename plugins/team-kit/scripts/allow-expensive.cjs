'use strict';

// 临时放开高价模型的子 agent。团队 kit 默认拦下 policy.json 里列出的模型。
//   node allow-expensive.cjs        放开 2 小时
//   node allow-expensive.cjs 8      放开 8 小时
//   node allow-expensive.cjs off    马上恢复拦截
const home = require('../lib/home.cjs');
const { loadPolicy, expensiveAllowedUntil } = require('../lib/policy.cjs');

function main() {
  const arg = process.argv[2] || '2';
  const models = loadPolicy().expensiveModels.join('、') || '（清单为空）';
  if (arg === 'off') {
    home.updateConfig({ allowExpensiveUntil: null });
    console.log(`已恢复拦截：用到 ${models} 的子 agent 会被拦下。`);
    return;
  }
  if (arg === 'status') {
    const until = expensiveAllowedUntil(home.readConfig());
    console.log(until ? `放开到 ${until.toLocaleString()}。` : `没有放开：用到 ${models} 的子 agent 会被拦下。`);
    return;
  }
  const hours = Number(arg);
  if (!Number.isFinite(hours) || hours <= 0) {
    console.log('用法：node allow-expensive.cjs [小时数，默认 2 | status | off]');
    process.exitCode = 1;
    return;
  }
  const until = new Date(Date.now() + hours * 3600000);
  home.updateConfig({ allowExpensiveUntil: until.toISOString() });
  console.log(`已放开到 ${until.toLocaleString()}：这段时间里用到 ${models} 的子 agent 不会被拦下，但照样记进统计。`);
}

main();
