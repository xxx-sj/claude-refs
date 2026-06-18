// PreToolUse / Bash 훅 — 파괴적 명령 가드 (비가역 작업손실 방지)
// 되돌리기 힘든 git/fs 명령을 ask 로 띄워 사람 확인을 끼운다. deny 아님(가끔 의도적이라).
// 명령 경계(^ / ; && |) 앵커 — 따옴표 안 언급은 무시.
const fs = require('fs');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const cmd = (input.tool_input && input.tool_input.command) || '';
const B = '(?:^|[;&|]\\s*)'; // 명령 경계

const hits = [];
function test(reSrc, why) {
  if (new RegExp(reSrc).test(cmd)) hits.push(why);
}

test(B + 'git\\s+reset\\b[^;&|]*--hard', 'git reset --hard — uncommitted 변경 증발');
test(B + 'git\\s+clean\\b[^;&|]*-[a-z]*f', 'git clean -f — untracked/ignored 파일 삭제(docs/ 로컬메모 위험)');
test(B + 'git\\s+branch\\b[^;&|]*-D\\b', 'git branch -D — 머지 안 된 브랜치 강제 삭제');

// git push --force (단 --force-with-lease 는 허용)
const push = cmd.match(new RegExp(B + 'git\\s+push\\b([^;&|]*)'));
if (push && (/--force(?![-\w])/.test(push[1]) || /(?:^|\s)-[a-zA-Z]*f(?:\s|$)/.test(push[1]))) {
  hits.push('git push --force — 원격 히스토리 덮어쓰기(타인 커밋 소실 가능)');
}

// git checkout/restore . (워킹트리 변경 전체 폐기)
const co = cmd.match(new RegExp(B + 'git\\s+(?:checkout|restore)\\b([^;&|]*)'));
if (co && co[1].split(/\s+/).filter(Boolean).includes('.')) {
  hits.push('git checkout/restore . — 워킹트리 변경 전체 폐기');
}

// rm -rf 위험 타겟만 (node_modules/dist 같은 상대경로는 통과)
const rm = cmd.match(new RegExp(B + 'rm\\s+([^;&|]*)'));
if (rm) {
  const args = rm[1];
  const flags = args
    .split(/\s+/)
    .filter((t) => t.startsWith('-'))
    .join(' ');
  const recursive = /-[a-z]*r/i.test(flags) || /--recursive/.test(flags);
  const force = /-[a-z]*f/i.test(flags) || /--force/.test(flags);
  if (recursive && force) {
    const targets = args.split(/\s+/).filter((t) => t && !t.startsWith('-'));
    const danger = (t) =>
      ['/', '.', './', '..', '*', '~', '$HOME', '${HOME}'].includes(t) ||
      t.startsWith('/') ||
      t.startsWith('~') ||
      t.startsWith('$HOME') ||
      t.startsWith('${HOME}');
    if (targets.some(danger)) hits.push('rm -rf <위험경로> — 광범위 파일 삭제');
  }
}

if (hits.length) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: '파괴적 명령 감지:\n- ' + hits.join('\n- ') + '\n진짜 의도한 거면 승인.',
      },
    }),
  );
}
process.exit(0);