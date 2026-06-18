# claude-refs

프로젝트 무관 재사용 가능한 **참고 자료 모음** — Claude Code 작업 시 참고시키려고 모아둔 md.

## 쓰는 법

자동 로드되는 게 아니다. 필요할 때 해당 md를 작업 중인 프로젝트에 복사하거나 내용을 붙여넣고, Claude 에게 **"이거 참고해서 해줘"** 라고 지목해서 쓴다.

## 내용

### `skills/` — 방법론 스킬 (instruction md)
| 파일 | 무엇 |
|---|---|
| `api-composition-caching` | 조회 API 설계 — 합칠지/병렬/캐시 위치/개인화 분리 프레임워크 |
| `architecture-interview` | 시니어 백엔드 시스템 디자인 면접 핑퐁 |
| `release` | 의미 단위 릴리즈 태깅 (CHANGELOG 초안 + annotated 태그) |
| `verifying-design-proposals` | 설계 검증 요청("이거 맞아?") 시 동의 대신 코드 근거 verdict — ≥2 대안 비교·트레이드오프·택1·한계·언제 다른 안이 옳은가 |

### `agents/` — 서브에이전트 정의 (instruction md)
| 파일 | 무엇 |
|---|---|
| `test-reviewer.md` | 기존 테스트 감사 — 부족 케이스·안티패턴 리포트 (read-only) |
| `test-writer.md` | 테스트 코드 직접 작성 (verify / fail-first 모드). 예제는 범용화됨 |
| `test-agents-spec.md` | 위 두 테스트 에이전트의 명세/설계 문서 |

### `commands/`
| 파일 | 무엇 |
|---|---|
| `safe-commit.md` | 안전 커밋 절차 |

### `hooks/` — Claude Code 게이트 훅 (실행 스크립트, `.cjs`)
다른 카테고리와 달리 "참고 md" 가 아니라 **실행되는 게이트**다. 쓰려면 `.claude/hooks/` 에 복사한 뒤 `settings.json` 의 `hooks` 에 등록한다(PreToolUse / SessionStart matcher). 전부 프로젝트 무관 — `input.cwd` 기준이라 하드코딩 경로 없음.

| 파일 | event / matcher | 무엇 |
|---|---|---|
| `h1-block-secret-read.cjs` | PreToolUse / Read | `.env`·키·인증서·`secrets.*` 류 파일 Read 를 `deny` (basename 기준이라 소스코드 오탐 없음) |
| `h2-block-main-push.cjs` | PreToolUse / Bash | `git push` 가 main 대상이거나 현재 HEAD 가 main 이면 `deny` (PR 머지로만 반영) |
| `h3-test-review-gate.cjs` | PreToolUse / Bash | 커밋 대상에 `*.spec.ts`/`*.test.ts` 가 있으면 `git commit` 을 `ask` (테스트 리뷰 확인 강제) |
| `h4-pr-checklist-reminder.cjs` | PreToolUse / Bash | `gh pr create` 시 브랜치 diff 가 migration/env/config/infra/schema 를 건드렸으면 `ask` (배포 체크리스트 리마인드) |
| `h5-destructive-guard.cjs` | PreToolUse / Bash | `git reset --hard`·`clean -f`·`branch -D`·`push --force`·`checkout .`·`rm -rf <위험경로>` 를 `ask` |
| `h6-session-state.cjs` | SessionStart | 세션 시작 시 git 상태(브랜치·변경 수·최근 커밋)를 컨텍스트에 주입 (읽기만 — 차단/변경 없음) |

### `docs/` — 일반 방법론 문서
| 파일 | 무엇 |
|---|---|
| `backend-feature-cycle.md` | 백엔드 기능 개발 사이클 (요구사항→기능정의→기술설계→…→배포→회고) |
| `claude-global-instructions.md` | 개인 글로벌 작업 규칙 스냅샷 (테스트 가드·배포 가드·선택 4단계·right-size·API 가드) |

> ⚠️ `claude-global-instructions.md` 는 `~/.claude/CLAUDE.md` 의 **스냅샷**이다. 살아있는 원본(`~/.claude/CLAUDE.md`)이 canonical 이고, 이 사본은 시점 백업 — 주기적으로 다시 떠서 갱신할 것.

## 범위 / 비범위

- ✅ 프로젝트·스택 무관하게 어디서나 참고 가능한 일반 자산만.
- ❌ 특정 프로젝트 전용(특정 MCP 툴·코드베이스 의존) 자료는 포함하지 않는다 — 다른 데서 작동하지 않고, 회사 맥락이 섞일 수 있어서.