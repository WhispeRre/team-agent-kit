'use strict';

// 团队 kit 的 hook 入口，事件名由 hooks.json 作为命令行参数传入。
// 任何异常都放行：kit 的 bug 不能卡住正常工作。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const home = require('../lib/home.cjs');
const { redact } = require('../lib/secrets.cjs');
const { loadCards, isActive, matchesPlatform, matchesModel, triggerRegex } = require('../lib/cards.cjs');
const { loadPolicy, expensiveMatch, expensiveAllowedUntil } = require('../lib/policy.cjs');
const { TEMPLATE, baselineOf, baselineStatus } = require('../lib/standards.cjs');
const { AIHERO_INSTALL, findAihero } = require('../lib/aihero.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const EVENTS = ['sessionStart', 'stop', 'postToolUseFailure', 'beforeShellExecution', 'subagentStart'];
// 这些事件的输出不是合法 JSON 时 Cursor 会拦下操作，所以出错也要输出放行
const PERMISSION_EVENTS = ['beforeShellExecution', 'subagentStart'];
const ALLOW = { permission: 'allow' };
const DEFAULT_CORRECTION =
  "不对|不是这样|不是这个意思|错了|搞错|弄错|别这样|不要这样|重新来|重来|改回去|还是不行|\\bwrong\\b|\\bincorrect\\b|not what i|that's not right|\\brevert\\b";
const TRANSCRIPT_TAIL_BYTES = 4 * 1024 * 1024;
const NUDGE_MIN_FAILURES = 3;
const NUDGE_MIN_CORRECTIONS = 2;
const MAX_REMINDERS = 3;
const KICKOFF_HINTS = {
  'missing-file': '这个项目还没有验收标准 CODING_STANDARDS.md：建议运行 /kickoff 补上。',
  'missing-block': '这个项目的 CODING_STANDARDS.md 里还没有团队基线：建议运行 /kickoff 补上。',
  outdated: '团队基线更新了，这个项目 CODING_STANDARDS.md 里的还是旧版：建议运行 /kickoff 刷新。',
};
const NO_PROJECT_LAYER = '这个项目还没有团队的项目层：建议运行 /kickoff，建立 AGENTS.md 和验收标准 CODING_STANDARDS.md。';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function roots(input) {
  const list = Array.isArray(input.workspace_roots) ? input.workspace_roots.filter(Boolean) : [];
  if (!list.length && process.env.CURSOR_PROJECT_DIR) list.push(process.env.CURSOR_PROJECT_DIR);
  return list;
}

function activeCards(input) {
  const cards = [];
  for (const root of roots(input)) {
    cards.push(...loadCards(path.join(root, 'lessons')).filter((c) => isActive(c, 'project')));
  }
  cards.push(...loadCards(path.join(PLUGIN_ROOT, 'lessons')).filter((c) => isActive(c, 'kit')));
  const model = [input.model, input.model_id].filter(Boolean).join(' ');
  return cards.filter((c) => c.meta.trigger && matchesPlatform(c, process.platform) && matchesModel(c, model));
}

function matching(cards, text, modes) {
  return cards
    .filter((c) => modes.includes(c.meta.enforce || 'remind'))
    .filter((c) => {
      const re = triggerRegex(c);
      return re ? re.test(text) : false;
    })
    .slice(0, MAX_REMINDERS);
}

function describe(card) {
  const when = card.meta.applies_when && card.meta.applies_when !== 'always' ? `，前提：${card.meta.applies_when}` : '';
  return `- ${card.rule}（经验卡 ${card.meta.id}${when}）`;
}

function userText(entry) {
  const content = entry && entry.message ? entry.message.content : undefined;
  const parts = Array.isArray(content)
    ? content.filter((p) => p && p.type === 'text').map((p) => p.text || '')
    : [typeof content === 'string' ? content : ''];
  const text = parts.join('\n');
  const query = text.match(/<user_query>([\s\S]*?)<\/user_query>/);
  return query ? query[1] : text;
}

// 启发式：第一条用户消息之后，含纠正用语的用户消息条数。只用来看趋势和触发提醒。
function countCorrections(transcriptPath, pattern) {
  if (!transcriptPath) return 0;
  const { text, truncated } = home.readTail(transcriptPath, TRANSCRIPT_TAIL_BYTES);
  if (!text) return 0;
  let re;
  try {
    re = new RegExp(pattern || DEFAULT_CORRECTION, 'i');
  } catch {
    re = new RegExp(DEFAULT_CORRECTION, 'i');
  }
  const lines = text.split('\n');
  if (truncated) lines.shift();
  let users = 0;
  let count = 0;
  for (const line of lines) {
    if (!/"role"\s*:\s*"user"/.test(line)) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.role !== 'user') continue;
    users += 1;
    if (users === 1 && !truncated) continue;
    if (re.test(userText(entry))) count += 1;
  }
  return count;
}

