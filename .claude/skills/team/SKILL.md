---
name: team
description: 여러 전용 에이전트가 협업하며 기능을 완성하는 다단계 파이프라인을 실행한다. 기획→디자인→구현→검증→보완 순으로 진행하고, 완성도 비평가가 빠진 점을 찾아 보완하며, 결정이 필요한 항목만 사용자에게 묻는다. 사용법 - /team <작업 설명>
---

# team — 멀티 에이전트 협업 실행

사용자가 `/team <작업 설명>`으로 호출하면(예: `/team 비교 페이지 UX 개선해줘`), 여러 전용 에이전트가 협업·검증·보완하며 작업을 완성하도록 오케스트레이션한다.

## 동작

1. **작업 파악**: 사용자가 준 텍스트를 `task`(작업 설명)로 삼는다. 설명이 비어 있거나 한 문장으로 너무 모호하면, "무엇을 만들지" 한 줄만 되물은 뒤 진행한다. 그 외에는 곧바로 시작한다.

2. **워크플로우 실행**: **Workflow 도구**를 호출해 `feature-pipeline` 워크플로우를 실행한다.
   - 인자: `{ name: "feature-pipeline", args: { task: <작업 설명> } }`
   - 이 워크플로우는 다음을 자동으로 수행한다:
     `Plan(product-strategist) → Design(ux-ui-designer) → Implement(frontend-react) → Verify(security-reviewer · api-contract-guardian · 완성도 비평가 3개 병렬) → Remediate(명확한 부족분 자동 보완)`

3. **결과 보고(간결)**: 워크플로우가 끝나면 무엇을 했는지 짧게 요약한다. 단계별 장황한 로그는 늘어놓지 않는다. 특히 반환된 **`decisionsNeeded`(DECISION NEEDED)** 항목이 있으면, **그 항목만** 명확히 제시하고 사용자의 결정을 받는다.

## 원칙 (중요 알림만)

- 진행 중 사소한 선택은 프로젝트 규칙([CLAUDE.md](../../../CLAUDE.md) · [docs/GOVERNANCE.md](../../../docs/GOVERNANCE.md) · [docs/DESIGN.md](../../../docs/DESIGN.md))을 따라 스스로 판단한다. 매번 묻지 않는다.
- 사용자를 멈춰 세우는 것은 단 두 경우다: **(a) 승인·입력이 꼭 필요할 때, (b) 되돌리기 어렵거나 범위를 바꾸는 결정 포인트.**
- 커밋·푸시는 사용자가 명시적으로 요청할 때만 한다.

## 전제

- 커스텀 에이전트(`agentType`)와 `feature-pipeline` 워크플로우는 **Claude Code 재시작 후** 동작한다.
- 워크플로우는 여러 에이전트를 띄워 토큰을 많이 쓸 수 있다. 작업 규모에 맞게 진행한다.
