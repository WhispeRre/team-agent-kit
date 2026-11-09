'use strict';

// 团队 kit 安装文件。由 scripts/pack.cjs 生成，发给同学后运行：
//   node <本文件>              安装或升级到 ~/.cursor/plugins/local/<插件名>/，没装 AIhero 的 skills 时顺手装上
//   node <本文件> --uninstall  卸载
//   加 --no-aihero 不装 AIhero；加 --dry-run 只打印将要做的改动
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PAYLOAD = null;

const LOCAL_PLUGINS = path.join(os.homedir(), '.cursor', 'plugins', 'local');
const PLUGIN_CACHE = path.join(os.homedir(), '.cursor', 'plugins', 'cache');
const HOOKS_FILE = path.join(os.homedir(), '.cursor', 'hooks.json');
// 安装文件是单文件，不能引用插件里的 lib/aihero.cjs，两处要一起改。
const AIHERO_INSTALL = "npx skills@latest add mattpocock/skills -g -a cursor -s '*' -y";
const AIHERO_ARGS = ['skills@latest', 'add', 'mattpocock/skills', '-g', '-a', 'cursor', '-s', '*', '-y'];

function hasAihero() {
  return ['.agents', '.cursor'].some((d) => fs.existsSync(path.join(os.homedir(), d, 'skills', 'ask-matt', 'SKILL.md')));
}

// Windows 上 npx 是 .cmd，要经过 shell 才能运行。
function npx(args) {
  return process.platform === 'win32'
    ? spawnSync(['npx', ...args].join(' '), { stdio: 'inherit', shell: true })
    : spawnSync('npx', args, { stdio: 'inherit' });
}

// Windows 上建符号链接常常没有权限，失败了就改用 --copy 再试一次。
function installAihero() {
  console.log(`\n团队工作流用 AIhero 的 skills，这台电脑还没装，现在安装（要联网，一般一两分钟）：${AIHERO_INSTALL}`);
  let result = npx(AIHERO_ARGS);
  if (result.status !== 0 && process.platform === 'win32') result = npx([...AIHERO_ARGS, '--copy']);
  return result.status === 0 && hasAihero();
}

// Cursor 会优先用团队市场装的同名插件，本地这份不生效。
function fromMarketplace(name) {
  try {
    return fs.readdirSync(PLUGIN_CACHE).some((m) => fs.existsSync(path.join(PLUGIN_CACHE, m, name)));
  } catch {
    return false;
  }
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, '.cursor-plugin', 'plugin.json'), 'utf8'));
  } catch {
    return null;
  }
}

// 目标目录已存在时，只有确认是同名插件才覆盖或删除。
function existingInstall(dest, name) {
  if (!fs.existsSync(dest)) return null;
  const manifest = readManifest(dest);
  if (!manifest || manifest.name !== name) throw new Error(`${dest} 已存在，但不是 ${name} 插件，没有动它。`);
  return manifest;
}

function install(plugin, dryRun) {
  const dest = path.join(LOCAL_PLUGINS, plugin.name);
  const existing = existingInstall(dest, plugin.name);
  let action = `安装 ${plugin.version}`;
  if (existing) action = existing.version === plugin.version ? `重新安装 ${plugin.version}` : `从 ${existing.version || '未知版本'} 升级到 ${plugin.version}`;
  const entries = Object.entries(plugin.files);
  if (dryRun) {
    console.log(`[dry-run] ${plugin.name}：将${action}，写入 ${entries.length} 个文件到 ${dest}`);
    return;
  }

  const staging = `${dest}.installing-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  for (const [rel, content] of entries) {
    const parts = rel.split('/');
    if (path.isAbsolute(rel) || parts.includes('..')) throw new Error(`安装文件里有不安全的路径：${rel}`);
    const target = path.join(staging, ...parts);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  if (existing) fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(staging, dest);
  console.log(`${plugin.name}：已${action}（${dest}）`);
}

function uninstall(plugin, dryRun) {
  const dest = path.join(LOCAL_PLUGINS, plugin.name);
  if (!existingInstall(dest, plugin.name)) {
    console.log(`${plugin.name}：没有安装`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] 将删除 ${dest}`);
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`${plugin.name}：已卸载（${dest}）`);
}

function warnIfLoadedFromRepo() {
  let hooks;
  try {
    hooks = JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf8')).hooks || {};
  } catch {
    return;
  }
  const fromRepo = (hooks.workspaceOpen || []).some((e) => e && typeof e.command === 'string' && e.command.includes('workspace-open.cjs'));
  if (fromRepo) {
    console.log('\n注意：这台电脑已经用 kit 仓库的 scripts/install.cjs 从仓库加载插件，两份同名插件会冲突。只保留一种：在仓库里运行 node scripts/install.cjs --uninstall，或者用本文件加 --uninstall 卸载。');
  }
}

function main() {
  if (!PAYLOAD) {
    console.log('这是安装文件的模板。在 kit 仓库里运行 node scripts/pack.cjs 生成可以发出去的安装文件。');
    return;
  }
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法：node <本文件> [--uninstall] [--no-aihero] [--dry-run]');
    return;
  }
  const dryRun = args.includes('--dry-run');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) console.log(`提示：当前 Node 是 ${process.versions.node}，kit 需要 18 以上，hooks 可能无法运行。`);
  console.log(`团队 kit 安装文件（${PAYLOAD.plugins.map((p) => `${p.name} ${p.version}`).join('、')}，打包于 ${PAYLOAD.builtAt}）`);

  if (args.includes('--uninstall')) {
    PAYLOAD.plugins.forEach((p) => uninstall(p, dryRun));
    console.log('重启 Cursor 或运行 Developer: Reload Window 后生效。');
    return;
  }

  PAYLOAD.plugins.forEach((p) => install(p, dryRun));
  warnIfLoadedFromRepo();
  const shadowed = PAYLOAD.plugins.filter((p) => fromMarketplace(p.name)).map((p) => p.name);
  if (shadowed.length) {
    console.log(`\n注意：这台电脑已经通过团队市场装了 ${shadowed.join('、')}，Cursor 会优先用团队市场的那份，本地这份不生效。团队成员不用运行安装文件，可以加 --uninstall 删掉本地这份。`);
  }
  const wantAihero = !hasAihero() && !args.includes('--no-aihero');
  if (dryRun) {
    if (wantAihero) console.log(`[dry-run] 将安装 AIhero 的 skills：${AIHERO_INSTALL}`);
    return;
  }
  const aihero = hasAihero() || (wantAihero && installAihero());
  const steps = [
    aihero ? null : `装团队工作流（AIhero 的 skills）：在终端运行 ${AIHERO_INSTALL}（报符号链接相关的错误时，末尾加 --copy 再运行一次）`,
    '重启 Cursor，或在命令面板运行 Developer: Reload Window。',
    '在 Cursor 的 Customize 里确认能看到 team-core 规则，以及 kickoff、learn、promote、kit-formats 四个 skill。',
    '打开一个项目，在对话里输入 /kickoff 开始；不知道下一步用哪个 skill 时输入 /ask-matt。',
  ].filter(Boolean);
  console.log(
    ['', '下一步：', ...steps.map((s, i) => `${i + 1}. ${s}`), '以后再运行一次安装命令就会升级；有新版本时，开对话时 agent 会提醒。'].join('\n'),
  );
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
