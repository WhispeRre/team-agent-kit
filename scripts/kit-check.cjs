'use strict';

// kit 仓库的确定性检查：结构、格式、门禁、预算和密钥。CI 和 /curate 都会跑。
//   node scripts/kit-check.cjs                    检查 kit 仓库
//   node scripts/kit-check.cjs --project <目录>   检查一个项目的项目层
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'plugins', 'team-kit', 'lib');
const { parseFrontMatter, readCardDir, validateCard, checkProject, counterRefs } = require(path.join(LIB, 'cards.cjs'));
const { findSecrets } = require(path.join(LIB, 'secrets.cjs'));
const { TEMPLATE: BASELINE_TEMPLATE, baselineOf } = require(path.join(LIB, 'standards.cjs'));

const ALWAYS_APPLY_REFERENCE = 600; // 所有插件常驻规则正文的字数参考值：超过只提醒，不拦
const SKILL_MAX_LINES = 500;
const PLUGIN_NAME = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const COMPONENT_FIELDS = ['rules', 'agents', 'skills', 'commands', 'hooks', 'mcpServers'];
const POLICY_FIELDS = new Set(['expensiveModels']);
const HOOK_EVENTS = new Set([
  'sessionStart', 'sessionEnd', 'workspaceOpen', 'preToolUse', 'postToolUse', 'postToolUseFailure',
  'subagentStart', 'subagentStop', 'beforeShellExecution', 'afterShellExecution', 'beforeMCPExecution',
  'afterMCPExecution', 'beforeReadFile', 'afterFileEdit', 'beforeSubmitPrompt', 'preCompact', 'stop',
  'afterAgentResponse', 'afterAgentThought', 'beforeTabFileRead', 'afterTabFileEdit',
]);
const SCAN_SKIP_DIRS = new Set(['.git', 'node_modules']);
const SCAN_SKIP_FILES = new Set(['.DS_Store']);
const SCAN_SKIP_PATHS = ['dist', 'intake/inbox', 'intake/processed', 'plugins/team-kit/lib/secrets.cjs'];
const SCAN_EXTENSIONS = new Set([
  '', '.md', '.mdc', '.markdown', '.json', '.cjs', '.mjs', '.js', '.ts', '.yml', '.yaml',
  '.txt', '.sh', '.ps1', '.py', '.toml', '.env', '.ini', '.cfg',
]);
const MD_LINK = /\]\(([^)\s]+)\)/g;

const findings = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/') || '.';
const error = (p, message) => findings.push({ level: 'error', file: rel(p), message });
const warn = (p, message) => findings.push({ level: 'warning', file: rel(p), message });

function readJsonFile(file) {
  if (!fs.existsSync(file)) {
    error(file, '文件不存在');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    error(file, `JSON 解析失败：${err.message}`);
    return null;
  }
}

function listDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(dir, d.name))
      .sort();
  } catch {
    return [];
  }
}

function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SCAN_SKIP_DIRS.has(entry.name)) files.push(...listFiles(full));
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function isInsideRelative(p) {
  return typeof p === 'string' && p.length > 0 && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');
}

function checkMarketplace() {
  const file = path.join(ROOT, '.cursor-plugin', 'marketplace.json');
  const m = readJsonFile(file);
  if (!m) return [];
  if (!m.name || !PLUGIN_NAME.test(m.name)) error(file, 'name 需要是小写字母、数字和连字符');
  if (!m.owner || !m.owner.name) error(file, '缺少 owner.name');
  if (!Array.isArray(m.plugins) || !m.plugins.length) {
    error(file, 'plugins 不能为空');
    return [];
  }
  const names = new Set();
  const plugins = [];
  for (const entry of m.plugins) {
    if (!entry || !entry.name || !PLUGIN_NAME.test(entry.name)) {
      error(file, `插件名无效：${entry && entry.name}`);
      continue;
    }
    if (names.has(entry.name)) error(file, `插件名重复：${entry.name}`);
    names.add(entry.name);
    const source = typeof entry.source === 'string' ? entry.source : entry.source && entry.source.path;
    if (!isInsideRelative(source)) {
      error(file, `${entry.name} 的 source 需要是仓库内的相对路径`);
      continue;
    }
    const dir = path.join(ROOT, source);
    const manifest = path.join(dir, '.cursor-plugin', 'plugin.json');
    if (!fs.existsSync(manifest)) {
      error(file, `${entry.name}：${source} 下没有 .cursor-plugin/plugin.json`);
      continue;
    }
    plugins.push({ name: entry.name, dir, manifest });
  }
  return plugins;
}

