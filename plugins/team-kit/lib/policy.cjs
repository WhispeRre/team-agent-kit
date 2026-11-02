'use strict';

// 花费策略：团队的高价模型清单在插件的 policy.json 里，随插件分发；
// 个人临时放开写在本机 config.json 的 allowExpensiveUntil，过期自动失效。
const fs = require('fs');
const path = require('path');

const POLICY_FILE = path.join(__dirname, '..', 'policy.json');
const DEFAULT_POLICY = { expensiveModels: [] };

function loadPolicy(file = POLICY_FILE) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...DEFAULT_POLICY, ...(value && typeof value === 'object' ? value : {}) };
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

// 返回命中的清单条目（不区分大小写的正则），没命中返回 null。
function expensiveMatch(model, policy) {
  if (!model) return null;
  const list = Array.isArray(policy.expensiveModels) ? policy.expensiveModels : [];
  for (const source of list) {
    try {
      if (new RegExp(source, 'i').test(model)) return source;
    } catch {
      // 不合法的条目由 kit-check 报出来，这里跳过
    }
  }
  return null;
}

function expensiveAllowedUntil(config, now = Date.now()) {
  const until = Date.parse((config && config.allowExpensiveUntil) || '');
  return Number.isFinite(until) && until > now ? new Date(until) : null;
}

module.exports = { POLICY_FILE, loadPolicy, expensiveMatch, expensiveAllowedUntil };
