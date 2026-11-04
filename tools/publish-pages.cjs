// Publish the local Creator release without adding build files to the source branch.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..'), site = path.join(root, 'build/web-mobile');
const run = (args, options = {}) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git exited ${result.status}`);
  return result.stdout.trim();
};
try {
  for (const file of ['index.html', 'assets/main/index.js', 'licenses/Cocos-engine-MIT.txt']) {
    if (!fs.existsSync(path.join(site, file))) throw new Error(`Missing release file: ${file}`);
  }
  if (run(['status', '--porcelain'])) throw new Error('Commit source changes before publishing.');
  const source = run(['rev-parse', 'HEAD']);
  const remote = run(['ls-remote', '--heads', 'origin', 'gh-pages']);
  let parent;
  if (remote) {
    run(['fetch', 'origin', 'refs/heads/gh-pages']);
    parent = run(['rev-parse', 'FETCH_HEAD']);
  }
  const version = require('../package.json').version;
  fs.writeFileSync(path.join(site, '.nojekyll'), '');
  fs.writeFileSync(path.join(site, 'version.json'), JSON.stringify({ version, sourceCommit: source }, null, 2) + '\n');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'blockdig-pages-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, 'index') };
    const gitDir = run(['rev-parse', '--absolute-git-dir']);
    const siteGit = args => run(['--git-dir=' + gitDir, '--work-tree=' + site, ...args], { cwd: site, env });
    siteGit(['read-tree', '--empty']);
    siteGit(['add', '--force', '--all', '--', '.']);
    const tree = siteGit(['write-tree']);
    const commit = run(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Deploy BlockDig ${version} from ${source}`]);
    // A normal push rejects races; never force another deployment out of history.
    run(['push', 'origin', `${commit}:refs/heads/gh-pages`]);
    console.log(JSON.stringify({ version, sourceCommit: source, pagesCommit: commit }, null, 2));
  } finally {
    for (const file of ['index', 'index.lock']) {
      const target = path.join(temporary, file);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.rmdirSync(temporary);
  }
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
