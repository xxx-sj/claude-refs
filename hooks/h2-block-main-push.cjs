// PreToolUse / Bash 훅 — main 직접 push 차단 (배포 가드레일)
// git push 명령 중 (1) main 토큰이 명시됐거나 (2) 현재 HEAD 가 main 이면 deny.
// main 은 PR 머지로만 반영. 워크트리/피처 브랜치 워크플로 전제라 오탐 거의 없음.
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

function deny(reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    }),
  );
  process.exit(0);
}

// git push 를 "명령 경계"(문장 시작 / ; && || | 뒤)에서만 매칭 — 따옴표 안 언급은 무시
const pushSeg = cmd.match(/(?:^|[;&|]\s*)git\s+push\b([^;&|]*)/);
if (pushSeg) {
  // (1) push 인자에 main 이 명시됨 (git push origin main 등)
  if (/\bmain\b/.test(pushSeg[1])) {
    deny('main 직접 push 금지(배포 가드레일). PR 머지로만 main 반영.');
  }
  // (2) 현재 브랜치가 main 인 채로 push (인자 없는 git push 포함)
  try {
    const branch = execSync('git symbolic-ref --short HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (branch === 'main') {
      deny('현재 브랜치가 main. 직접 push 금지(배포 가드레일). 피처 브랜치 → PR 머지로만 반영.');
    }
  } catch {
    // git 조회 실패 시 통과
  }
}
process.exit(0);
