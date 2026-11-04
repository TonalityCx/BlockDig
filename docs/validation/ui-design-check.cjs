// Documentation/target-layout checks only; does not launch Cocos or a browser.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const version = JSON.parse(read('package.json')).version;
assert(version === '0.1.1', 'Re-review the design baseline after a software-version change.');
const docs = ['README.md', '手机界面与素材.md', '资源来源与许可.md', '产品需求文档.md', '技术方案.md', 'CHANGELOG.md', '验收记录.md'];
const design = read('docs/手机界面与素材.md');
const samples = [
  [320, 568, 0, 0, 0, 0, 16], [360, 640, 0, 0, 0, 0, 16],
  [390, 844, 0, 0, 0, 0, 25], [430, 932, 0, 0, 0, 0, 29.5],
  [320, 568, 47, 34, 0, 0, 12], [390, 844, 47, 34, 0, 0, 21],
  [390, 844, 47, 34, 12, 12, 21],
];
function layout(w, h, st = 0, sb = 0, sl = 0, sr = 0) {
  const ws = w - sl - sr, hs = h - st - sb, c = Math.min(ws - 32, 420);
  const a = hs < 640 ? 88 : hs < 720 ? 144 : 164, k = hs < 640 ? 140 : 156;
  const s = Math.floor(2 * Math.min((c - 70) / 10, (hs - a - k - 16) / 20)) / 2;
  return { viewport: [w, h], safe: [st, sb, sl, sr], available: [ws, hs], cell: s,
    board: [10 * s, 20 * s], boardLeft: sl + ws / 2 - 5 * s - 23,
    boardTop: st + a + 8, controlsTop: st + hs - k,
    mainKey: [(c - 24) / 4, hs < 640 ? 52 : 55],
    state: ws < 288 || hs < 480 || s < 12 ? 'paused-space-warning' : 'layout' };
}
const layouts = samples.map(([w, h, st, sb, sl, sr, expected], i) => {
  const item = layout(w, h, st, sb, sl, sr);
  assert(item.cell === expected, `Cell mismatch in sample ${i}`);
  assert(item.state === 'layout', `Unexpected warning in sample ${i}`);
  assert(item.boardTop + item.board[1] + 6 <= item.controlsTop, `Frame overlaps controls: ${i}`);
  assert(item.boardLeft - 6 >= sl && item.boardLeft + item.board[0] + 58 <= w - sr, `Safe-width overflow: ${i}`);
  assert(item.mainKey[0] >= 44 && item.mainKey[1] >= 48, `Small touch target: ${i}`);
  if (i < 6) {
    const row = `| ${w}×${h} | ${st}/${sb} | ${item.cell} | ${item.board.join('×')} | ${item.mainKey.join('×')} |`;
    assert(design.includes(row), `Document table does not match calculated sample: ${i}`);
  }
  return item;
});
const boundaries = [479, 480, 483, 484].map(h => layout(320, h));
assert(boundaries.map(x => x.state).join(',') === 'paused-space-warning,paused-space-warning,paused-space-warning,layout', 'Height-boundary mismatch');
const widthBoundaries = [287, 288].map(w => layout(w, 568));
assert(widthBoundaries[0].state === 'paused-space-warning' && widthBoundaries[1].state === 'layout', 'Width-boundary mismatch');
const homeBottom = 44 + 8 + 96 + 8 + 74, homeButtonTop = 487 - 216;
assert(homeBottom === 230 && homeButtonTop - homeBottom >= 16, 'Compact home overlap');
const slug = heading => heading.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
let localLinks = 0, checkedAnchors = 0;
for (const name of docs) {
  const rel = 'docs/' + name, body = read(rel);
  assert(body.includes('UI-D1'), `Missing design-status cross-reference: ${rel}`);
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [file, anchor] = target.split('#');
    const resolved = path.resolve(root, path.dirname(rel), decodeURIComponent(file));
    assert(fs.existsSync(resolved), `Broken local link in ${rel}: ${target}`);
    localLinks++;
    if (anchor) {
      const headings = fs.readFileSync(resolved, 'utf8').split(/\r?\n/).filter(x => /^#{1,6} /.test(x)).map(x => slug(x.replace(/^#+ /, '')));
      assert(headings.includes(decodeURIComponent(anchor)), `Missing heading in ${rel}: ${target}`);
      checkedAnchors++;
    }
  }
}
const archiveChecks = [
  ['0.1.0', docs],
  ['0.1.1', docs.filter(x => x !== '手机界面与素材.md')],
].map(([v, names]) => {
  const dir = `docs/archive/v${v}/ui-before-design-20261104/`;
  names.forEach(name => assert(fs.existsSync(path.join(root, dir, name)), `Missing snapshot: ${dir}${name}`));
  return { version: v, path: dir, preservedDocuments: names.length };
});
const sourcePaths = ['package.json', 'assets/scripts/Game.ts', 'assets/scripts/core/GameModel.ts', 'assets/resources/levels/first-mine.json'];
const report = {
  softwareVersion: version, designRevision: 'UI-D1', date: '2026-11-04',
  scope: 'Documentation, historical screenshot review and target-layout arithmetic only. No runtime source/assets edited by this design task.',
  reproduction: 'node docs/validation/ui-design-check.cjs',
  sourceSnapshot: sourcePaths.map(file => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })),
  inspectedExistingScreenshots: ['10-home-320x568.png', '08-game-320x568.png', '02-tutorial.png', '09-complete-320x568.png'].map(x => 'docs/validation/screenshots/' + x),
  layoutSamples: layouts, heightBoundaries: boundaries, widthBoundaries,
  compactHome: { availableHeight: 487, goalBlockBottom: homeBottom, startButtonTop: homeButtonTop, gap: homeButtonTop - homeBottom },
  documentChecks: { status: 'pass', localLinks, checkedAnchors, archiveChecks },
  arithmeticStatus: 'pass; target calculations only, not rendered',
  newRuleTypeBuildReplayBrowserTests: 'not run by this design task',
  physicalDevices: 'not tested', audioListening: 'not tested',
  implementation: 'pending main-programmer integration',
  parallelChange: 'Software updated from 0.1.0 to 0.1.1 during design work; existing Escape fix and validation results preserved.',
};
fs.writeFileSync(path.join(__dirname, 'ui-design-review-20261104.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ softwareVersion: version, designRevision: report.designRevision, arithmeticSamples: layouts.length, boundarySamples: boundaries.length + widthBoundaries.length, localLinks, checkedAnchors, status: report.arithmeticStatus }));
