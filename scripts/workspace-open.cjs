'use strict';

// workspaceOpen hook：让 Cursor 直接从这个仓库加载 kit 插件。由 scripts/install.cjs 注册到 ~/.cursor/hooks.json。
const fs = require('fs');
const path = require('path');
const home = require('../plugins/team-kit/lib/home.cjs');

const REPO = path.resolve(__dirname, '..');
const names = home.readConfig().plugins;
const pluginPaths = (Array.isArray(names) && names.length ? names : ['team-kit'])
  .map((name) => path.join(REPO, 'plugins', String(name)))
  .filter((dir) => fs.existsSync(path.join(dir, '.cursor-plugin', 'plugin.json')));

process.stdout.write(JSON.stringify({ pluginPaths }));
