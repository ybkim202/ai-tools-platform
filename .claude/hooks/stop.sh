#!/usr/bin/env bash
# Stop 훅: 대화가 멈출 때 이번 세션에서 배운 걸 session-log.md 에 정리하도록
# Claude 를 한 번 더 호출(decision=block)한다.
# 주의: Stop 은 매 턴마다 발생하므로, 세션별 sentinel 로 "세션당 1회"만 요청해 반복을 막는다.
set -euo pipefail
INPUT="$(cat)"
SID="$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"')"
SENT="${TMPDIR:-/tmp}/claude-stop-reflected-${SID}"
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG="$ROOT/.claude/local/session-log.md"
mkdir -p "$(dirname "$LOG")"

# 이미 이번 세션에서 한 번 정리를 요청했으면 더 막지 않는다(턴마다 반복·루프 방지).
if [ -f "$SENT" ]; then
  exit 0
fi
touch "$SENT"

jq -n --arg log "$LOG" '{
  decision: "block",
  reason: ("멈추기 전에, 이번 대화에서 한 일·배운 점·다음에 이어서 할 일을 3~8줄로 정리해 " + $log + " 파일에 \"## [오늘 날짜·시각]\" 제목으로 append 하세요(기존 내용 보존). 팀과 공유할 가치가 있는 학습(컨벤션·함정·운영 지식)이 있으면 docs/ 의 해당 정본 문서에도 반영을 제안하세요. 정말 기록할 게 없으면 한 줄만 남기세요. 그 후 자연스럽게 멈추면 됩니다."),
  systemMessage: "Stop: 세션 학습 내용을 .claude/local/session-log.md에 기록하도록 요청했습니다(세션당 1회)."
}'
