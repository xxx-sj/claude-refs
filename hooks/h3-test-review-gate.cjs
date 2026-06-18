// PreToolUse / Bash 훅 — 테스트 파일 커밋 게이트 (테스트 품질 가드레일 1)
// staged(또는 commit -a 대상)에 *.spec.ts/*.test.ts 가 있으면 git commit 을 ask 로 띄움.
// "사용자 확인 없이 커밋하지 않는다" 규칙을 승인 다이얼로그로 강제 (test-reviewer 확인 리마인드).
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

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

// git commit 을 명령 경계에서만 매칭 — 커밋 메시지 안의 "git commit" 언급은 무시
if (/(?:^|[;&|]\s*)git\s+commit\b/.test(cmd)) {
  let files = git('diff --cached --name-only');
  // git commit -a / -am 은 추적 파일 수정분을 커밋 시점에 stage → 워킹트리 변경도 포함
  if (/(^|\s)-{1,2}a|--all/.test(cmd)) {
    files += '\n' + git('diff --name-only');
  }
  if (/\.(spec|test)\.ts$/m.test(files)) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            '테스트 파일(*.spec.ts/*.test.ts)이 커밋 대상에 있음. 커밋 전 test-reviewer 리포트 확인 필수(전역 규칙). CRITICAL 항목 없을 때만 승인.',
        },
      }),
    );
  }
}
process.exit(0);
