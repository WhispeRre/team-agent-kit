'use strict';

// 维护者本机：让 Cursor 直接从这个仓库加载 kit 插件，改完重载窗口就生效。
// 给同学用 scripts/pack.cjs 打出的安装文件。
//   node scripts/install.cjs              在 ~/.cursor/hooks.json 注册 workspaceOpen hook
//   node scripts/install.cjs --uninstall  撤销
//   加 --dry-run 只打印将要做的改动
const fs = require('fs');
const os = require('os');
const path = require('path');
const home = require('../plugins/team-kit/lib/home.cjs');

const REPO = path.resolve(__dirname, '..');
const CURSOR_DIR = path.join(os.homedir(), '.cursor');
const HOOKS_FILE = path.join(CURSOR_DIR, 'hooks.json');
const LOCAL_PLUGINS = path.join(CURSOR_DIR, 'plugins', 'local');
const OPEN_SCRIPT = path.join(REPO, 'scripts', 'workspace-open.cjs');
const MARK = 'workspace-open.cjs';

function pluginNames() {
  const names = home.readConfig().plugins;
  return Array.isArray(names) && names.length ? names.map(String) : ['team-kit'];
}

function readHooks() {
  if (!fs.existsSync(HOOKS_FILE)) return { version: 1, hooks: {} };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf8'));
  } catch (err) {
    throw new Error(`${HOOKS_FILE} 不是合法的 JSON，先手动修好再安装：${err.message}`);
  }
  return { version: 1, ...parsed, hooks: parsed.hooks || {} };
}

function isOurs(entry) {
  return Boolean(entry && typeof entry.command === 'string' && entry.command.includes(MARK));
}

function writeHooks(config, dryRun) {
  const text = `${JSON.stringify(config, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] 将写入 ${HOOKS_FILE}：\n${text}`);
    return;
  }
  fs.mkdirSync(CURSOR_DIR, { recursive: true });
  if (fs.existsSync(HOOKS_FILE)) fs.copyFileSync(HOOKS_FILE, `${HOOKS_FILE}.bak`);
  fs.writeFileSync(HOOKS_FILE, text);
  console.log(`已更新 ${HOOKS_FILE}（改之前的版本备份为 hooks.json.bak）`);
}

function addHook(dryRun) {
  const config = readHooks();
  const list = (config.hooks.workspaceOpen || []).filter((e) => !isOurs(e));
  list.push({ command: `node "${OPEN_SCRIPT}"`, timeout: 10 });
  config.hooks.workspaceOpen = list;
  writeHooks(config, dryRun);
}

function removeHook(dryRun) {
  if (!fs.existsSync(HOOKS_FILE)) return false;
  const config = readHooks();
  const before = config.hooks.workspaceOpen || [];
  const after = before.filter((e) => !isOurs(e));
  if (after.length === before.length) return false;
  if (after.length) config.hooks.workspaceOpen = after;
  else delete config.hooks.workspaceOpen;
  writeHooks(config, dryRun);
  return true;
}

// 安装文件装过的同名插件会和从仓库加载的冲突；确认是同名插件才删。
function removeLocalCopy(name, dryRun) {
  const dest = path.join(LOCAL_PLUGINS, name);
  if (!fs.existsSync(dest)) return;
  let manifestName = null;
  try {
    manifestName = JSON.parse(fs.readFileSync(path.join(dest, '.cursor-plugin', 'plugin.json'), 'utf8')).name;
  } catch {
    manifestName = null;
  }
  if (manifestName !== name) {
    console.log(`${dest} 已存在，但不是 ${name} 插件，没有动它。`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] 将删除安装文件装的副本 ${dest}，避免两份同名插件`);
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`已删除安装文件装的副本 ${dest}，避免两份同名插件`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法：node scripts/install.cjs [--uninstall] [--dry-run]');
    return;
  }
  const dryRun = argv.includes('--dry-run');

  if (argv.includes('--uninstall')) {
    if (removeHook(dryRun)) console.log('已撤销。重启 Cursor 或运行 Developer: Reload Window 后生效。');
    else console.log('没有找到 install.cjs 注册的 hook，不需要撤销。');
    return;
  }

  pluginNames().forEach((name) => removeLocalCopy(name, dryRun));
  addHook(dryRun);
  if (dryRun) console.log(`[dry-run] 将在 ${home.file('config.json')} 记下 kitRepo = ${REPO}`);
  else home.updateConfig({ kitRepo: REPO });
  console.log('完成。重启 Cursor 或运行 Developer: Reload Window，然后在 Customize 里确认 team-core 规则和 kickoff、learn、promote、kit-formats 已出现。');
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
