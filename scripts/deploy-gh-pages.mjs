import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT_DIR = import.meta.dirname
  ? path.resolve(import.meta.dirname, '..')
  : process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function run(cmd, cwd = ROOT_DIR, opts = {}) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function tryCapture(cmd, cwd = ROOT_DIR) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function resolveOriginUrl() {
  const origin = tryCapture('git remote get-url origin');
  if (origin) return origin;

  // Fallback: inspect GitHub CLI repository URL if available
  const ghUrl = tryCapture('gh repo view --json url -q .url');
  if (ghUrl) {
    console.log(`[deploy] No git "origin" remote set; resolved repository via gh CLI: ${ghUrl}`);
    return ghUrl.endsWith('.git') ? ghUrl : `${ghUrl}.git`;
  }

  console.error('[deploy] Error: Git remote "origin" is not configured.');
  console.error('[deploy] Create a GitHub repository or set the remote, then re-run:');
  console.error('  git remote add origin https://github.com/<USER>/<REPO>.git');
  console.error('  # or with GitHub CLI:');
  console.error('  gh repo create <REPO> --public --source=. --remote=origin');
  process.exit(1);
}

function formatPagesUrl(originUrl) {
  // Handle https://github.com/user/repo(.git) and git@github.com:user/repo(.git)
  const httpsMatch = originUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (httpsMatch) {
    return `https://${httpsMatch[1]}.github.io/${httpsMatch[2]}/`;
  }
  const sshMatch = originUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `https://${sshMatch[1]}.github.io/${sshMatch[2]}/`;
  }
  return null;
}

function main() {
  console.log('[deploy] Building production bundle...');
  run('npm run build', ROOT_DIR);

  const indexHtmlPath = path.join(DIST_DIR, 'index.html');
  const swPath = path.join(DIST_DIR, 'sw.js');
  if (!fs.existsSync(indexHtmlPath) || !fs.existsSync(swPath)) {
    console.error('[deploy] Error: Build verification failed. Missing dist/index.html or dist/sw.js.');
    process.exit(1);
  }

  const originUrl = resolveOriginUrl();
  const userName = tryCapture('git config user.name') || 'OVERTONE Deploy';
  const userEmail = tryCapture('git config user.email') || 'deploy@overtone.local';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overtone-gh-pages-'));
  try {
    console.log(`[deploy] Staging dist/ in temporary directory: ${tmpDir}`);
    fs.cpSync(DIST_DIR, tmpDir, { recursive: true });

    // Ensure .nojekyll exists even if copy missed dotfiles
    const nojekyllPath = path.join(tmpDir, '.nojekyll');
    if (!fs.existsSync(nojekyllPath)) {
      fs.writeFileSync(nojekyllPath, '');
    }

    run('git init', tmpDir);
    run('git checkout -B gh-pages', tmpDir);
    run(`git config user.name ${JSON.stringify(userName)}`, tmpDir);
    run(`git config user.email ${JSON.stringify(userEmail)}`, tmpDir);
    run(`git remote add origin ${JSON.stringify(originUrl)}`, tmpDir);
    run('git add -A', tmpDir);

    const timestamp = new Date().toISOString();
    run(`git commit -m ${JSON.stringify(`Deploy OVERTONE: Chladni Survivor (${timestamp})`)}`, tmpDir);

    console.log(`[deploy] Force-pushing gh-pages to ${originUrl}...`);
    run('git push --force origin HEAD:gh-pages', tmpDir);

    console.log('[deploy] Deployment complete!');
    const pagesUrl = formatPagesUrl(originUrl);
    if (pagesUrl) {
      console.log(`[deploy] Expected GitHub Pages URL: ${pagesUrl}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
