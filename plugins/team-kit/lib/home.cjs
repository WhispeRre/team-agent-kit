'use strict';

// kit 在本机的数据目录：会话索引、失败日志、状态和个人配置。这些文件不离开本机。
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = process.env.TEAM_KIT_HOME || path.join(os.homedir(), '.team-kit');

const DEFAULT_CONFIG = {
  kitRepo: null,
  nudge: false,
  plugins: ['team-kit'],
  correctionPattern: null,
  allowExpensiveUntil: null,
};

function file(name) {
  return path.join(DIR, name);
}

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function append(name, record) {
  ensureDir();
  fs.appendFileSync(file(name), `${JSON.stringify(record)}\n`);
}

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  ensureDir();
  const target = file(name);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, target);
}

// 只读末尾 maxBytes，日志和 transcript 变大后 hook 依然很快。
function readTail(target, maxBytes) {
  let fd;
  try {
    fd = fs.openSync(target, 'r');
    const { size } = fs.fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return { text: buf.toString('utf8'), truncated: start > 0 };
  } catch {
    return { text: '', truncated: false };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function readJsonl(name, maxBytes = 8 * 1024 * 1024) {
  const { text, truncated } = readTail(file(name), maxBytes);
  const lines = text.split('\n');
  if (truncated) lines.shift();
  const records = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // 写到一半的行
    }
  }
  return records;
}

function readConfig() {
  return { ...DEFAULT_CONFIG, ...readJson('config.json', {}) };
}

function updateConfig(patch) {
  const next = { ...readJson('config.json', {}), ...patch };
  writeJson('config.json', next);
  return next;
}

module.exports = { DIR, file, append, readJson, writeJson, readTail, readJsonl, readConfig, updateConfig };
