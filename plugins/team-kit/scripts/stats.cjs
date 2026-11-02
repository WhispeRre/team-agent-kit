'use strict';

// 会话统计：读本机的会话索引、失败日志和子 agent 记录，按会话汇总轮数、纠正次数、工具失败次数、
// 子 agent 个数，以及有没有用到高价模型（清单见插件的 policy.json）。
// node stats.cjs [--workspace <项目目录>] [--days 28] [--list N]
const path = require('path');
const home = require('../lib/home.cjs');
const { loadCards } = require('../lib/cards.cjs');
const { loadPolicy, expensiveMatch } = require('../lib/policy.cjs');

function parseArgs(argv) {
  const args = { workspace: null, days: 28, list: 0, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--workspace') args.workspace = path.resolve(argv[++i] || '.');
    else if (a === '--days') args.days = Number(argv[++i]) || args.days;
    else if (a === '--list') args.list = Number(argv[++i]) || 10;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function sameDir(a, b) {
  if (!a || !b) return false;
  const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '');
  return process.platform === 'linux' ? norm(a) === norm(b) : norm(a).toLowerCase() === norm(b).toLowerCase();
}

function weekOf(iso) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function summarize(sessions) {
  const n = sessions.length;
  const avg = (key) => (n ? (sessions.reduce((sum, s) => sum + s[key], 0) / n).toFixed(1) : '-');
  return {
    n,
    turns: avg('turns'),
    corrections: avg('corrections'),
    failures: avg('failures'),
    subagents: avg('subagents'),
    expensive: sessions.filter((s) => s.expensive).length,
    denied: sessions.reduce((sum, s) => sum + s.denied, 0),
  };
}

function collect(workspace) {
  const policy = loadPolicy();
  const stops = home.readJsonl('sessions.jsonl', 32 * 1024 * 1024).filter((r) => !workspace || sameDir(r.workspace, workspace));
  const byConversation = new Map();
  for (const r of stops) {
    if (!r.conversation_id || !r.ts) continue;
    const s = byConversation.get(r.conversation_id) || {
      first: r.ts,
      last: r.ts,
      generations: new Set(),
      models: new Set(),
      corrections: 0,
      failures: 0,
      subagents: 0,
      expensiveSubagents: 0,
      denied: 0,
      transcript: null,
    };
    if (r.ts < s.first) s.first = r.ts;
    if (r.ts > s.last) s.last = r.ts;
    if (r.generation_id) s.generations.add(r.generation_id);
    if (r.model) s.models.add(r.model);
    s.corrections = Math.max(s.corrections, Number(r.corrections) || 0);
    s.transcript = r.transcript_path || s.transcript;
    byConversation.set(r.conversation_id, s);
  }
  for (const f of home.readJsonl('failures.jsonl', 8 * 1024 * 1024)) {
    const s = byConversation.get(f.conversation_id);
    if (s && !f.is_interrupt) s.failures += 1;
  }
  for (const a of home.readJsonl('subagents.jsonl', 8 * 1024 * 1024)) {
    const s = byConversation.get(a.conversation_id);
    if (!s) continue;
    if (a.denied) {
      s.denied += 1;
    } else {
      s.subagents += 1;
      if (a.expensive) s.expensiveSubagents += 1;
    }
  }
  return [...byConversation.values()]
    .map((s) => ({
      ...s,
      turns: Math.max(1, s.generations.size),
      expensive: s.expensiveSubagents > 0 || [...s.models].some((m) => expensiveMatch(m, policy)),
    }))
    .sort((a, b) => (a.last < b.last ? 1 : -1));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('用法：node stats.cjs [--workspace <项目目录>] [--days 28] [--list N]');
    return;
  }
  const sessions = collect(args.workspace);

  if (args.list) {
    for (const s of sessions.slice(0, args.list)) {
      const when = s.last.slice(0, 16).replace('T', ' ');
      const model = [...s.models].join(',') || '模型未知';
      const cost = `子 agent ${s.subagents}${s.expensive ? '  用了高价模型' : ''}${s.denied ? `  拦下 ${s.denied}` : ''}`;
      console.log(`${when}  ${model}  ${s.turns} 轮  纠正 ${s.corrections}  失败 ${s.failures}  ${cost}  ${s.transcript || '(没有 transcript 路径)'}`);
    }
    if (!sessions.length) console.log('没有会话记录。');
    return;
  }

  const since = new Date(Date.now() - args.days * 86400000).toISOString();
  const recent = sessions.filter((s) => s.last >= since);
  const scope = args.workspace ? `项目 ${args.workspace}` : '全部项目';
  const total = summarize(recent);
  console.log(
    `最近 ${args.days} 天，${scope}：${total.n} 次会话，平均 ${total.turns} 轮、纠正 ${total.corrections} 次、` +
      `工具失败 ${total.failures} 次、子 agent ${total.subagents} 个；用到高价模型的会话 ${total.expensive} 次，` +
      `拦下高价子 agent ${total.denied} 次。`,
  );

  if (!recent.length) {
    console.log('没有会话记录：确认 kit 插件已安装、hooks 已生效（Cursor 设置里的 Hooks 页），并且至少完成过一次对话。');
  } else {
    const weeks = new Map();
    for (const s of recent) {
      const w = weekOf(s.last);
      if (!weeks.has(w)) weeks.set(w, []);
      weeks.get(w).push(s);
    }
    console.log('\n| 周一 | 会话 | 平均轮数 | 平均纠正 | 平均失败 | 平均子 agent | 高价会话 |\n|---|---|---|---|---|---|---|');
    for (const w of [...weeks.keys()].sort()) {
      const t = summarize(weeks.get(w));
      console.log(`| ${w} | ${t.n} | ${t.turns} | ${t.corrections} | ${t.failures} | ${t.subagents} | ${t.expensive} |`);
    }
  }

  if (args.workspace) {
    const counts = {};
    for (const card of loadCards(path.join(args.workspace, 'lessons'))) counts[card.meta.status] = (counts[card.meta.status] || 0) + 1;
    const parts = Object.entries(counts).map(([status, n]) => `${status} ${n}`);
    console.log(`\n经验卡：${parts.length ? parts.join('，') : '还没有'}`);
  }
}

main();