function checkRules(dir, ctx) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(mdc|md|markdown)$/.test(f));
  } catch {
    return;
  }
  for (const f of files) {
    const file = path.join(dir, f);
    const fm = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    if (!fm) {
      error(file, '缺少 front matter');
      continue;
    }
    if (!fm.meta.description) warn(file, '建议写 description');
    if (String(fm.meta.alwaysApply) === 'true') {
      ctx.alwaysApply.push({ file, chars: [...fm.body.split(/\r?\n/).filter((l) => l.trim()).join('')].length });
    }
  }
}

function checkPolicy(dir, ctx) {
  const file = path.join(dir, 'policy.json');
  if (!fs.existsSync(file)) return;
  const policy = readJsonFile(file);
  if (!policy) return;
  if (typeof policy !== 'object' || Array.isArray(policy)) {
    error(file, '需要是一个 JSON 对象');
    return;
  }
  for (const key of Object.keys(policy)) if (!POLICY_FIELDS.has(key)) warn(file, `不认识的字段：${key}`);
  const list = policy.expensiveModels;
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    error(file, 'expensiveModels 需要是字符串数组');
    return;
  }
  for (const source of list) {
    if (typeof source !== 'string' || !source.trim()) {
      error(file, 'expensiveModels 里有空的或不是字符串的条目');
      continue;
    }
    let re;
    try {
      re = new RegExp(source, 'i');
    } catch (err) {
      error(file, `expensiveModels 的正则不合法：${source}（${err.message}）`);
      continue;
    }
    if (re.test('')) error(file, `expensiveModels 的正则会匹配所有模型：${source}`);
    else ctx.expensiveModels.push({ source, re });
  }
}

// 写死高价模型的 skill 会让每次调用都花大钱，这里只提醒，是否合理由人判断。
// SOURCE.md 是来源说明，需要如实引用原稿用的模型，不查。
function warnExpensiveModels(dir, ctx) {
  for (const file of listFiles(dir).filter((f) => path.basename(f) !== 'SOURCE.md')) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const { source, re } of ctx.expensiveModels) {
      const i = lines.findIndex((line) => re.test(line));
      if (i !== -1) warn(file, `第 ${i + 1} 行提到高价模型（${source}）：确认它不会默认用这个模型启动子 agent`);
    }
  }
}

function checkSkill(dir, severity, ctx) {
  warnExpensiveModels(dir, ctx);
  const report = severity === 'error' ? error : warn;
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(file)) {
    warn(dir, '目录里没有 SKILL.md');
    return;
  }
  const fm = parseFrontMatter(fs.readFileSync(file, 'utf8'));
  if (!fm) {
    report(file, '缺少 front matter');
    return;
  }
  const { name, description } = fm.meta;
  const base = path.basename(dir);
  if (!name) {
    report(file, '缺少 name');
  } else {
    if (!SKILL_NAME.test(name) || name.length > 64) report(file, `name 只能用小写字母、数字和连字符，最长 64 个字符：${name}`);
    if (name !== base) report(file, `name（${name}）和目录名（${base}）不一致`);
  }
  if (!description) report(file, '缺少 description');
  else if (description.length > 1024) report(file, `description 有 ${description.length} 个字符，超过 1024`);
  const lines = fm.body.split(/\r?\n/).length;
  if (lines > SKILL_MAX_LINES) report(file, `正文 ${lines} 行，超过 ${SKILL_MAX_LINES} 行；把参考内容拆到同目录的文件里`);
  for (const m of fm.body.matchAll(MD_LINK)) {
    const target = m[1].split('#')[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      // 保留原样
    }
    if (!fs.existsSync(path.join(dir, decoded))) report(file, `链接指向的文件不存在：${target}`);
  }
}

function checkHooks(file) {
  const h = readJsonFile(file);
  if (!h) return;
  if (h.version !== 1) error(file, 'version 需要是 1');
  if (!h.hooks || typeof h.hooks !== 'object') {
    error(file, '缺少 hooks 对象');
    return;
  }
  for (const [event, entries] of Object.entries(h.hooks)) {
    if (!HOOK_EVENTS.has(event)) warn(file, `不认识的 hook 事件：${event}`);
    if (!Array.isArray(entries)) {
      error(file, `${event} 需要是数组`);
      continue;
    }
    entries.forEach((e, i) => {
      if (!e || typeof e.command !== 'string' || !e.command.trim()) error(file, `${event}[${i}] 缺少 command`);
    });
  }
}

