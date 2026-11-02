'use strict';

// 把插件打包成一个可以直接发给同学的安装文件（dist/<插件名>-<版本>.cjs）。
//   node scripts/pack.cjs                  打包 marketplace.json 里的全部插件
//   node scripts/pack.cjs team-kit 3d-gen  只打包指定的插件，比如给某些同学加发领域包
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { AIHERO_INSTALL } = require(path.join(ROOT, 'plugins', 'team-kit', 'lib', 'aihero.cjs'));
const TEMPLATE = path.join(__dirname, 'installer-template.cjs');
const DIST = path.join(ROOT, 'dist');
const PLACEHOLDER = 'const PAYLOAD = null;';
const SKIP = new Set(['.DS_Store']);

function collect(dir, base = dir, files = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, base, files);
    else if (entry.isFile()) files[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
  }
  return files;
}

function main() {
  const check = spawnSync(process.execPath, [path.join(__dirname, 'kit-check.cjs')], { stdio: 'inherit' });
  if (check.status !== 0) {
    console.error('\nkit-check 没通过，先修好再打包。');
    process.exitCode = 1;
    return;
  }

  const marketplace = JSON.parse(fs.readFileSync(path.join(ROOT, '.cursor-plugin', 'marketplace.json'), 'utf8'));
  const wanted = process.argv.slice(2);
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

  const fileCount = plugins.reduce((n, p) => n + Object.keys(p.files).length, 0);
  console.log(`\n已生成 ${path.relative(ROOT, target)}（${fileCount} 个文件，${Math.ceil(Buffer.byteLength(output) / 1024)} KB）。`);
  console.log('可以连同下面这段话一起发给同学：\n');
  console.log(
    [
      `这是团队 agent kit 的安装文件 ${fileName}。`,
      '1. 确认电脑装了 Node 18 以上：在终端里输入 node -v。没有的话去 nodejs.org 下载 LTS 版。',
      `2. 在终端（Windows 用 PowerShell）里运行：node <文件所在的路径>/${fileName}`,
      `3. 装团队工作流（AIhero 的 skills，装过的跳过）：${AIHERO_INSTALL}`,
      '4. 重启 Cursor，然后在项目的对话里输入 /kickoff 开始。',
      `以后收到新版本，再运行一次就会覆盖升级。卸载：node ${fileName} --uninstall`,
    ].join('\n'),
  );
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
