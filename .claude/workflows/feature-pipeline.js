export const meta = {
  name: 'feature-pipeline',
  description: '기획→디자인→구현→검증→보완 다단계 에이전트 파이프라인. args.task(작업 설명)를 받아, 완성도 비평가가 빠진 점을 찾고 명확한 부족분은 자동 보완하며, 결정이 필요한 항목만 "DECISION NEEDED"로 돌려준다.',
  phases: [
    { title: 'Plan' },
    { title: 'Design' },
    { title: 'Implement' },
    { title: 'Verify' },
    { title: 'Remediate' },
  ],
}

// args 로 작업 설명을 받는다. 예) Workflow({ name: 'feature-pipeline', args: { task: '비교 페이지 UX 개선' } })
const task =
  (args && (args.task || (typeof args === 'string' && args))) ||
  '(작업 설명 없음 — args.task 로 전달하세요)'

log(`작업: ${task}`)

// 1) 기획 — 무엇을 왜 (코드 없이)
phase('Plan')
const plan = await agent(
  `다음 작업의 기획을 정리하라(코드 작성 금지): "${task}".
문제정의 · 대상 사용자 · 핵심 요구사항 · 성공지표 · MVP 범위 · 비범위를 구체적으로.
다음 단계(디자인)가 바로 활용할 수 있게 작성.`,
  { agentType: 'product-strategist', label: 'plan' }
)

// 2) 디자인 — 어떻게 보이고 동작 (토큰값까지)
phase('Design')
const design = await agent(
  `아래 기획을 바탕으로 UX/UI 스펙을 작성하라. docs/DESIGN.md 의 Linear 토큰만 사용하고
레이아웃 · 컴포넌트 · 상태(로딩/빈/에러) · 반응형 · 접근성을 토큰값까지 구체화.
코드는 구현하지 말고 frontend-react 가 그대로 구현할 스펙만 산출.

[기획]
${plan}`,
  { agentType: 'ux-ui-designer', label: 'design' }
)

// 3) 구현 — 실제 코드
phase('Implement')
const impl = await agent(
  `아래 디자인 스펙을 frontend/src 에 실제 구현하라.
CLAUDE.md / docs/GOVERNANCE.md 규칙 준수: 서버 호출은 services/api.js 경유,
Linear 토큰 사용(인라인 hex 금지), 빌드 경고 0(npm run build 통과).
백엔드 변경이 필요하면 무엇이 필요한지 명시하라(직접 수정은 backend 영역이면 보류).

[스펙]
${design}`,
  { agentType: 'frontend-react', label: 'implement' }
)

// 4) 검증 — 세 관점 병렬 (보안 · 계약 · 완성도 비평)
phase('Verify')
const reviews = await parallel([
  () =>
    agent(
      `방금 구현을 보안 관점에서 점검(읽기 전용). 인증 · SQLi · CORS · 시크릿 노출 · 입력검증.
발견사항만 심각도와 함께 보고.\n\n[구현]\n${impl}`,
      { agentType: 'security-reviewer', label: 'verify:security', phase: 'Verify' }
    ),
  () =>
    agent(
      `API 계약 정합성 점검(읽기 전용). 프론트 services 호출 ↔ 백엔드 라우터 ↔ API 문서 일치 여부.
불일치만 표로 보고.\n\n[구현]\n${impl}`,
      { agentType: 'api-contract-guardian', label: 'verify:contract', phase: 'Verify' }
    ),
  () =>
    agent(
      `완성도 비평가. 이 작업에서 "빠진 것"을 찾아라:
처리 안 된 상태(빈/에러) · 누락된 반응형/접근성 · 미연결 데이터 · 테스트 안 된 경로 ·
기획 요구사항 중 미구현. 항목별 목록으로.\n\n[기획]\n${plan}\n\n[구현]\n${impl}`,
      { agentType: 'ux-ui-designer', label: 'verify:completeness', phase: 'Verify' }
    ),
])

// 5) 보완 — 명확한 부족분만 자동 수정, 결정 필요 항목은 돌려준다
phase('Remediate')
const gaps = reviews.filter(Boolean).join('\n\n---\n\n')
const remediation = await agent(
  `아래 검토 결과에서 '명확히 빠졌고 안전하게 보완 가능한' 항목만 frontend/src 에 보완 구현하라.
아키텍처 · 범위 · 데이터 모델을 바꾸는 결정이 필요한 항목은 고치지 말고
"DECISION NEEDED: ..." 형식으로 목록화해 반환. 규칙(CLAUDE.md) 준수, 빌드 통과 확인.

[검토 결과]
${gaps}`,
  { agentType: 'frontend-react', label: 'remediate' }
)

// 오케스트레이터(메인)가 받아서 'DECISION NEEDED' 항목만 사용자에게 알린다.
return {
  task,
  summary: '기획→디자인→구현→검증→보완 완료',
  decisionsNeeded: remediation,
  reviews,
}