// 每个项目只提醒一次，团队基线变了再提醒一次。后台 agent 身边没人，不占用这次提醒。
function onSessionStart(input) {
  const dir = roots(input)[0];
  if (!dir || input.is_background_agent) return {};
  const status = baselineStatus(dir);
  const aihero = Boolean(findAihero(dir));
  if (status === 'ok' && aihero) return {};

  const baseline = crypto.createHash('sha1').update(baselineOf(fs.readFileSync(TEMPLATE, 'utf8')) || '').digest('hex').slice(0, 12);
  const key = process.platform === 'win32' ? path.resolve(dir).toLowerCase() : path.resolve(dir);
  const reminded = home.readJson('kickoff-reminders.json', {});
  if (reminded[key] && reminded[key].baseline === baseline) return {};
  reminded[key] = { baseline, ts: new Date().toISOString() };
  const recent = Object.entries(reminded)
    .sort((a, b) => String(a[1] && a[1].ts).localeCompare(String(b[1] && b[1].ts)))
    .slice(-500);
  home.writeJson('kickoff-reminders.json', Object.fromEntries(recent));

  const lines = [];
  const hasAgents = ['AGENTS.md', 'CLAUDE.md'].some((f) => fs.existsSync(path.join(dir, f)));
  if (status === 'missing-file' && !hasAgents) lines.push(NO_PROJECT_LAYER);
  else if (status !== 'ok') lines.push(KICKOFF_HINTS[status]);
  if (!aihero) lines.push(`这台电脑还没装团队工作流（AIhero 的 skills）：建议在终端运行 ${AIHERO_INSTALL}`);
  return {
    additional_context: `团队 kit 的一次性提示：先照常处理用户的请求，在你的第一条回复末尾用一两句话转告用户：\n${lines.map((l) => `- ${l}`).join('\n')}`,
  };
}

function onStop(input, config) {
  const conversation = input.conversation_id || '';
  const loopCount = Number(input.loop_count) || 0;
  const corrections = countCorrections(input.transcript_path, config.correctionPattern);
  home.append('sessions.jsonl', {
    ts: new Date().toISOString(),
    conversation_id: conversation,
    generation_id: input.generation_id || '',
    model: input.model || '',
    status: input.status || '',
    loop_count: loopCount,
    workspace: roots(input)[0] || '',
    transcript_path: input.transcript_path || null,
    corrections,
  });

  if (!config.nudge || input.status !== 'completed' || loopCount > 0 || !conversation) return {};
  const state = home.readJson('state.json', {});
  const nudged = state.nudged && typeof state.nudged === 'object' ? state.nudged : {};
  if (nudged[conversation]) return {};
  const failures = home
    .readJsonl('failures.jsonl', 1024 * 1024)
    .filter((f) => f.conversation_id === conversation && !f.is_interrupt).length;
  if (failures < NUDGE_MIN_FAILURES && corrections < NUDGE_MIN_CORRECTIONS) return {};

  nudged[conversation] = new Date().toISOString();
  const recent = Object.entries(nudged)
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
    .slice(-500);
  home.writeJson('state.json', { ...state, nudged: Object.fromEntries(recent) });
  return {
    followup_message: `（团队 kit 自动提醒）这次会话里工具失败 ${failures} 次、被纠正 ${corrections} 次。按团队内核，把值得记的经验写成经验卡放进 lessons/；没有值得记的就回复"无"，然后结束。`,
  };
}

