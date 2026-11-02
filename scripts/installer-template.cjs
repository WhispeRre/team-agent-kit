'use strict';

// 团队 kit 安装文件。由 scripts/pack.cjs 生成，发给同学后运行：
//   node <本文件>              安装或升级到 ~/.cursor/plugins/local/<插件名>/
//   node <本文件> --uninstall  卸载
//   加 --dry-run 只打印将要做的改动
const fs = require('fs');
const os = require('os');
const path = require('path');

const PAYLOAD = null;

const LOCAL_PLUGINS = path.join(os.homedir(), '.cursor', 'plugins', 'local');
const HOOKS_FILE = path.join(os.homedir(), '.cursor', 'hooks.json');
// 安装文件是单文件，不能引用插件里的 lib/aihero.cjs，两处要一起改。
const AIHERO_INSTALL = "npx skills@latest add mattpocock/skills -g -a cursor -s '*' -y";

function hasAihero() {
  return ['.agents', '.cursor'].some((d) => fs.existsSync(path.join(os.homedir(), d, 'skills', 'ask-matt', 'SKILL.md')));
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
    console.log('用法：node <本文件> [--uninstall] [--dry-run]');
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
  if (dryRun) return;
  console.log(
    [
      '',
      '下一步：',
      hasAihero()
        ? '1. 团队工作流用 AIhero 的 skills，这台电脑已经装了。'
        : `1. 团队工作流用 AIhero 的 skills，这台电脑还没装。在终端运行：${AIHERO_INSTALL}（报符号链接相关的错误时，末尾加 --copy 再运行一次）`,
      '2. 重启 Cursor，或在命令面板运行 Developer: Reload Window。',
      '3. 在 Cursor 的 Customize 里确认能看到 team-core 规则，以及 kickoff、learn、promote、kit-formats 四个 skill。',
      '4. 打开一个项目，在对话里输入 /kickoff 开始；不知道下一步用哪个 skill 时输入 /ask-matt。',
      '以后收到新版本的安装文件，再运行一次就会覆盖升级。',
    ].join('\n'),
  );
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
