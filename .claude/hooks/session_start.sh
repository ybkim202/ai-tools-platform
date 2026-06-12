#!/usr/bin/env bash
# SessionStart 훅: 지난 세션 기록을 컨텍스트로 자동 주입한다(읽기 전용).
# 로그는 개인용 — .claude/local/ 은 gitignore 되어 팀원별로 분리된다.
set -euo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG="$ROOT/.claude/local/session-log.md"
[ -s "$LOG" ] || exit 0
CONTENT="$(tail -n 200 "$LOG")"
[ -n "$CONTENT" ] || exit 0
jq -n --arg ctx "$CONTENT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("📓 지난 세션 기록 (.claude/local/session-log.md, 최근 200줄). 이어서 작업할 때 참고:\n\n" + $ctx)
  }
}'
