# 비교(Compare) 페이지 UX/UI 개선 스펙

> 작성: ux-ui-designer · 대상 구현: frontend-react
> 관련 파일: [frontend/src/pages/Compare.jsx](../frontend/src/pages/Compare.jsx), [frontend/src/styles/Compare.css](../frontend/src/styles/Compare.css), [frontend/src/stores/toolStore.js](../frontend/src/stores/toolStore.js)

## 목표
Home 페이지에 적용된 **Linear Design System**과 일관된, 정보 밀도가 높은 비교 테이블을 "한눈에 스캔 가능"하게 만든다. 미관 < **사용성·일관성** 우선.

---

## 1. 현재 진단 (UX 문제점)

| # | 심각도 | 문제 | 근거 |
|---|---|---|---|
| P1 | **High** | **디자인 시스템 불일치** — 비교 페이지만 보라색 그라데이션(`#667eea/#764ba2`) 레거시 스타일. Home은 Linear 토큰(`--color-primary: #5E5CE6` 등) 사용 | [Compare.css:3](../frontend/src/styles/Compare.css#L3) vs [Home.css:5-55](../frontend/src/styles/Home.css#L5-L55) |
| P2 | **High** | **개별 도구 삭제 불가** — 스토어에 `removeToolForCompare`가 있는데 UI는 "전체 초기화"만 제공. 도구 하나 빼려면 전부 지우고 다시 선택 | [toolStore.js:165](../frontend/src/stores/toolStore.js#L165), [Compare.jsx:51](../frontend/src/pages/Compare.jsx#L51) |
| P3 | **High** | **"우위" 시각화 부재** — 가격·사용자수·벤치마크에서 어떤 도구가 더 나은지 강조가 없어 표를 일일이 읽어야 함 (비교 페이지의 핵심 가치 손실) | [Compare.jsx:90-137](../frontend/src/pages/Compare.jsx#L90-L137) |
| P4 | Medium | **상태 UI 빈약** — 로딩이 평문 "로딩 중...", 에러/빈 상태가 Home의 세련된 state container와 불일치. Home엔 spinner·아이콘·재시도 버튼 존재 | [Compare.jsx:56](../frontend/src/pages/Compare.jsx#L56), [Home.css:317-430](../frontend/src/styles/Home.css#L317-L430) |
| P5 | Medium | **모바일 대응 없음** — Compare.css에 미디어쿼리 0개. 도구 5개 × 6행 테이블이 좁은 화면에서 깨짐 | Compare.css 전체 |
| P6 | Medium | **"도구 더 추가" 동선 없음** — 최대 5개인데 비교 화면에서 추가 유도 없음. 이탈 후 홈에서 다시 선택해야 함 | [toolStore.js:154](../frontend/src/stores/toolStore.js#L154) |
| P7 | Low | **다크모드 미지원** — 흰 배경 하드코딩. 앱은 `darkMode` 토글 보유 | [toolStore.js:130](../frontend/src/stores/toolStore.js#L130) |
| P8 | Low | **라우팅 불일치** — 빈 상태에서 `<a href="/">` 전체 새로고침. 앱은 react-router-dom v7 사용 → `<Link>` 써야 SPA 유지 | [Compare.jsx:38](../frontend/src/pages/Compare.jsx#L38) |
| P9 | Low | **접근성** — 테이블에 `<caption>`/scope 없음, 로고 `alt`만 의존, difficulty 색상만으로 의미 전달(색맹 취약) | [Compare.jsx:61-71](../frontend/src/pages/Compare.jsx#L61-L71) |

---

## 2. 개선 정보구조 / 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  Compare 페이지 (배경: --color-background, 다크모드 대응)   │
│                                                           │
│  [헤더 바]  ← 좌측 정렬, container(max 1200px)            │
│   ⚖️ 도구 비교            3 / 5 selected   [+ 추가] [초기화]│
│   AI 도구를 나란히 비교하세요                                │
│                                                           │
│  [비교 카드/테이블]  (surface, radius-xl, shadow-md)       │
│  ┌──────────┬─────────┬─────────┬─────────┐              │
│  │ (sticky) │ [로고]   │ [로고]   │ [로고]   │ ← 헤더 sticky │
│  │  항목     │ ChatGPT │ Claude  │ Gemini  │   + 각 ✕삭제  │
│  ├──────────┼─────────┼─────────┼─────────┤              │
│  │ 카테고리  │  ...    │  ...    │  ...    │              │
│  │ 난이도    │ ●쉬움   │ ●보통   │ ●보통   │ ← 점+텍스트   │
│  │ 사용자 수 │ 🏆180M  │  100M   │  90M    │ ← 최댓값 강조  │
│  │ 가격     │ 🏆무료   │  $20    │  $20    │ ← 최저가 강조  │
│  │ 벤치마크  │  85 🏆  │  92 🏆  │  80     │ ← 행별 최고 강조│
│  │ 링크     │ [방문→] │ [방문→] │ [방문→] │              │
│  └──────────┴─────────┴─────────┴─────────┘              │
│   첫 열은 가로 스크롤 시 좌측 고정(sticky left)            │
└─────────────────────────────────────────────────────────┘
```

**모바일(≤768px) — 도구별 세로 카드 스택** (결정됨):
```
┌──────────────────────┐
│ [로고] ChatGPT     ✕ │ ← 카드 헤더 + 개별 삭제
│ ──────────────────── │
│ 카테고리       대화형AI│
│ 난이도         ●쉬움  │
│ 사용자 수      180M 🏆│ ← 값 옆 🏆 배지로 우위 표시
│ 가격           무료 🏆│
│ 벤치마크       85     │
│ 링크          [방문→]│
└──────────────────────┘
┌──────────────────────┐
│ [로고] Claude      ✕ │   ← 다음 도구는 아래로 쌓임
│  ...                 │
└──────────────────────┘
```

핵심 변경:
- 헤더를 **중앙정렬→좌측정렬**, container 폭 통일(`max-width:1200px`, `padding:0 var(--spacing-lg)`).
- 헤더에 **선택 카운터(`N / 5`)**, **[+ 도구 추가]**(P6), **[초기화]** 배치.
- 테이블 헤더 셀에 **도구별 ✕ 삭제 버튼**(P2).
- **행별 "최고값" 자동 하이라이트**(P3) — 수치형 행(사용자수=최대, 가격=최소, 벤치마크=최대).
- 첫 열 **sticky left** + 헤더 **sticky top**으로 스캔성 강화.

---

## 3. 비주얼 스펙 (Linear 토큰값)

> 모든 값은 [Home.css:5-55](../frontend/src/styles/Home.css#L5-L55)의 `:root` 토큰을 재사용. **새 색/간격 하드코딩 금지.**

### 3.1 페이지 컨테이너
```css
.compare-page {
  min-height: 100vh;
  background-color: var(--color-background);   /* 보라 그라데이션 제거 */
  padding: var(--spacing-3xl) var(--spacing-lg);
}
.compare-container { max-width: 1200px; margin: 0 auto; }
```

### 3.2 헤더
```css
.compare-header {            /* text-align: center → left */
  display: flex; align-items: flex-end; justify-content: space-between;
  flex-wrap: wrap; gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}
.compare-title  { font-size: var(--font-size-3xl); font-weight: 700; color: var(--color-text-primary); }
.compare-subtitle { font-size: var(--font-size-base); color: var(--color-text-secondary); margin-top: var(--spacing-sm); }
.compare-counter {           /* "3 / 5" pill */
  font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}
```
버튼은 Home의 `.btn / .btn-primary / .btn-secondary`([Home.css:461-496](../frontend/src/styles/Home.css#L461-L496)) **그대로 재사용**.

### 3.3 비교 테이블
```css
.comparison-table {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);          /* 12px */
  box-shadow: var(--shadow-md);
  overflow-x: auto;                          /* 가로 스크롤 */
}
.comparison-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
.comparison-table th,
.comparison-table td {
  padding: var(--spacing-lg);                /* 16px */
  text-align: center;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}
/* 헤더: 그라데이션 제거, surface 톤 + sticky */
.comparison-table thead th {
  position: sticky; top: 0; z-index: 2;
  background: var(--color-background);
  font-weight: 600;
  border-bottom: 2px solid var(--color-border);
}
/* 첫 열(항목 라벨) 좌측 고정 */
.comparison-table th:first-child,
.comparison-table td:first-child {
  position: sticky; left: 0; z-index: 1;
  text-align: left; min-width: 120px;
  background: var(--color-surface);
  font-weight: 600; color: var(--color-text-secondary);
}
.comparison-table thead th:first-child { z-index: 3; background: var(--color-background); }
.table-logo { width: 36px; height: 36px; border-radius: var(--radius-md); }
.tool-col-header { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-sm); position: relative; }
.tool-remove-btn {            /* ✕ 개별 삭제 (P2) */
  position: absolute; top: -8px; right: -8px;
  width: 20px; height: 20px; border-radius: var(--radius-full);
  background: var(--color-surface); border: 1px solid var(--color-border);
  color: var(--color-text-tertiary); cursor: pointer; line-height: 1;
  transition: all var(--transition-fast);
}
.tool-remove-btn:hover { color: var(--color-error); border-color: var(--color-error); }
.tool-remove-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
```

### 3.4 "최고값" 하이라이트 (P3 — 핵심)
```css
.cell-best {
  background: rgba(94, 92, 230, 0.06);       /* primary 6% */
  font-weight: 700;
  color: var(--color-primary);
  position: relative;
}
.cell-best::before { content: "🏆"; margin-right: var(--spacing-xs); font-size: var(--font-size-sm); }
```
구현 규칙(JS): 행 단위로 수치 비교 →
- **사용자 수·벤치마크**: 최댓값 셀에 `cell-best`.
- **가격**: 각 도구 최저 플랜가 기준, 최솟값(무료=0 우선)에 `cell-best`.
- 동률이면 모두 강조. 단일 도구 비교 시 강조 생략.

### 3.5 난이도 배지 (P9 — 색+형태 동시 전달)
```css
.difficulty { display: inline-flex; align-items: center; gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md); border-radius: var(--radius-full);
  font-size: var(--font-size-sm); font-weight: 600; }
.difficulty::before { content: "●"; }     /* 점 + 텍스트로 색맹 대응 */
.difficulty.easy   { background: rgba(22,163,74,0.1);  color: var(--color-success); }
.difficulty.medium { background: rgba(251,146,60,0.12); color: var(--color-warning); }
.difficulty.hard   { background: rgba(239,68,68,0.1);  color: var(--color-error); }
```
> 주의: 현재 클래스가 한글(`쉬움/보통/어려움`)이라 데이터 값과 결합돼 깨지기 쉬움. 매핑 함수로 `easy/medium/hard` 변환 권장(데이터 값은 [tools-data-curator]와 확인).

### 3.6 상태 UI (P4) — Home 패턴 재사용
- **로딩**: Home의 `.spinner` + `.state-text`([Home.css:327-345](../frontend/src/styles/Home.css#L327-L345)) 또는 기존 [LoadingSpinner.jsx](../frontend/src/components/LoadingSpinner.jsx) 컴포넌트 재사용.
- **에러**: Home `.error-box`(아이콘+제목+메시지+재시도) 패턴. 재시도는 `fetchComparison()` 호출.
- **빈 상태**: Home `.empty-state` 패턴. CTA는 `<Link to="/">`(P8)로 교체, 문구 "홈에서 도구의 '비교' 버튼을 눌러 추가하세요".

### 3.7 반응형 (P5) — **모바일: 도구별 세로 카드 스택** (결정됨)
데스크톱은 가로 비교 테이블, **모바일(≤768px)은 테이블을 숨기고 도구별 세로 카드로 전환**한다. 좁은 화면에서 가로 스크롤 테이블은 셀이 뭉개지므로, 도구 1개 = 카드 1장으로 쌓고 카드 안에 "항목: 값" 행을 나열한다.

구현 방식: 동일 데이터를 **두 가지 마크업으로 렌더**하고 CSS로 토글한다. (`.comparison-table`는 모바일에서 `display:none`, `.compare-cards`는 데스크톱에서 `display:none`.)

```css
/* 기본: 데스크톱 = 테이블만 노출 */
.compare-cards { display: none; }

@media (max-width: 768px) {
  .compare-page { padding: var(--spacing-2xl) var(--spacing-md); }
  .compare-header { flex-direction: column; align-items: stretch; text-align: left; }
  .compare-title { font-size: var(--font-size-2xl); }

  .comparison-table { display: none; }          /* 테이블 숨김 */
  .compare-cards {                               /* 카드 스택 노출 */
    display: flex; flex-direction: column; gap: var(--spacing-lg);
  }
}

/* 도구 카드 */
.compare-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
}
.compare-card-header {
  display: flex; align-items: center; gap: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--spacing-md);
  position: relative;
}
.compare-card-header .table-logo { width: 32px; height: 32px; }
.compare-card-name { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text-primary); }
.compare-card .tool-remove-btn { position: static; margin-left: auto; }  /* ✕ 우측 정렬 */

/* 카드 내부 "항목: 값" 행 */
.compare-card-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: var(--spacing-lg); padding: var(--spacing-sm) 0;
}
.compare-card-row + .compare-card-row { border-top: 1px solid var(--color-border); }
.compare-card-key { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); white-space: nowrap; }
.compare-card-val { font-size: var(--font-size-base); color: var(--color-text-primary); text-align: right; }
```

**모바일에서의 "최고값" 강조(P3):** 카드 레이아웃에선 셀 배경 대신 값 옆에 🏆 배지를 붙여 표시한다.
```css
.compare-card-val.is-best { color: var(--color-primary); font-weight: 700; }
.compare-card-val.is-best::after { content: " 🏆"; }
```
> 행별 최고값 판정 로직(사용자수=최대, 가격=최소, 벤치마크=최대)은 데스크톱 테이블과 **동일한 함수를 공유**한다. 마크업만 다르고 강조 규칙은 한 곳에서 계산해 양쪽에 전달할 것.

### 3.8 다크모드 (P7)
모든 색을 토큰으로 쓰면 Home `:root`의 `@media (prefers-color-scheme: dark)`([Home.css:57-66](../frontend/src/styles/Home.css#L57-L66))가 자동 적용됨. **하드코딩 색만 제거하면 무료로 해결.** (단, 앱은 수동 `darkMode` 토글도 보유 → 향후 `[data-theme]` 속성 기반으로 통일 검토.)

---

## 4. 인터랙션 스펙

| 인터랙션 | 동작 | 상태 |
|---|---|---|
| 도구 ✕ 삭제 | `removeToolForCompare(tool.id)` → 목록 1개면 빈 상태로 전환 | hover: error색, focus-visible: outline |
| + 도구 추가 | `<Link to="/">` 또는 추가 모달(MVP는 링크) | — |
| 초기화 | `clearCompareList()` | 확인 다이얼로그 선택(도구 3개+ 시) |
| 방문 → | `target="_blank" rel="noopener noreferrer"` 유지 | hover: 미세 상승 |
| 행 hover | 해당 행 배경 `var(--color-surface)` 강조로 가로 가독성 ↑ | — |

전환은 `var(--transition-fast/normal)` 사용. 과한 애니메이션 금지(절제된 모션).

---

## 5. 구현 우선순위 (Impact/Effort)

| 순위 | 항목 | Impact | Effort |
|---|---|---|---|
| 1 | P1 Linear 토큰 마이그레이션 (Compare.css 전면 교체) | High | Low |
| 2 | P3 최고값 하이라이트 | High | Med |
| 3 | P2 개별 삭제 버튼 | High | Low |
| 4 | P4 상태 UI 통일 | Med | Low |
| 5 | P5 반응형 | Med | Low |
| 6 | P6 도구 추가 동선 / P8 Link / P9 접근성 | Med | Low |
| 7 | P7 다크모드 검증 | Low | Low(토큰화 시 자동) |

1~3번만으로도 체감 품질이 크게 오름. MVP = 1~4.

---

## 6. 디자인 결정 (확정)

- ✅ **"도구 추가" 방식** — **홈으로 보내는 링크(MVP)**. 비교 화면 내 검색·추가 모달은 후속 과제로 보류.
- ✅ **모바일 레이아웃** — **도구별 세로 카드 스택**으로 전환(가로 스크롤 테이블 미채택). 3.7 참조.

## 7. 남은 열린 질문

1. **난이도 데이터 값** — DB/`tools_data.json`에 한글(`쉬움/보통/어려움`)로 저장돼 있나, 영문 enum인가? 매핑 함수 설계에 영향 ([tools-data-curator] 확인 필요).
2. **벤치마크 "우위" 기준** — 단순 행별 최댓값 강조면 되나, 아니면 "종합 추천 도구" 한 곳을 골라 배지로 표시할까? (추천 로직은 [product-strategist]와 협의)
3. **다크모드 정책** — OS 설정 자동(`prefers-color-scheme`)만 지원할지, 앱 내 수동 토글(`darkMode` store)과 통일할지. 통일 시 전역 테마 리팩터 필요.

---

**다음 의사결정 포인트:** 참고용 `design.md`를 받는 대로 이 프로젝트의 `design.md`(디자인 시스템 문서)를 작성하고, 그다음 확정된 결정을 반영해 [frontend-react]에 `Compare.jsx` + `Compare.css` 구현을 넘긴다.
