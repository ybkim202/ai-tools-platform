#!/usr/bin/env bash
# 디자인 토큰 가드 — 사용처 CSS에 raw hex(인라인 색상) 재유입을 막는다.
#
# 정책(docs/DESIGN.md): 색은 토큰(var(--color-*))으로만 쓴다. hex 리터럴은
# 토큰 정본인 frontend/src/styles/Home.css 의 :root / 다크 블록에서만 허용한다.
# 그 외 사용처 CSS(App.css, 페이지/컴포넌트 CSS)에 hex 가 들어오면 실패시킨다.
# 이 가드가 무채색·토큰 체계의 회귀(예: 유채색 하드코딩 재유입)를 차단한다.
#
# 사용: bash scripts/check-design-tokens.sh   (CI 및 로컬 공용)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STYLE_DIR="$ROOT/frontend/src"

# Home.css(토큰 정본)는 제외. 나머지 CSS에서 hex 리터럴을 찾는다.
# (#fff, #ffffff 등 3/6자리. var(--...) 참조 라인은 정상이므로 제외.)
violations=$(grep -rnE "#[0-9a-fA-F]{3,6}\b" "$STYLE_DIR" \
    --include="*.css" 2>/dev/null \
    | grep -v "/styles/Home.css:" \
    | grep -vE "var\(--" || true)

if [ -n "$violations" ]; then
    echo "❌ 디자인 토큰 위반: 사용처 CSS에 raw hex 색상이 있습니다(토큰만 사용해야 함)."
    echo "   색은 var(--color-*) 토큰으로 쓰고, 새 색이 필요하면 Home.css :root 에 토큰을 추가하세요."
    echo "---"
    echo "$violations"
    exit 1
fi

echo "✅ 디자인 토큰 가드 통과: 사용처 CSS raw hex 0건."
