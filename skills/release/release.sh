#!/usr/bin/env bash
#
# 의미 단위 릴리즈 태깅 — portable (모든 git repo 공용)
#
# 마지막 태그 이후 기본 브랜치(=prod)에 쌓인 배포들을 "의미 단위" 한 버전으로 묶어
# CHANGELOG 최상단 섹션을 annotated 태그 메시지로 박는다.
#
# 사용법 (대상 repo 안에서 실행):
#   release.sh notes [patch|minor|major]   # 마지막 태그 이후 커밋 분류 출력 (CHANGELOG 작성용 입력)
#   release.sh patch|minor|major           # 마지막 태그 기준 자동 증가 후 릴리즈
#   release.sh 1.5.0                        # 버전 직접 지정 후 릴리즈
#
# 이식성:
#   - 기본 브랜치 자동 감지 (origin/HEAD → main/master). RELEASE_BRANCH 로 override 가능.
#   - package.json 있으면 version 동기화, 없으면 skip (node 아닌 repo 지원).
#   - CHANGELOG.md 는 태그 메시지의 원본 — 필수.
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CHANGELOG="CHANGELOG.md"

# --- 기본 브랜치 감지 ---
default_branch() {
  if [ -n "${RELEASE_BRANCH:-}" ]; then echo "$RELEASE_BRANCH"; return; fi
  local b
  b="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@')" || true
  if [ -n "$b" ]; then echo "$b"; return; fi
  for b in main master; do
    git show-ref --verify --quiet "refs/heads/$b" && { echo "$b"; return; }
  done
  git branch --show-current
}

# --- 마지막 정식 태그 (vN.M.K 만, 깨진 v.N 형식 제외) ---
last_tag() {
  git tag --list 'v[0-9]*' --sort=-v:refname | head -1
}

# --- bump 키워드 → 다음 버전 ---
bump_version() {
  local base="${1#v}" kind="$2" major minor patch
  IFS='.' read -r major minor patch <<<"$base"
  case "$kind" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) echo "알 수 없는 bump: $kind (patch|minor|major)" >&2; exit 1 ;;
  esac
  echo "v${major}.${minor}.${patch}"
}

# --- 마지막 태그 이후 커밋을 feat/fix/기타로 분류 ---
print_notes() {
  local from="$1" to="${2:-HEAD}"
  local range="${from:+$from..}$to"
  echo "## 마지막 태그(${from:-없음}) 이후 변경"
  echo ""
  echo "### Added (기능) — feat"
  git log $range --no-merges --pretty='%s (%h)' | grep -E '^feat' || echo "- (없음)"
  echo ""
  echo "### Fixed (수정) — fix"
  git log $range --no-merges --pretty='%s (%h)' | grep -E '^fix' || echo "- (없음)"
  echo ""
  echo "### Changed / 기타"
  git log $range --no-merges --pretty='%s (%h)' | grep -vE '^(feat|fix)' || echo "- (없음)"
  echo ""
  echo "### ⚠️ 배포 영향 후보 (schema/config/env/migration 변경 파일)"
  git diff --name-only ${from:+$from..}$to | grep -Ei 'schema|config|\.env|migration' || echo "- (해당 없음)"
}

# --- CHANGELOG 최상단 섹션 추출 ---
top_changelog_section() {
  awk '/^## \[/{c++} c==1{print} c==2{exit}' "$CHANGELOG"
}

# ============================ main ============================
[ $# -ge 1 ] || { sed -n '2,20p' "$0"; exit 1; }

LAST="$(last_tag)"

if [ "$1" = "notes" ]; then
  print_notes "$LAST"
  exit 0
fi

# --- 버전 결정 ---
case "$1" in
  patch|minor|major)
    [ -n "$LAST" ] || { echo "기존 태그가 없어 bump 불가. 버전을 직접 지정하라 (예: 1.0.0)" >&2; exit 1; }
    NEW="$(bump_version "$LAST" "$1")"
    ;;
  *)
    NEW="v${1#v}"
    [[ "$NEW" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "버전 형식 오류: $NEW (vX.Y.Z)" >&2; exit 1; }
    ;;
esac

BRANCH="$(git branch --show-current)"
TARGET="$(default_branch)"
echo "▶ repo: $(basename "$(pwd)")  |  기본 브랜치: $TARGET  |  마지막 태그: ${LAST:-없음}  →  새 버전: $NEW"
echo ""

# --- 가드 ---
[ "$BRANCH" = "$TARGET" ] || { echo "✗ 기본 브랜치($TARGET)에서만 릴리즈 (현재: $BRANCH)" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "✗ 워킹 트리가 더럽다. 커밋/스태시 후 재시도" >&2; exit 1; }
if git rev-parse --verify --quiet "origin/$TARGET" >/dev/null; then
  git fetch --quiet origin "$TARGET"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$TARGET")" ] || { echo "✗ origin/$TARGET 과 동기화 안 됨. pull 후 재시도" >&2; exit 1; }
fi

# --- CHANGELOG 검증 ---
[ -f "$CHANGELOG" ] || { echo "✗ $CHANGELOG 없음. 먼저 생성하라" >&2; exit 1; }
if ! head -20 "$CHANGELOG" | grep -q "^## \[${NEW#v}\]"; then
  echo "✗ $CHANGELOG 최상단 섹션이 [${NEW#v}] 가 아니다." >&2
  echo "  먼저 아래 분류를 참고해 $CHANGELOG 최상단에 ## [${NEW#v}] - <날짜> 섹션을 작성하라:" >&2
  echo "" >&2
  print_notes "$LAST" >&2
  exit 1
fi

MSG="$(top_changelog_section)"

# --- package.json 있으면 버전 동기화 ---
FILES=("$CHANGELOG")
if [ -f package.json ]; then
  sed -i.bak -E "s/^(  \"version\": \")[^\"]+(\",)/\1${NEW#v}\2/" package.json && rm -f package.json.bak
  FILES+=("package.json")
fi

# --- 릴리즈 커밋 + annotated 태그 ---
git add "${FILES[@]}"
git commit -m "chore(release): ${NEW}"
git tag -a "$NEW" -m "$MSG"

echo ""
echo "✓ 태그 $NEW 생성 완료 (annotated)"
echo ""
echo "  검토:  git show $NEW"
echo "  배포:  git push origin $TARGET && git push origin $NEW"
echo ""
echo "  (push 는 불가역이라 자동 실행하지 않음 — 위 명령을 직접 실행하라)"