function onFailure(input) {
  const toolInput = input.tool_input;
  let command;
  if (toolInput && typeof toolInput === 'object' && typeof toolInput.command === 'string') command = toolInput.command;
  else if (typeof toolInput === 'string') command = toolInput;
  else command = JSON.stringify(toolInput || {});
  const error = String(input.error_message || '');
  const matched = input.is_interrupt
    ? []
    : matching(activeCards(input), `${input.tool_name || ''}\n${command}\n${error}`, ['remind', 'ask']);

  home.append('failures.jsonl', {
    ts: new Date().toISOString(),
    conversation_id: input.conversation_id || '',
    workspace: roots(input)[0] || '',
    tool_name: input.tool_name || '',
    failure_type: input.failure_type || '',
    is_interrupt: Boolean(input.is_interrupt),
    command: redact(command).slice(0, 300),
    error: redact(error).slice(0, 500),
    reminded: matched.map((c) => c.meta.id),
  });

  if (!matched.length) return {};
  return { additional_context: `团队经验提示：这次失败可能和下面的已知经验有关。\n${matched.map(describe).join('\n')}` };
}

function onBeforeShell(input) {
  const matched = matching(activeCards(input), String(input.command || ''), ['ask']);
  if (!matched.length) return ALLOW;
  const list = matched.map(describe).join('\n');
  return {
    permission: 'ask',
    user_message: `这个命令命中了需要确认的团队经验：\n${list}`,
    agent_message: `这个命令命中了需要人确认的经验卡，等用户确认后再继续：\n${list}`,
  };
}

// subagentStart 只支持 allow 和 deny（ask 会被当成 deny），所以高价模型直接拦下，由用户临时放开。
function onSubagentStart(input, config) {
  const model = String(input.subagent_model || '');
  const matched = expensiveMatch(model, loadPolicy());
  const denied = Boolean(matched) && !expensiveAllowedUntil(config);
  const task = redact(String(input.task || '')).replace(/\s+/g, ' ').trim();
  home.append('subagents.jsonl', {
    ts: new Date().toISOString(), conversation_id: input.parent_conversation_id || input.conversation_id || '',
    workspace: roots(input)[0] || '', subagent_type: input.subagent_type || '', model,
    parallel: Boolean(input.is_parallel_worker), expensive: Boolean(matched), denied, task: task.slice(0, 200),
  });
  if (!denied) return ALLOW;
  const script = path.join(PLUGIN_ROOT, 'scripts', 'allow-expensive.cjs');
  return {
    permission: 'deny',
    user_message: `团队 kit 拦下了一个子 agent：它要用高价模型 ${model}（任务：${task.slice(0, 80) || '未写明'}）。团队约定高价模型要你明确同意才用。确实需要的话，在终端运行 node "${script}" 2 临时放开 2 小时；否则让 agent 换个模型或缩小范围。`,
  };
}

const HANDLERS = {
  sessionStart: onSessionStart, stop: onStop, postToolUseFailure: onFailure, beforeShellExecution: onBeforeShell,
  subagentStart: onSubagentStart,
};

async function main() {
  const argEvent = process.argv.slice(1).reverse().find((a) => EVENTS.includes(a));
  let event = argEvent || '';
  let output = PERMISSION_EVENTS.includes(event) ? ALLOW : {};
  try {
    const raw = await readStdin();
    const input = raw.trim() ? JSON.parse(raw) : {};
    event = argEvent || input.hook_event_name || '';
    const handler = HANDLERS[event];
    if (handler) output = handler(input, home.readConfig()) || output;
  } catch (err) {
    try {
      home.append('hook-errors.jsonl', {
        ts: new Date().toISOString(),
        event,
        error: String((err && err.stack) || err).slice(0, 2000),
      });
    } catch {
      // 连错误日志都写不了时，照样放行
    }
  }
  if (PERMISSION_EVENTS.includes(event) && !output.permission) output = ALLOW;
  process.stdout.write(JSON.stringify(output));
}

main();
