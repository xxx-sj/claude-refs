// PreToolUse / Bash 훅 — 배포영향 PR 체크리스트 리마인드 (배포 안전 가드레일 1)
// gh pr create 시 브랜치 diff 가 migration/env/config/infra/schema 를 건드렸으면
// ask 로 띄워 "PR 본문에 배포 체크리스트 포함했나" 확인. 훅이 본문을 직접 쓰진 못해 리마인드까지.
const fs = require('fs');
const { execSync } = require('child_process');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const cmd = (input.tool_input && input.tool_input.command) || '';
const cwd = input.cwd || process.cwd();

// gh pr create 를 명령 경계에서만 매칭
if (/(?:^|[;&|]\s*)gh\s+pr\s+create\b/.test(cmd)) {
  let changed = '';
  try {
    const base = execSync('git merge-base HEAD origin/main || git merge-base HEAD main', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    changed = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // base 산출 실패 시 조용히 통과
  }

  const hits = [];
  if (/migration/i.test(changed)) hits.push('migration');
  if (/(^|\/)\.env|configuration\.module\.ts|(^|\/)config\//im.test(changed)) hits.push('env/config');
  if (/dockerfile|docker-compose|\.ya?ml$/im.test(changed)) hits.push('infra/k8s');
  if (/\.schema\.ts$/m.test(changed)) hits.push('schema');

  if (hits.length) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `배포 영향 변경 감지(${hits.join(
            ', ',
          )}). PR 본문에 배포 체크리스트 포함했는지 확인 후 승인(배포 안전 가드레일).`,
        },
      }),
    );
  }
}
process.exit(0);
