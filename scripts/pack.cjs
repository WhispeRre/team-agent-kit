'use strict';

// 把插件打包成一个可以直接发给同学的安装文件（dist/<插件名>-<版本>.cjs）。
//   node scripts/pack.cjs                  打包 marketplace.json 里的全部插件
//   node scripts/pack.cjs team-kit 3d-gen  只打包指定的插件，比如给某些同学加发领域包
//   node scripts/pack.cjs --release        打包后发布到 GitHub Releases（需要 gh；一次只发一个插件）
//   加 --dry-run 只打印发布命令和发布说明，不真的发布
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { AIHERO_INSTALL } = require(path.join(ROOT, 'plugins', 'team-kit', 'lib', 'aihero.cjs'));
const TEMPLATE = path.join(__dirname, 'installer-template.cjs');
const DIST = path.join(ROOT, 'dist');
const PLACEHOLDER = 'const PAYLOAD = null;';
const SKIP = new Set(['.DS_Store']);
const FLAGS = ['--release', '--dry-run'];

function collect(dir, base = dir, files = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, base, files);
    else if (entry.isFile()) files[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
  }
  return files;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim() };
}

// 仓库在 GitHub 上时返回 https://github.com/<owner>/<repo>，否则返回 null。
function githubRepo() {
  const { ok, out } = run('git', ['remote', 'get-url', 'origin']);
  const m = ok && out.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

// 发布的文件要对得上远端的某个提交，所以只从推送过的主分支发布。返回不满足的条件。
function releaseBlockers(tag, head) {
  const blockers = [];
  if (!githubRepo()) blockers.push('origin 不是 GitHub 仓库');
  if (!run('gh', ['--version']).ok) blockers.push('没找到 gh：先安装 GitHub CLI，再运行 gh auth login');
  if (run('git', ['status', '--porcelain']).out) blockers.push('有未提交的改动：先提交');
  const base = run('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).out || 'origin/main';
  const remote = run('git', ['rev-parse', base]);
  if (!remote.ok || remote.out !== head) blockers.push(`当前提交和 ${base} 不一致：在主分支上推送（或拉取）后再发布`);
  if (run('gh', ['release', 'view', tag]).ok) blockers.push(`${tag} 已经发布过：先改版本号`);
  return blockers;
}

function changelogSection(name, version) {
  const lines = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${name} ${version}`);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

function installMessage(fileName, releasesUrl) {
  return [
    `这是团队 agent kit 的安装文件 ${fileName}。`,
    '1. 确认电脑装了 Node 18 以上：在终端里输入 node -v。没有的话去 nodejs.org 下载 LTS 版。',
    `2. 在终端（Windows 用 PowerShell）里运行：node <文件所在的路径>/${fileName}`,
    `3. 装团队工作流（AIhero 的 skills，装过的跳过）：${AIHERO_INSTALL}`,
    '4. 重启 Cursor，然后在项目的对话里输入 /kickoff 开始。',
    releasesUrl
      ? `以后的新版本在 ${releasesUrl} 下载，再运行一次就会覆盖升级。卸载：node ${fileName} --uninstall`
      : `以后收到新版本，再运行一次就会覆盖升级。卸载：node ${fileName} --uninstall`,
  ];
}

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a.startsWith('--') && !FLAGS.includes(a));
  if (unknown.length) {
    console.error(`不认识的参数：${unknown.join(' ')}`);
    process.exitCode = 1;
    return;
  }
  const release = args.includes('--release');
  const dryRun = args.includes('--dry-run');
  const wanted = args.filter((a) => !a.startsWith('--'));

  const check = spawnSync(process.execPath, [path.join(__dirname, 'kit-check.cjs')], { stdio: 'inherit' });
  if (check.status !== 0) {
    console.error('\nkit-check 没通过，先修好再打包。');
    process.exitCode = 1;
    return;
  }

  const marketplace = JSON.parse(fs.readFileSync(path.join(ROOT, '.cursor-plugin', 'marketplace.json'), 'utf8'));
  const missing = wanted.filter((name) => !marketplace.plugins.some((p) => p.name === name));
  if (missing.length) {
    console.error(`marketplace.json 里没有这些插件：${missing.join('、')}`);
    process.exitCode = 1;
    return;
  }
  const entries = wanted.length ? marketplace.plugins.filter((p) => wanted.includes(p.name)) : marketplace.plugins;

  const plugins = entries.map((entry) => {
    const dir = path.join(ROOT, entry.source);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.cursor-plugin', 'plugin.json'), 'utf8'));
    return { name: manifest.name, version: manifest.version || '0.0.0', files: collect(dir) };
  });

  let tag;
  let head;
  if (release) {
    if (plugins.length !== 1) {
      console.error('发布时一次只发一个插件，比如：node scripts/pack.cjs team-kit --release');
      process.exitCode = 1;
      return;
    }
    tag = `${plugins[0].name}-${plugins[0].version}`;
    head = run('git', ['rev-parse', 'HEAD']).out;
    const blockers = releaseBlockers(tag, head);
    if (blockers.length) {
      console.error(`\n${dryRun ? '[dry-run] 正式发布会在这里停下' : '没有发布'}：\n${blockers.map((b) => `- ${b}`).join('\n')}`);
      if (!dryRun) {
        process.exitCode = 1;
        return;
      }
    }
  }

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  if (!template.includes(PLACEHOLDER)) throw new Error(`模板里找不到 ${PLACEHOLDER}`);
  const payload = { builtAt: new Date().toISOString().slice(0, 10), plugins };
  const output = template.replace(PLACEHOLDER, () => `const PAYLOAD = ${JSON.stringify(payload)};`);

  const fileName =
    plugins.length === 1
      ? `${plugins[0].name}-${plugins[0].version}.cjs`
      : `${plugins.map((p) => p.name).join('+')}-${payload.builtAt}.cjs`;
  fs.mkdirSync(DIST, { recursive: true });
  const target = path.join(DIST, fileName);
  fs.writeFileSync(target, output);

  const repo = githubRepo();
  const message = installMessage(fileName, repo && `${repo}/releases/latest`);
  const fileCount = plugins.reduce((n, p) => n + Object.keys(p.files).length, 0);
  console.log(`\n已生成 ${path.relative(ROOT, target)}（${fileCount} 个文件，${Math.ceil(Buffer.byteLength(output) / 1024)} KB）。`);
  if (!release) {
    console.log('可以连同下面这段话一起发给同学：\n');
    console.log(message.join('\n'));
    return;
  }

  const { name, version } = plugins[0];
  const notes = ['## 安装', '', ...message, '', '## 这个版本改了什么', '', changelogSection(name, version) || '（CHANGELOG.md 里没有这一版的说明）'].join('\n');
  const ghArgs = ['release', 'create', tag, path.relative(ROOT, target), '--target', head, '--title', `${name} ${version}`, '--latest'];
  if (dryRun) {
    const shown = [...ghArgs, '--notes-file', '<发布说明>'].map((a) => (/[\s"']/.test(a) ? JSON.stringify(a) : a));
    console.log(`\n[dry-run] 将运行：gh ${shown.join(' ')}\n\n发布说明：\n${notes}`);
    return;
  }
  const notesFile = path.join(os.tmpdir(), `${tag}-notes.md`);
  fs.writeFileSync(notesFile, notes);
  const result = spawnSync('gh', [...ghArgs, '--notes-file', notesFile], { cwd: ROOT, stdio: 'inherit' });
  fs.rmSync(notesFile, { force: true });
  if (result.status !== 0) {
    console.error('发布失败，见上面 gh 的输出。');
    process.exitCode = 1;
    return;
  }
  console.log(`\n已发布。同学在 ${repo}/releases/latest 下载；没有仓库权限的同学，把文件和下面这段话直接发给他们：\n`);
  console.log(message.join('\n'));
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
