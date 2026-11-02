'use strict';

// 导入同学用 /promote 导出的经验文件：已有同 id 的卡追加证据，新卡放进 lessons/incoming/。
//   node scripts/import-lessons.cjs <导出文件>...
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'plugins', 'team-kit', 'lib');
const { parseCard, readCardDir, validateCard } = require(path.join(LIB, 'cards.cjs'));
const { findSecrets } = require(path.join(LIB, 'secrets.cjs'));

const DELIMITER = /^<!--\s*team-kit:card\s*-->[ \t]*$/m;
const INCOMING = path.join(ROOT, 'lessons', 'incoming');

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const evidenceKey = (e) => `${e.date}|${e.source}|${e.ref}`;
const evidenceLine = (e) => `- ${[e.date, e.source, e.ref].concat(e.note ? [e.note] : []).join(' | ')}`;

function knownCards() {
  const dirs = [INCOMING, path.join(ROOT, 'lessons', 'rejected')];
  for (const d of fs.readdirSync(path.join(ROOT, 'plugins'), { withFileTypes: true })) {
    if (d.isDirectory()) dirs.push(path.join(ROOT, 'plugins', d.name, 'lessons'));
  }
  const map = new Map();
  for (const dir of dirs) for (const card of readCardDir(dir).cards) map.set(card.meta.id, card);
  return map;
}

// 改 front matter 里的一个字段；value 为 null 时删除该字段。
function setField(text, key, value) {
  const m = text.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/);
  if (!m) return text;
  let found = false;
  const lines = [];
  for (const line of m[2].split(/\r?\n/)) {
    if (line.startsWith(`${key}:`)) {
      found = true;
      if (value !== null) lines.push(`${key}: ${value}`);
    } else {
      lines.push(line);
    }
  }
  if (!found && value !== null) lines.push(`${key}: ${value}`);
  return `${m[1]}${lines.join('\n')}${m[3]}${text.slice(m[0].length)}`;
}

function appendEvidence(text, newLines) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+证据\s*$/.test(l));
  if (start === -1) return `${text.trimEnd()}\n\n## 证据\n${newLines.join('\n')}\n`;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  let insertAt = end;
  while (insertAt > start + 1 && !lines[insertAt - 1].trim()) insertAt -= 1;
  lines.splice(insertAt, 0, ...newLines);
  return lines.join('\n');
}

function importCard(chunk, known, stats) {
  const card = parseCard(chunk, 'imported.md');
  if (!card) {
    stats.skipped += 1;
    console.log(`✗ 跳过：不是经验卡（${chunk.split('\n').find((l) => l.startsWith('# ')) || chunk.slice(0, 40)}）`);
    return;
  }
  const { id } = card.meta;
  const secrets = findSecrets(chunk);
  if (secrets.length) {
    stats.skipped += 1;
    console.log(`✗ 跳过 ${id}：疑似含密钥（${secrets.map((s) => s.name).join('、')}），请提交人脱敏后重发`);
    return;
  }

  const existing = known.get(id);
  if (existing) {
    const have = new Set(existing.evidence.map(evidenceKey));
    const fresh = card.evidence.filter((e) => !have.has(evidenceKey(e)));
    if (!fresh.length) {
      console.log(`· ${id}：证据都已存在（${rel(existing.file)}）`);
      return;
    }
    let out = appendEvidence(fs.readFileSync(existing.file, 'utf8'), fresh.map(evidenceLine));
    const support = fresh.filter((e) => e.source !== 'obstruction');
    const latest = [existing.meta.last_verified, ...support.map((e) => e.date)].filter(Boolean).sort().pop();
    if (latest) out = setField(out, 'last_verified', latest);
    fs.writeFileSync(existing.file, out);
    known.set(id, parseCard(out, existing.file));
    stats.updated += 1;
    console.log(`+ ${id}：追加 ${fresh.length} 条证据到 ${rel(existing.file)}`);
    return;
  }

  let out = setField(setField(chunk, 'status', 'incoming'), 'pr', null);
  if (!out.endsWith('\n')) out += '\n';
  const target = path.join(INCOMING, `${id}.md`);
  const parsed = parseCard(out, target);
  const { errors } = validateCard(parsed, 'incoming');
  if (errors.length) {
    stats.skipped += 1;
    console.log(`✗ 跳过 ${id}：${errors.join('；')}`);
    return;
  }
  fs.mkdirSync(INCOMING, { recursive: true });
  fs.writeFileSync(target, out);
  known.set(id, parsed);
  stats.added += 1;
  console.log(`+ ${id}：新卡，放进 ${rel(target)}`);
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.log('用法：node scripts/import-lessons.cjs <导出文件>...');
    return;
  }
  const known = knownCards();
  const stats = { added: 0, updated: 0, skipped: 0 };
  for (const file of files) {
    const chunks = fs
      .readFileSync(file, 'utf8')
      .split(DELIMITER)
      .slice(1)
      .map((c) => c.trim())
      .filter(Boolean);
    console.log(`${file}：${chunks.length} 张卡`);
    if (!chunks.length) console.log('✗ 没有找到用 <!-- team-kit:card --> 分隔的经验卡');
    for (const chunk of chunks) importCard(chunk, known, stats);
  }
  console.log(`\n新卡 ${stats.added} 张，补证据 ${stats.updated} 张，跳过 ${stats.skipped} 张。接着运行 node scripts/kit-check.cjs，然后 /curate。`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