function checkLessonDir(dir, place, ctx) {
  const { cards, others } = readCardDir(dir);
  for (const file of others) error(file, '不是合法的经验卡（front matter 需要有 id、level、status）');
  for (const card of cards) {
    const { errors, warnings } = validateCard(card, place);
    errors.forEach((m) => error(card.file, m));
    warnings.forEach((m) => warn(card.file, m));
    const previous = ctx.ids.get(card.meta.id);
    if (previous) warn(card.file, `id 和 ${rel(previous)} 重复：同一条经验应该追加证据，而不是出现两张卡`);
    else ctx.ids.set(card.meta.id, card.file);
  }
  ctx.counts[place] = (ctx.counts[place] || 0) + cards.length;
  return cards;
}

function checkMergedLessons(dir, ctx) {
  for (const card of checkLessonDir(dir, 'merged', ctx)) {
    if (card.meta.status !== 'merged') continue;
    ctx.mergedIds.add(card.meta.id);
    if (!fs.existsSync(path.join(ROOT, 'evals', 'cases', `${card.meta.id}.md`))) {
      error(card.file, `已合并的经验缺少回归用例 evals/cases/${card.meta.id}.md`);
    }
    if (card.meta.merged_into && !fs.existsSync(path.join(ROOT, card.meta.merged_into))) {
      warn(card.file, `merged_into 指向的文件不存在：${card.meta.merged_into}`);
    }
    const counter = counterRefs(card);
    if (counter >= 2) warn(card.file, `有 ${counter} 条不同出处的反证（obstruction）：考虑放宽或退役`);
  }
}

function checkPlugin({ name, dir, manifest }, ctx) {
  const p = readJsonFile(manifest);
  if (!p) return;
  if (p.name !== name) error(manifest, `name（${p.name}）和 marketplace.json 里的（${name}）不一致`);
  if (!p.version) warn(manifest, '建议写 version');
  else if (!SEMVER.test(p.version)) error(manifest, `version 不是语义化版本：${p.version}`);
  ctx.versions.push({ name: p.name || name, version: p.version });

  for (const field of COMPONENT_FIELDS) {
    const value = p[field];
    if (value === undefined || (value && typeof value === 'object' && !Array.isArray(value))) continue;
    for (const item of [].concat(value)) {
      if (typeof item !== 'string') continue;
      if (!isInsideRelative(item)) error(manifest, `${field} 需要是插件内的相对路径：${item}`);
      else if (!fs.existsSync(path.join(dir, item))) error(manifest, `${field} 指向的路径不存在：${item}`);
    }
  }

  checkRules(path.join(dir, typeof p.rules === 'string' ? p.rules : 'rules'), ctx);
  const skills = listDirs(path.join(dir, typeof p.skills === 'string' ? p.skills : 'skills'));
  skills.forEach((s) => checkSkill(s, 'error', ctx));
  ctx.skillCount += skills.length;
  const hooksFile = path.join(dir, typeof p.hooks === 'string' ? p.hooks : path.join('hooks', 'hooks.json'));
  if (fs.existsSync(hooksFile)) checkHooks(hooksFile);
  checkMergedLessons(path.join(dir, 'lessons'), ctx);
}

