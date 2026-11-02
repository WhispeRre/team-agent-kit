'use strict';

// 经验卡的解析和校验。格式说明见 skills/kit-formats/lesson-card.md。
const fs = require('fs');
const path = require('path');
const { baselineStatus } = require('./standards.cjs');
const { AIHERO_INSTALL, findAihero } = require('./aihero.cjs');

const ENUMS = {
  level: ['project', 'team'],
  status: ['inbox', 'accepted', 'submitted', 'incoming', 'merged', 'rejected', 'stale'],
  severity: ['normal', 'high'],
  enforce: ['remind', 'ask'],
};
// obstruction 是反证：这条规则碍事了。它不算支持合并的证据，攒够了提示退役。
const SOURCES = ['correction', 'tool-error', 'retry', 'handoff', 'review', 'eval', 'outcome', 'obstruction'];
const PLATFORMS = ['darwin', 'win32', 'linux'];
const REQUIRED = ['id', 'level', 'status', 'scope', 'applies_when', 'created'];
const OPTIONAL = ['last_verified', 'severity', 'model', 'platform', 'trigger', 'enforce', 'merged_into', 'reason', 'pr', 'approved_by'];
const KNOWN = new Set([...REQUIRED, ...OPTIONAL]);

const STATUS_BY_PLACE = {
  project: ['inbox', 'accepted', 'submitted', 'rejected', 'stale'],
  incoming: ['incoming'],
  rejected: ['rejected'],
  merged: ['merged', 'stale'],
};

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function unquote(value) {
  const v = value.trim();
  const last = v[v.length - 1];
  if (v.length >= 2 && ((v[0] === '"' && last === '"') || (v[0] === "'" && last === "'"))) return v.slice(1, -1);
  return v;
}

// 只支持扁平的 key: value，以及 >- / | 开头的多行值。
function parseFrontMatter(text) {
  const m = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  const problems = [];
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (!kv) {
      problems.push(`front matter 无法解析：${line.trim()}`);
      continue;
    }
    let value = (kv[2] || '').trim();
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        i += 1;
        block.push(lines[i].trim());
      }
      value = block.join(value.startsWith('|') ? '\n' : ' ');
    }
    meta[kv[1]] = unquote(value);
  }
  return { meta, body: m[2], problems };
}

function parseEvidence(body) {
  const evidence = [];
  let inSection = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^##\s/.test(line)) {
      inSection = /^##\s+证据\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (!m) continue;
    const parts = m[1].split('|').map((s) => s.trim());
    evidence.push({ date: parts[0] || '', source: parts[1] || '', ref: parts[2] || '', note: parts.slice(3).join(' | ') });
  }
  return evidence;
}

// front matter 里同时有 id、level、status 才算经验卡，避免误读项目里其他用途的 lessons/。
function parseCard(text, file) {
  const fm = parseFrontMatter(text);
  if (!fm || !fm.meta.id || !fm.meta.level || !fm.meta.status) return null;
  const title = fm.body.match(/^#\s+(.+?)\s*$/m);
  return { file, meta: fm.meta, rule: title ? title[1] : '', evidence: parseEvidence(fm.body), problems: fm.problems };
}

function readCardDir(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return { cards: [], others: [] };
  }
  const cards = [];
  const others = [];
  for (const name of names.sort()) {
    if (!name.endsWith('.md') || name.toLowerCase() === 'readme.md') continue;
    const file = path.join(dir, name);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const card = parseCard(text, file);
    if (card) cards.push(card);
    else others.push(file);
  }
  return { cards, others };
}

function loadCards(dir) {
  return readCardDir(dir).cards;
}

function refsWhere(card, test) {
  return new Set(card.evidence.filter(test).map((e) => e.ref).filter(Boolean)).size;
}

function distinctRefs(card) {
  return refsWhere(card, (e) => e.source !== 'obstruction');
}

function counterRefs(card) {
  return refsWhere(card, (e) => e.source === 'obstruction');
}

function passesGate(card) {
  return distinctRefs(card) >= 2 || card.meta.severity === 'high' || Boolean(card.meta.approved_by);
}

// 生效的经验：项目里 accepted 的卡，插件里 merged 的卡。
function isActive(card, place) {
  return place === 'project' ? card.meta.status === 'accepted' : card.meta.status === 'merged';
}

function matchesPlatform(card, platform) {
  if (!card.meta.platform) return true;
  return card.meta.platform.split(',').map((s) => s.trim()).includes(platform);
}

// 写了 model 的经验只对匹配的模型生效；拿不到当前模型时照常生效。
function matchesModel(card, model) {
  const source = card.meta.model;
  if (!source || source === 'any' || !model) return true;
  try {
    return new RegExp(source, 'i').test(model);
  } catch {
    return true;
  }
}

const regexCache = new Map();
function triggerRegex(card) {
  const source = card.meta.trigger;
  if (!source) return null;
  if (!regexCache.has(source)) {
    let re = null;
    try {
      re = new RegExp(source, 'i');
    } catch {
      re = null;
    }
    regexCache.set(source, re);
  }
  return regexCache.get(source);
}

