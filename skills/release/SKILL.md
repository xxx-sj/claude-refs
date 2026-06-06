---
name: release
description: "의미 단위 릴리즈 태깅 — 마지막 태그 이후 커밋을 분석해 CHANGELOG 초안을 작성하고, 결정론 스크립트로 annotated 태그를 생성한다. 키워드: 릴리즈, release, 태그, tag, 버전, version, changelog, 배포 버전 남기기. 모든 git repo 공용."
---

# 릴리즈 태깅 (의미 단위)

마지막 태그 이후 기본 브랜치(=prod)에 쌓인 배포들을 **의미 단위** 한 버전으로 묶어 CHANGELOG + annotated 태그로 남긴다.

## 역할 분담 (반드시 지킬 경계)

- **LLM(나)**: 커밋 분석 → CHANGELOG 초안 작성 → 버전 등급 제안. "무엇을"만.
- **스크립트(`release.sh`)**: package.json 동기화 + annotated 태그 + 커밋. "실행"만, 결정론.
- **불가역 경계**: `git push` 와 `git tag` 는 **절대 LLM이 직접 실행하지 않는다.** 태그 생성은 스크립트에 위임하고, push 는 사용자가 직접 친다. LLM 비결정성이 불가역 git ops 에 닿으면 안 된다.

스크립트 경로: `~/.claude/skills/release/release.sh` (대상 repo 안에서 실행 — 스크립트가 repo root 로 cd 함).

## 진행 순서

### 1. 사전 확인
- 현재 repo 가 git repo 인지, 기본 브랜치에 있는지, 워킹 트리가 클린한지 확인.
- 기본 브랜치가 아니거나 더러우면 사용자에게 알리고 멈춘다 (스크립트 가드도 막지만 미리 안내).

### 2. 변경 분류 (notes)
```bash
bash ~/.claude/skills/release/release.sh notes
```
출력 = 마지막 태그 이후 feat / fix / 기타 + 배포 영향 후보 파일. 이걸 입력으로 삼는다.

### 3. 버전 등급 제안
- feat 있으면 **MINOR**, fix 만이면 **PATCH**, 호환 깨짐(BREAKING) 있으면 **MAJOR**.
- breaking·스키마/마이그레이션·핫픽스가 섞였으면 사용자에게 명시적으로 경고.
- 등급과 새 버전 번호를 사용자에게 제시하고 **확인받는다**.

### 4. CHANGELOG 초안 작성
- `CHANGELOG.md` 없으면 헤더 + 작성 규칙과 함께 새로 만든다 (아래 템플릿).
- 최상단(`<!-- 새 릴리즈 -->` 아래)에 `## [x.y.z] - YYYY-MM-DD` 섹션을 추가.
  날짜는 환경의 currentDate / `date +%F` 사용.
- 커밋 메시지를 그대로 복붙하지 말고 **사람이 읽는 한 줄**로 다듬는다. PR 번호(#NNN)는 살린다.
- 분류: `### Added`(기능) / `### Fixed`(수정) / `### Changed`(변경) / `### ⚠️ 배포 영향`(env·migration·schema).
- 초안을 사용자에게 보여주고 수정 받는다.

### 5. 태그 생성 (스크립트 위임)
사용자가 CHANGELOG 초안을 승인하면:
```bash
bash ~/.claude/skills/release/release.sh <minor|patch|major|x.y.z>
```
스크립트가 CHANGELOG 최상단 섹션이 그 버전인지 검증 → package.json 동기화 → `chore(release): vX.Y.Z` 커밋 → annotated 태그 생성. 실패하면 가드 메시지를 사용자에게 그대로 전달.

### 6. push 안내 (직접 실행 금지)
스크립트가 출력한 push 명령을 사용자에게 그대로 안내한다. **LLM이 push 하지 않는다.**
```
git push origin <기본브랜치> && git push origin vX.Y.Z
```

## CHANGELOG.md 신규 생성 템플릿

```markdown
# Changelog

이 프로젝트의 주요 변경을 **의미 단위 릴리즈**로 기록한다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/), 버전은 [SemVer](https://semver.org/lang/ko/)를 따른다.

## 작성 규칙

- **언제 컷하나:** 마지막 태그 이후 기본 브랜치(=prod)에 쌓인 배포가 의미 단위로 차오를 때
  (기능 묶음 완성 / 자잘한 fix 누적 / 1~2주 경과 / 외부에 알릴 변경).
  단 **breaking·스키마/마이그레이션·핫픽스**는 그 배포 즉시 단독 컷.
- **등급:** 기능 추가 → MINOR, 버그 픽스만 → PATCH, 호환 깨짐 → MAJOR.
- **분류:** Added(기능) / Fixed(수정) / Changed(변경) / ⚠️ 배포 영향(env·migration·schema).

<!-- 새 릴리즈는 이 줄 아래에 추가 (최신이 맨 위) -->
```

## 한계

- 이 skill 은 Claude 세션 안에서만 동작 (CI 자동 릴리즈 아님).
- "기본 브랜치 머지마다 자동 릴리즈" 가 필요해지면 release-please(GitHub Actions)로 진화. 그때 이 skill 은 은퇴.