function checkEvalCases(ctx) {
  const dir = path.join(ROOT, 'evals', 'cases');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');
  } catch {
    return;
  }
  for (const f of files) {
    const file = path.join(dir, f);
    const fm = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    if (!fm) {
      error(file, '缺少 front matter');
      continue;
    }
    const { id, lesson, target } = fm.meta;
    if (id !== path.basename(f, '.md')) error(file, 'id 需要和文件名一致');
    if (!lesson) error(file, '缺少 lesson');
    else if (!ctx.mergedIds.has(lesson)) warn(file, `lesson ${lesson} 不是任何插件里已合并的经验`);
    if (!target) error(file, '缺少 target');
    else if (!fs.existsSync(path.join(ROOT, target))) warn(file, `target 指向的文件不存在：${target}`);
    if (!/^##\s+场景\s*$/m.test(fm.body)) error(file, '缺少"## 场景"');
    const expectSection = fm.body.split(/^##\s+期望\s*$/m)[1];
    const expectBody = expectSection ? expectSection.split(/^##\s/m)[0] : '';
    if (!/^\s*-\s+\S/m.test(expectBody)) error(file, '"## 期望"下至少要有一条');
  }
}

function scanSecrets(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const r = rel(full);
    if (SCAN_SKIP_PATHS.some((p) => r === p || r.startsWith(`${p}/`))) continue;
    if (entry.isDirectory()) {
      if (!SCAN_SKIP_DIRS.has(entry.name)) scanSecrets(full);
      continue;
    }
    if (!entry.isFile() || SCAN_SKIP_FILES.has(entry.name)) continue;
    if (!SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (fs.statSync(full).size > 1024 * 1024) continue;
    for (const hit of findSecrets(fs.readFileSync(full, 'utf8'))) {
      error(full, `第 ${hit.line} 行疑似 ${hit.name}（${hit.sample}）；密钥只写放在哪`);
    }
  }
}

function checkBaselineTemplate() {
  if (!fs.existsSync(BASELINE_TEMPLATE)) {
    error(BASELINE_TEMPLATE, '缺少验收标准模板，/kickoff 靠它给项目建 CODING_STANDARDS.md');
  } else if (baselineOf(fs.readFileSync(BASELINE_TEMPLATE, 'utf8')) === null) {
    error(BASELINE_TEMPLATE, '团队基线没有用 <!-- team-kit:baseline --> 和 <!-- /team-kit:baseline --> 包起来，项目检查靠它判断基线是否过期');
  }
}

function checkChangelog(ctx) {
  const file = path.join(ROOT, 'CHANGELOG.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const { name, version } of ctx.versions) {
    if (version && !text.includes(`## ${name} ${version}`)) warn(file, `没有"## ${name} ${version}"这一节`);
  }
}

function print(list) {
  for (const f of list) console.log(`${f.level === 'error' ? '✗ 错误' : '! 警告'}  ${f.file}：${f.message}`);
  const errors = list.filter((f) => f.level === 'error').length;
  return { errors, warnings: list.length - errors };
}

function checkProjectMode(dirArg) {
  const dir = path.resolve(dirArg || process.cwd());
  const { cards, findings: list } = checkProject(dir);
  console.log(`kit-check：项目 ${dir}`);
  const { errors, warnings } = print(list);
  console.log(`${cards.length} 张经验卡。结果：${errors} 个错误，${warnings} 个警告。`);
  return errors;
}

function checkKit() {
  const ctx = {
    versions: [], alwaysApply: [], ids: new Map(), mergedIds: new Set(), counts: {}, skillCount: 0, expensiveModels: [],
  };
  const plugins = checkMarketplace();
  plugins.forEach((p) => checkPolicy(p.dir, ctx));
  plugins.forEach((p) => checkPlugin(p, ctx));

  const alwaysChars = ctx.alwaysApply.reduce((sum, r) => sum + r.chars, 0);
  if (alwaysChars > ALWAYS_APPLY_REFERENCE) {
    ctx.alwaysApply.forEach((r) =>
      warn(r.file, `常驻规则正文合计 ${alwaysChars} 字，超过参考值 ${ALWAYS_APPLY_REFERENCE} 字：逐句看删掉后行为会不会变；做法放进 skill，判断类放进验收标准，机械类做成 hook`),
    );
  }
  checkBaselineTemplate();

  listDirs(path.join(ROOT, '.cursor', 'skills')).forEach((s) => checkSkill(s, 'error', ctx));
  listDirs(path.join(ROOT, 'drafts')).forEach((s) => checkSkill(s, 'warning', ctx));
  checkLessonDir(path.join(ROOT, 'lessons', 'incoming'), 'incoming', ctx);
  checkLessonDir(path.join(ROOT, 'lessons', 'rejected'), 'rejected', ctx);
  checkEvalCases(ctx);
  scanSecrets(ROOT);
  checkChangelog(ctx);

  console.log(`kit-check：${ROOT}`);
  const { errors, warnings } = print(findings);
  console.log(
    `插件 ${plugins.length} 个，skill ${ctx.skillCount} 个；常驻规则 ${alwaysChars} 字（参考 ${ALWAYS_APPLY_REFERENCE}）；` +
      `经验卡：待整理 ${ctx.counts.incoming || 0}、已合并 ${ctx.counts.merged || 0}、被拒 ${ctx.counts.rejected || 0}。`,
  );
  console.log(`结果：${errors} 个错误，${warnings} 个警告。`);
  return errors;
}

const argv = process.argv.slice(2);
const projectIndex = argv.indexOf('--project');
const errorCount = projectIndex === -1 ? checkKit() : checkProjectMode(argv[projectIndex + 1]);
process.exitCode = errorCount ? 1 : 0;