function validateCard(card, place) {
  const errors = [...card.problems];
  const warnings = [];
  const { meta } = card;

  for (const key of REQUIRED) if (!meta[key]) errors.push(`缺少字段 ${key}`);
  for (const key of Object.keys(meta)) if (!KNOWN.has(key)) warnings.push(`未知字段 ${key}`);

  const base = path.basename(card.file, '.md');
  if (meta.id && !ID_RE.test(meta.id)) errors.push('id 只能用小写字母、数字和连字符');
  if (meta.id && meta.id !== base) errors.push(`id（${meta.id}）和文件名（${base}）不一致`);

  for (const [key, values] of Object.entries(ENUMS)) {
    if (meta[key] && !values.includes(meta[key])) errors.push(`${key} 取值无效：${meta[key]}（可选：${values.join(' / ')}）`);
  }
  const allowed = STATUS_BY_PLACE[place];
  if (allowed && meta.status && !allowed.includes(meta.status)) {
    errors.push(`这里的卡 status 只能是 ${allowed.join(' / ')}，现在是 ${meta.status}`);
  }
  for (const key of ['created', 'last_verified']) {
    if (meta[key] && !DATE_RE.test(meta[key])) errors.push(`${key} 要写成 YYYY-MM-DD`);
  }

  if (!card.rule) errors.push('缺少标题（# 规则）');
  if (!card.evidence.length) errors.push('"## 证据"下至少要有一行证据');
  card.evidence.forEach((e, i) => {
    const n = i + 1;
    if (!DATE_RE.test(e.date)) errors.push(`第 ${n} 行证据的日期要写成 YYYY-MM-DD`);
    if (!SOURCES.includes(e.source)) errors.push(`第 ${n} 行证据的来源无效：${e.source}（可选：${SOURCES.join(' / ')}）`);
    if (!e.ref) errors.push(`第 ${n} 行证据缺少出处`);
  });

  if (meta.trigger) {
    try {
      if (new RegExp(meta.trigger, 'i').test('')) errors.push('trigger 会匹配空字符串，范围太宽');
    } catch (err) {
      errors.push(`trigger 不是合法的正则：${err.message}`);
    }
  }
  if (meta.enforce && !meta.trigger) errors.push('enforce 需要配合 trigger');
  if (meta.model && meta.model !== 'any') {
    try {
      if (new RegExp(meta.model, 'i').test('')) errors.push('model 会匹配所有模型，不需要时写 any 或不写');
    } catch (err) {
      errors.push(`model 不是合法的正则：${err.message}`);
    }
  }
  if (meta.platform) {
    for (const p of meta.platform.split(',').map((s) => s.trim())) {
      if (!PLATFORMS.includes(p)) errors.push(`platform 取值无效：${p}（可选：${PLATFORMS.join(' / ')}）`);
    }
  }

  if (meta.status === 'merged') {
    if (!meta.merged_into) errors.push('status: merged 需要 merged_into');
    if (!passesGate(card)) errors.push('没过门禁：需要两条不同出处的证据、severity: high 或 approved_by');
  }
  if (place === 'rejected' && !meta.reason) errors.push('status: rejected 需要 reason');
  if (meta.status === 'submitted' && !meta.pr) warnings.push('status: submitted 建议填 pr');

  return { errors, warnings };
}

// 项目层检查：经验卡格式，以及已确认的项目级经验是否都写进了 AGENTS.md。
function checkProject(dir) {
  const findings = [];
  const add = (level, file, message) => findings.push({ level, file: path.relative(dir, file) || '.', message });
  const { cards, others } = readCardDir(path.join(dir, 'lessons'));

  for (const file of others) add('warning', file, '不是经验卡（front matter 缺 id、level 或 status），已跳过');
  for (const card of cards) {
    const { errors, warnings } = validateCard(card, 'project');
    errors.forEach((m) => add('error', card.file, m));
    warnings.forEach((m) => add('warning', card.file, m));
  }

  // 有 trigger 的经验由 hook 在命中时提醒，不必常驻；其余要在 AGENTS.md 或 CODING_STANDARDS.md 里留一行索引。
  const needIndex = cards.filter((c) => c.meta.status === 'accepted' && c.meta.level === 'project' && !c.meta.trigger);
  const agentsFile = ['AGENTS.md', 'CLAUDE.md'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  const standardsFile = path.join(dir, 'CODING_STANDARDS.md');
  const indexFiles = [agentsFile, standardsFile].filter((f) => f && fs.existsSync(f));
  if (!indexFiles.length) {
    if (needIndex.length) add('error', dir, '有已确认的项目级经验，但项目里没有 AGENTS.md（先运行 /kickoff）');
  } else {
    const text = indexFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const where = indexFiles.length > 1 ? `${indexFiles.map((f) => path.basename(f)).join(' 和 ')} 里都` : `${path.basename(indexFiles[0])} 里`;
    for (const card of needIndex) {
      if (!text.includes(card.meta.id)) add('error', card.file, `已确认为项目级经验，但 ${where}没有引用 ${card.meta.id}`);
    }
  }
  if (agentsFile) {
    const lineCount = fs.readFileSync(agentsFile, 'utf8').split(/\r?\n/).length;
    if (lineCount > 150) add('warning', agentsFile, `${lineCount} 行，超过 150 行；只留查不到的事实和指针，判断类的挪进 CODING_STANDARDS.md，机械类的给经验卡加 trigger`);
  }

  const baseline = baselineStatus(dir);
  if (baseline === 'outdated') add('warning', standardsFile, '团队基线一节和当前 kit 不一致：运行 /kickoff 刷新');
  else if (baseline !== 'ok') add('warning', dir, 'CODING_STANDARDS.md 里没有团队基线：运行 /kickoff 补上');
  if (!findAihero(dir)) add('warning', dir, `没找到 AIhero skills（团队工作流）：运行 ${AIHERO_INSTALL}`);
  return { cards, findings };
}

module.exports = {
  ENUMS,
  SOURCES,
  parseFrontMatter,
  parseCard,
  readCardDir,
  loadCards,
  distinctRefs,
  counterRefs,
  passesGate,
  isActive,
  matchesPlatform,
  matchesModel,
  triggerRegex,
  validateCard,
  checkProject,
};
