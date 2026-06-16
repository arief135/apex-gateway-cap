#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const UI_APPS = ['admin_ui', 'route_man', 'destination_man'];

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function step(msg) {
  console.log(`\n==> ${msg}`);
}

// 1. Root dependencies
step('Installing root dependencies...');
run('npm ci');

// 2. Build each UI5 app
step('Building UI5 applications...');
for (const app of UI_APPS) {
  const appDir = resolve(ROOT, 'app', app);
  console.log(`  -> Building ${app}...`);
  run('npm ci', appDir);
  run('npx ui5 build --clean-dest', appDir);
  console.log(`  -> Done: ${app}`);
}

// 3. CDS build
step('Running CDS build (production)...');
run('npx cds build --production');

// 4. Copy UI dist into gen/srv/app/
step('Copying UI5 dist files into gen/srv/app/...');
for (const app of UI_APPS) {
  const src = resolve(ROOT, 'app', app, 'dist');
  const dest = resolve(ROOT, 'gen', 'srv', 'app', app);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`  -> Copied ${app} -> gen/srv/app/${app}`);
}

// 5. Patch gen/srv/package.json for production
step('Patching gen/srv/package.json for production...');
const rootPkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const srvPkgPath = resolve(ROOT, 'gen', 'srv', 'package.json');
const srvPkg = JSON.parse(readFileSync(srvPkgPath, 'utf8'));

srvPkg.dependencies['tsx'] = rootPkg.devDependencies['tsx'];
srvPkg.dependencies['cds-plugin-ui5'] = rootPkg.devDependencies['cds-plugin-ui5'];
srvPkg.scripts = { start: srvPkg.scripts.start };
delete srvPkg.devDependencies;
delete srvPkg.sapux;

writeFileSync(srvPkgPath, JSON.stringify(srvPkg, null, 2) + '\n');
console.log('  -> tsx and cds-plugin-ui5 added to dependencies');
console.log('  -> devDependencies removed');

console.log(`
============================================
Build complete.

Copy to your server:
  gen/srv/  -> application server
  gen/pg/   -> database schema deployment

On the server:
  1. DB deploy (run once):
       cd gen/pg && npm ci && NODE_ENV=production npm start

  2. Start app server:
       cd gen/srv && npm ci && NODE_ENV=production npm start
============================================
`);
