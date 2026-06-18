// SessionStart 훅 — 세션 시작/재개 시 git 상태를 컨텍스트에 주입 (orientation)
// 순수 git 읽기뿐 → 무엇도 차단/변경 안 함. git repo 아니면 조용히 종료.
const fs = require('fs');
const { execSync } = require('child_process');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
function git(args) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

if (git('rev-parse --is-inside-work-tree') !== 'true') process.exit(0);

const branch = git('rev-parse --abbrev-ref HEAD');
const top = git('rev-parse --show-toplevel');
const isWorktree = git('rev-parse --git-common-dir') !== git('rev-parse --git-dir');
const porcelain = git('status --porcelain');

let modified = 0;
let untracked = 0;
porcelain
  .split('\n')
  .filter(Boolean)
  .forEach((l) => (l.startsWith('??') ? untracked++ : modified++));

const recent = git('log -5 --pretty="%h %s"');

const lines = [
  '[git 상태 — 세션 시작]',
  `브랜치: ${branch}${isWorktree ? `  (worktree: ${top})` : ''}`,
  `변경: modified ${modified} / untracked ${untracked}`,
  recent ? '최근 커밋:\n' + recent.split('\n').map((l) => '  ' + l).join('\n') : '',
].filter(Boolean);

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
  }),
);
process.exit(0);