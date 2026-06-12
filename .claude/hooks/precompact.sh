#!/usr/bin/env bash
# PreCompact 훅: /compact(컨텍스트 압축) 전에 중요한 내용을 먼저 정리·보존하도록
# Claude 를 한 번 더 호출(decision=block)해 session-log.md 에 요약을 append 시킨다.
# 세션별 sentinel 로 무한 루프를 방지한다.
set -euo pipefail
INPUT="$(cat)"
SID="$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"')"
SENT="${TMPDIR:-/tmp}/claude-precompact-${SID}"
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG="$ROOT/.claude/local/session-log.md"
mkdir -p "$(dirname "$LOG")"

# 직전에 이미 요약 요청을 했다면(두 번째 발화) 막지 않고 압축을 진행시킨다.
if [ -f "$SENT" ]; then
  rm -f "$SENT"
  exit 0
fi
touch "$SENT"

jq -n --arg log "$LOG" '{
  decision: "block",
  reason: ("컨텍스트 압축(/compact) 직전입니다. 압축으로 사라지기 전에 이번 세션의 핵심을 먼저 보존하세요:\n1) 이번 세션에서 한 일·핵심 결정·미해결/다음 할 일을 5~12줄로 정리\n2) " + $log + " 파일에 \"## [오늘 날짜·시각] (pre-compact)\" 제목으로 append(기존 내용 보존 — Read 후 끝에 덧붙이거나 >> 사용)\n3) 팀과 공유할 영구 지식(컨벤션·함정·운영 절차)이 있으면 docs/ 정본 문서에도 반영을 제안하세요."),
  systemMessage: "PreCompact: 압축 전 세션 요약을 .claude/local/session-log.md에 기록하도록 요청했습니다."
}'
