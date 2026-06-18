// PreToolUse / Read 훅 — 비밀 파일 Read 차단 (feedback_secret_files)
// .env·credentials·인증서·secrets 류 파일을 Read 로 여는 것을 deny.
// 특정 키만 필요하면 Grep 으로 확인 (Grep 은 이 훅이 안 막음 — matcher 가 Read 한정).
const fs = require('fs');
const path = require('path');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // 파싱 실패 시 fail-open (워크플로 안 깨뜨림)
}

const file = (input.tool_input && input.tool_input.file_path) || '';
const base = path.basename(file).toLowerCase();

// 비밀 파일 "모양"만 차단 — secret.service.ts 같은 소스코드는 오탐 안 나게 basename 기준
const isSecret =
  /^\.env(\.|$)/.test(base) || // .env, .env.production
  /\.(pem|key|p12|pfx|crt|cer)$/.test(base) || // 키/인증서
  /credential/.test(base) || // *credentials*.json
  /^secrets?\.(json|ya?ml|env|txt)$/.test(base); // secrets.json 등

if (isSecret) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          '비밀 파일은 Read 금지(feedback_secret_files). 특정 키가 필요하면 Grep 으로 그 키만 확인.',
      },
    }),
  );
}
process.exit(0);
