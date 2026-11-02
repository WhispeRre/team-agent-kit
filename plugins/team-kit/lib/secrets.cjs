'use strict';

// 疑似密钥的模式。值以 $、<、{ 开头的视为占位符，不报。
const PATTERNS = [
  { name: 'OpenAI / Anthropic key', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Apify token', re: /\bapify_api_[A-Za-z0-9]{20,}/g },
  { name: 'Private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/g },
  {
    name: '密钥赋值',
    re: /\b(?:api[_-]?key|secret|token|password|passwd|app[_-]?secret|access[_-]?key)\b["']?\s*[:=]\s*["']([^"'\s$<{]{16,})["']/gi,
  },
];

function mask(value) {
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function findSecrets(text) {
  const hits = [];
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ name, line: text.slice(0, m.index).split('\n').length, sample: mask(m[0]) });
    }
  }
  return hits;
}

function redact(text) {
  let out = String(text);
  for (const { re } of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

module.exports = { findSecrets, redact };
