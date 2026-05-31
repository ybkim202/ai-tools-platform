# UX/UI 스펙 — 트렌드 네비 재편 + 깃헙 트렌드 페이지 (`/trends/github`)

> 작성: ux-ui-designer · 2026-05-31 · 상태: 구현 핸드오프(frontend-react 대상)
> 근거 기획: PRD「트렌드 섹션 재편 + 깃헙 트렌드 신규 페이지」(product-strategist)
> 토큰 정본: [docs/DESIGN.md](DESIGN.md) / [frontend/src/styles/Home.css](../frontend/src/styles/Home.css) `:root`
> 원칙: 인라인 hex 금지 · 버튼 pill 금지 · 색 단독 의미전달 금지(텍스트/아이콘 병행) · 로딩/빈/에러 3종 상태는 기존 `StateViews` 재사용 · 다크모드는 토큰으로 자동 통과.

이 문서는 **신규 CSS·마크업이 필요한 부분만** 토큰값까지 명세한다. 기존 클래스(`page-header` / `filter-btn` / `Pagination` / `StateViews`)는 재사용하며 재정의하지 않는다.

---

## 0. 재사용 인벤토리 (새로 만들지 말 것)

| 필요 | 재사용 대상 | 위치 |
|---|---|---|
| 페이지 헤더(eyebrow/title/subtitle/actions) | `.page-header` `.page-eyebrow` `.page-title` `.page-subtitle` `.page-header-actions` | App.css:437-477 |
| 로딩/빈/에러 상태 | `LoadingState` `EmptyNoDataState` `EmptyFilteredState` `ErrorState` | components/states/StateViews |
| 페이지네이션 | `<Pagination>` (filter-btn 기반) | components/Pagination.jsx |
| 카드 호버/포커스 골격 | `.trending-card` 패턴(News) — **그대로 쓰지 말고 아래 신규 `.repo-card`로 분기**, 단 호버/포커스 규칙은 동일 토큰 | News.css:28-65 |
| 외부링크 아이콘 + SR 안내 | `<ExternalLinkIcon />` + `.sr-only` | components/ExternalLinkIcon.jsx |
| 네비 햄버거/패널/Escape·바깥클릭 닫기 | App.js menuOpen 패턴 + `.navbar-menu(-open)` | App.js:56-208 / App.css:359-398 |

---

## 1. 목표 → 사용자 흐름 → 정보구조

**목표**: "지금 뜨는 신생 고별점 AI 오픈소스"를 한글 설명 + 주제 군집으로 스캔 가능하게 제공.

**핵심 흐름**
1. 네비 `트렌드 ▾` → `깃헙 트렌드` 진입.
2. 상단에서 범위(`주간`/`월간`) 선택 → 데이터 갱신.
3. 주제 칩으로 관심 군집 필터(선택형, 단일 토글).
4. 레포 카드 스캔 → 외부 링크로 이동(새 창).
5. 페이지네이션으로 더 보기.

**정보구조(위→아래)**
```
page-header  (eyebrow "트렌드" / title "깃헙 트렌드" / subtitle + 정의 툴팁 / actions: 세그먼트 토글 + 신선도 메타)
└ trend-toolbar
   ├ 세그먼트 토글  [주간 | 월간]        ← actions 영역에 배치
   └ 신선도 라벨   "업데이트: 5월 30일"   ← actions 영역 우측
trend-theme-filter  (주제 군집 칩 + 카운트, 가로 wrap, "전체" 포함)
trend-results
   ├ 결과 요약 라인  "전체 · 42개"  /  "에이전트 · 8개"
   ├ repo-grid (repo-card × N)
   └ Pagination
```

---

## 2. 네비게이션: 트렌드 드롭다운 (신규 패턴 1)

기존 평면 `뉴스` 링크를 **`트렌드 ▾` 드롭다운**으로 승격. 하위: `뉴스`(/news, 유지) · `깃헙 트렌드`(/trends/github, 신규).

### 2.1 데스크톱(≥769px) — hover + click 겸용 disclosure

마크업(개념):
```
<div class="nav-dropdown">                         // li 역할, position:relative
  <button class="nav-link nav-dropdown-trigger"
          aria-expanded={open} aria-haspopup="true" aria-controls="trend-submenu">
    트렌드 <Chevron aria-hidden />
  </button>
  <div id="trend-submenu" class="nav-dropdown-menu" role="menu">
    <NavLink className="nav-dropdown-item" role="menuitem" to="/news">뉴스</NavLink>
    <NavLink className="nav-dropdown-item" role="menuitem" to="/trends/github">깃헙 트렌드</NavLink>
  </div>
</div>
```

동작:
- 마우스: 트리거 영역 hover 시 메뉴 표시(`onMouseEnter`/`Leave`, 200ms 닫힘 지연 권장).
- 키보드: 트리거 `Enter/Space` → 토글, `ArrowDown` → 첫 아이템 포커스, `Escape` → 닫고 트리거로 포커스 복귀, 메뉴 안 `Tab`/`Arrow`로 항목 이동.
- 하위 경로 중 하나라도 활성이면 트리거에 `nav-link-active` 적용(부모 활성 표시).
- 셰브론은 열림 시 180° 회전(`transform: rotate(180deg)`, `transition: transform var(--transition-fast)`).

신규 CSS:
```css
.nav-dropdown { position: relative; display: inline-flex; }

.nav-dropdown-trigger {
  /* .nav-link 상속(색·폰트·패딩·min-height 40px·radius-md). 추가만: */
  gap: var(--spacing-xs);
  background: transparent;
  border: none;
  font-family: var(--font-family);
  cursor: pointer;
}
.nav-dropdown-trigger .chevron {
  transition: transform var(--transition-fast);
}
.nav-dropdown-trigger[aria-expanded="true"] .chevron {
  transform: rotate(180deg);
}

.nav-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  margin-top: var(--spacing-xs);
  padding: var(--spacing-xs);
  display: flex;
  flex-direction: column;
  gap: 2px;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);   /* 8px 카드 라운드 */
  box-shadow: var(--shadow-md);
  z-index: 50;
}
.nav-dropdown-menu[hidden] { display: none; }  /* 닫힘 = hidden 속성 */

.nav-dropdown-item {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-weight: 500;
  text-decoration: none;
  min-height: 40px;
  display: flex;
  align-items: center;
  transition: color var(--transition-fast),
              background-color var(--transition-fast);
}
.nav-dropdown-item:hover {
  color: var(--color-text-primary);
  background-color: var(--color-primary-surface);   /* 잉크 틴트 4% */
}
.nav-dropdown-item.nav-link-active {
  color: var(--color-primary);
  font-weight: 600;
}
.nav-dropdown-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

### 2.2 모바일(≤768px) — 들여쓰기 그룹(기존 햄버거 패널 안)

드롭다운을 만들지 않고 **그룹 헤더 + 들여쓴 하위 링크**로 펼친다(기존 8cd2f0f 세로 패널 재사용). 클릭 시 `closeMenu()` 호출(기존과 동일).

```
<div class="nav-group">
  <span class="nav-group-label" id="trend-group">트렌드</span>      // 비링크 라벨
  <NavLink class="nav-link nav-link-sub" to="/news">뉴스</NavLink>
  <NavLink class="nav-link nav-link-sub" to="/trends/github">깃헙 트렌드</NavLink>
</div>
```

신규 CSS(모바일 미디어쿼리 안):
```css
.nav-group-label {
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--color-text-tertiary);   /* eyebrow 톤 */
}
.nav-link-sub {
  padding-left: var(--spacing-xl);      /* 들여쓰기 24px */
}
```
> 데스크톱에서는 `.nav-group-label`을 숨기고(`display:none`) 2.1 드롭다운만 노출, 모바일에서는 드롭다운 트리거를 숨기고 들여쓰기 그룹만 노출 — 동일 라우트를 두 마크업으로 분기하거나, 단일 마크업 + 미디어쿼리로 표시 전환. **frontend-react가 단일 마크업 분기 방식 선택**(권장: 미디어쿼리 표시 전환으로 DOM 단순화).

### 2.3 푸터 정합
푸터 `footer-nav`에 `깃헙 트렌드`(`/trends/github`) 링크 추가. 기존 `뉴스` 링크 유지(둘 다 평면 나열, 푸터는 드롭다운 불필요).

---

## 3. 세그먼트 토글: 주간 / 월간 (신규 패턴 2)

라디오 그룹 형태. **pill 금지** → `radius-md`. 단일 선택, 활성 상태는 색 + 굵기 둘 다.

마크업(접근성: `role="radiogroup"`):
```
<div class="segmented" role="radiogroup" aria-label="기간 선택">
  <button role="radio" aria-checked={p==='weekly'} class="segmented-item is-active">주간</button>
  <button role="radio" aria-checked={p==='monthly'} class="segmented-item">월간</button>
</div>
```
키보드: `ArrowLeft/Right`로 항목 이동 + 즉시 선택(WAI-ARIA radiogroup). 활성 항목만 `tabindex=0`, 나머지 `-1`.

```css
.segmented {
  display: inline-flex;
  padding: 2px;                              /* 트랙 인셋 */
  gap: 2px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.segmented-item {
  padding: var(--spacing-sm) var(--spacing-lg);
  min-height: 36px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);           /* 4px, 트랙 안쪽 */
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-fast),
              background-color var(--transition-fast);
}
.segmented-item:hover { color: var(--color-text-primary); }
.segmented-item.is-active {
  background-color: var(--color-primary-darker);   /* 잉크 솔리드 */
  color: var(--color-on-primary);                  /* AA */
  font-weight: 600;
}
.segmented-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```
배치: `page-header-actions` 안 좌측. 터치 타깃 ≥36px(뷰포트 44px 권장으로 모바일에서 패딩 유지).

---

## 4. 트렌딩 정의 노출 (열린 질문 #3 → 채택)

오해("유명한데 왜 없지?") 방지를 위해 정의를 **subtitle + info 툴팁**으로 노출.
- subtitle: `최근 생성된 급부상 오픈소스를 별점순으로. 주간=7일, 월간=30일 내 생성.`
- title 옆 info 아이콘 버튼(`aria-label="트렌딩 기준 안내"`), 클릭/hover/focus 시 툴팁:
  `"트렌딩 = 최근 생성 + 고별점. 오래된 인기 레포(예: PyTorch)는 포함되지 않습니다."`

툴팁 신규 CSS(작고 절제):
```css
.info-tip { position: relative; display: inline-flex; }
.info-tip-btn {
  width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer; border-radius: var(--radius-full);
}
.info-tip-btn:hover { color: var(--color-text-secondary); }
.info-tip-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--color-focus-ring); }
.info-tip-bubble {
  position: absolute; top: calc(100% + var(--spacing-xs)); left: 0;
  width: max-content; max-width: 280px;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-secondary);
  z-index: 40;
}
.info-tip-bubble[hidden] { display: none; }
```
> 모바일에서는 좌측이 잘리면 `right:0`로 맞춤(frontend-react 판단). 키보드/스크린리더: 버튼 `aria-describedby`로 버블 연결, hover/focus 모두에서 표시.

---

## 5. 주제 군집 칩 (신규 패턴 3 — 필터 칩 + 카운트 + 단일 토글)

기존 `.filter-btn`을 **확장**한다(카운트 배지만 추가). 활성 상태는 기존 `.filter-btn.active` 토큰 재사용 → 색 반전. "전체"가 기본 활성.

마크업:
```
<div class="theme-filter" role="group" aria-label="주제 군집 필터">
  <button class="filter-btn theme-chip is-active" aria-pressed="true">
    전체 <span class="chip-count">42</span>
  </button>
  <button class="filter-btn theme-chip" aria-pressed="false">
    에이전트 <span class="chip-count">8</span>
  </button>
  ...
</div>
```
- 단일 선택 토글(라디오 의미지만 `aria-pressed` 토글 버튼으로 단순화 — 같은 칩 재클릭 시 "전체"로 복귀).
- 활성: `.filter-btn.active`(잉크 배경 + on-primary + 글로우) 재사용. **활성 표시는 색 + 굵기 + 카운트 대비**로 중복 신호 → 색 단독 아님.
- 카운트 0인 테마는 렌더하지 않음(빈 결과 방지 원칙).

신규 CSS(filter-btn 위 최소 추가):
```css
.theme-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
.theme-chip { display: inline-flex; align-items: center; gap: var(--spacing-sm); }

.chip-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 18px; padding: 0 var(--spacing-xs);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm); font-weight: 600; line-height: 1;
  /* 비활성 칩: 잉크 틴트 카운터 */
  background-color: var(--color-primary-surface-strong);
  color: var(--color-text-secondary);
}
/* 활성 칩 안 카운트는 잉크 배경 위 → 반전 대비 확보 */
.theme-chip.active .chip-count {
  background-color: var(--color-primary-surface-strong);
  color: var(--color-on-primary);
}
```
> `.theme-chip`은 활성 클래스로 기존 `.filter-btn.active`를 그대로 쓰되, 위 카운트 자식 색만 분기. `is-active`/`active` 명명은 frontend-react가 기존 filter-btn 컨벤션(`active`)에 맞춤.

---

## 6. 레포 카드 `.repo-card`

카드 골격은 News `.trending-card`의 호버/포커스 토큰을 따르되, 정보 위계는 신규.

### 6.1 정보 위계 결정 (핸드오프 7장 → 채택)
**1차 시선 = 레포명(타이틀)**, 2차 = 한글 설명, 별점은 우상단 메타로 보조.
근거: 사용자는 "무엇인가"를 먼저 식별하고(이름+한글설명), 별점은 신뢰 보조 신호. 별점을 1차로 키우면 랭킹 나열이 되어 "발견" 가치가 약해진다. 단 별점은 스캔 가능하도록 우상단 고정 위치 + 아이콘.

### 6.2 레이아웃(저해상도)
```
┌─────────────────────────────────────────┐
│ [owner avatar 28]  owner/repo      ★ 1.2k │  ← 헤더 row (space-between)
│ ── 레포명 (title, 1차) ───────────         │
│ 한글 번역 설명 (body, 2줄 clamp, 2차)       │
│ [원문 폴백 라벨? — 번역 없을 때만]          │
│ ── 메타 row ───────────────────────        │
│ ● Python   #에이전트  #RAG                  │  ← 언어 dot + topic 칩(최대 3)
│ 깃헙에서 보기 ↗ (외부링크)                   │  ← 카드 전체 링크 or 명시 링크
└─────────────────────────────────────────┘
```

### 6.3 마크업(개념) + 접근성
- 카드 전체를 `<a>`로 감싸지 말고(중첩 회피 + 외부링크 명시), **카드 본문은 정적 + 하단 "깃헙에서 보기 ↗" 외부 링크**(새 창, `rel="noopener noreferrer"`, `<ExternalLinkIcon/>` + `.sr-only`("새 창에서 열림")). 또는 News `trending-card`처럼 카드 전체 `<a target=_blank>` — frontend-react 택1, **권장: 카드 전체 링크**(스캔/클릭 면적↑), 단 외부창 안내는 카드 `aria-label`에 포함.
- 별점: `aria-label="별 1,234개"`, 숫자는 1.2k 압축 표기 + 툴팁 원수치.
- 토픽 칩은 비링크(시각 분류만) — 클릭 시 해당 테마 필터로 점프하면 가치↑(선택 구현).

### 6.4 신규 CSS
```css
.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-xl);             /* 24px, 카드 그리드 표준 */
}

.repo-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);    /* 8px */
  padding: var(--spacing-xl);         /* 24px */
  text-decoration: none;
  transition: box-shadow var(--transition-fast),
              transform var(--transition-fast),
              border-color var(--transition-fast);
}
.repo-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.repo-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.repo-card-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--spacing-sm);
}
.repo-owner {
  display: flex; align-items: center; gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-width: 0;
}
.repo-owner-avatar {
  width: 28px; height: 28px;
  border-radius: var(--radius-full);   /* 아바타만 원형 허용 */
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.repo-stars {
  display: inline-flex; align-items: center; gap: var(--spacing-xs);
  font-size: var(--font-size-sm); font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap; flex-shrink: 0;
}
.repo-stars .star-icon { color: var(--color-text-tertiary); }  /* 채도색 금지 → 잉크 틴트 */

.repo-name {
  font-size: var(--font-size-xl);     /* 20px / 600, type.title */
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.2px;
  color: var(--color-text-primary);
}
.repo-card:hover .repo-name {
  color: var(--color-primary);
  text-decoration: underline;
}

.repo-desc {
  font-size: var(--font-size-base);   /* 14px / 1.6 */
  line-height: 1.6;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* 번역 폴백: 원문(영문)임을 작게 표시 */
.repo-desc-fallback {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.repo-meta {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: var(--spacing-sm);
  margin-top: auto;                   /* 카드 하단 정렬 */
}
.repo-lang {
  display: inline-flex; align-items: center; gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.repo-lang-dot {                      /* 언어 점 — 채도색 대신 잉크 틴트 통일 */
  width: 8px; height: 8px;
  border-radius: var(--radius-full);
  background-color: var(--color-text-tertiary);
}
.repo-topic {                         /* status-badge 계열 칩 */
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: var(--spacing-xs) var(--spacing-md);
}

.repo-link {
  display: inline-flex; align-items: center; gap: var(--spacing-xs);
  align-self: flex-start;
  font-size: var(--font-size-sm); font-weight: 600;
  color: var(--color-primary);
  text-decoration: none;
}
.repo-link:hover { text-decoration: underline; }
```
> 카드 전체 링크 방식을 택하면 `.repo-link`는 시각 어포던스(`깃헙에서 보기 ↗`)로만 두고 실제 href는 카드 `<a>`가 담당.

### 6.5 결과 요약 라인
```css
.trend-result-summary {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-lg);
}
```
문구: 필터 없을 때 `전체 · {n}개`, 테마 선택 시 `{테마} · {n}개`.

### 6.6 신선도 메타
`page-header-actions` 우측. `업데이트: {수집일}` — `formatDate` 재사용.
```css
.trend-freshness {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}
```

---

## 7. 상태 설계 (전 화면 동일 StateViews 재사용)

| 상태 | 컴포넌트 | 문구/처리 |
|---|---|---|
| 로딩(최초/범위·필터 전환) | `LoadingState` | "트렌딩을 불러오는 중…". 전환 중 이전 결과 유지 + 상단 비차단 스피너도 허용(권장: 그리드 자리 dim) |
| 에러 | `ErrorState` | "트렌딩을 불러오지 못했어요." + 재시도 → 현재 범위·필터로 refetch |
| 빈 결과(원칙상 0, 방어) | `EmptyNoDataState` | "이 기간에 표시할 트렌딩이 없어요. 다른 기간을 선택해보세요." + CTA "월간 보기"(반대 범위) |
| 테마 필터 결과 0 | `EmptyFilteredState` | "이 주제에 해당하는 레포가 없어요." + "전체 보기"로 필터 해제 |
| 번역 폴백(부분) | 카드 내 `.repo-desc-fallback` | 한글 없으면 원문 표시 + "원문" 미세 라벨. 페이지 전체 상태 아님 |
| 토픽 없는 레포 | 카드 내 | 언어 테마 또는 "기타"로 폴백. 칩 미표시 가능, 언어 dot은 유지 |

- 칩/세그먼트 전환 시 결과 영역만 갱신(헤더·필터 고정) → 레이아웃 점프 방지.
- 로딩 중 칩/토글 `disabled` 또는 `aria-busy="true"`(중복 요청 방지).

---

## 8. 반응형

| 브레이크포인트 | 변경 |
|---|---|
| ≥769px 데스크톱 | repo-grid auto-fill 2~3열, 네비 드롭다운(hover/click), 헤더 actions 한 줄 |
| ≤768px | repo-grid 1열, 네비 햄버거 패널 + 들여쓰기 그룹, 세그먼트 토글 풀폭(`width:100%`, item `flex:1`), 신선도 메타 줄바꿈 |
| ≤640px | container 패딩 `spacing-md`, 테마칩 갭 `spacing-xs`, 툴팁 버블 `right:0` 정렬, repo-card 패딩 `spacing-lg` |

```css
@media (max-width: 768px) {
  .repo-grid { grid-template-columns: 1fr; }
  .segmented { width: 100%; }
  .segmented-item { flex: 1; }                 /* 터치 면적 */
  .nav-dropdown { display: none; }             /* 데스크톱 드롭다운 숨김 */
  .nav-group-label { display: block; }         /* 모바일 그룹 라벨 노출 */
}
@media (min-width: 769px) {
  .nav-group-label, .nav-link-sub-mobile { display: none; }  /* 모바일 그룹 숨김 */
}
@media (max-width: 640px) {
  .repo-card { padding: var(--spacing-lg); }
  .theme-filter { gap: var(--spacing-xs); }
}
```

---

## 9. 접근성 체크리스트 (AA)

- **대비**: 모든 텍스트는 토큰 조합으로 AA 충족(잉크 솔리드 위 `on-primary` = AA). 채도색은 도입하지 않음(언어 dot·별 아이콘도 잉크 틴트).
- **색 단독 금지**: 활성 칩 = 색 + 굵기 + 카운트 대비, 세그먼트 = 색 + 굵기 + `aria-checked`. 외부링크 = 아이콘 + SR 텍스트.
- **키보드**: 드롭다운(Arrow/Esc/Enter), 세그먼트 radiogroup(Arrow), 칩(Tab + Enter/Space), 카드 링크 `focus-visible` 링, 페이지네이션(기존).
- **시맨틱**: `role=radiogroup`/`radio`, `role=menu`/`menuitem`, `aria-expanded`/`aria-haspopup`, `aria-pressed`(칩), `aria-current="page"`(활성 NavLink), `aria-busy`(로딩), `aria-label`(별점·외부창·아바타 alt).
- **포커스 관리**: 드롭다운 Esc 닫힘 → 트리거 복귀. 모바일 패널은 기존 App.js menuOpen 흐름 그대로.
- **모션**: 카드/셰브론 transition은 `prefers-reduced-motion` 존중(기존 spin 패턴처럼 reduce 시 transform 제거 권장).
- **터치 타깃**: 세그먼트·칩 ≥36px(모바일 44px), 카드 링크/드롭다운 항목 ≥40px.

---

## 10. 토큰 추가 필요 여부

**신규 토큰 불필요.** 모든 값이 기존 `:root`(spacing/radius/color/shadow/transition/font)로 커버됨. 단 frontend-react는 위 클래스를 별도 `frontend/src/styles/GithubTrends.css`로 스코프하고, 네비 드롭다운/그룹 CSS만 `App.css`에 추가(네비는 전역).

---

## 11. 구현 분담 노트 (frontend-react)

- 신규 페이지 `pages/GithubTrends.jsx` + `styles/GithubTrends.css`. 라우트 `/trends/github`(App.js Routes 추가).
- `services/api.js`에 `trendingAPI.getGithubTrending({ period, theme, limit, offset })` 추가(직접 axios 금지). 응답 `{success, data, pagination}` 가정.
- 네비: App.js에 드롭다운 + 모바일 그룹 마크업, 기존 `뉴스` 평면 링크 제거 후 그룹으로 이동.
- 상태 4종은 기존 `StateViews` import만(신규 상태 컴포넌트 만들지 말 것).
- 페이지네이션은 `<Pagination currentPage totalPages onPageChange ariaLabel="트렌딩 페이지">`.
- `npm run build` 무경고 통과 필수.
- **애널리틱스(열린질문 #5)**: 코드에 측정 수단 존재 여부 확인 후 칩/링크 클릭 이벤트 훅 위치만 표시(없으면 무동작).

---

## 12. 열린 디자인 질문

1. **테마 칩 다중 선택?** 현재 스펙은 단일 토글(스캔 단순). 다중 선택 니즈가 있으면 `active-filter-chip`(×제거) 패턴 추가 필요 — product-strategist 확인.
2. **토픽 칩 → 필터 점프** 동작을 v1에 넣을지(카드 내 칩 클릭 시 해당 테마 필터). 발견성↑ vs 구현 비용. 권장: v1.1.
3. **별점 표기 압축 규칙**(1.2k vs 1,234) — tools-data-curator와 데이터 포맷 합의. 스펙은 압축+툴팁 권장.
4. **언어 색 점**을 깃헙 공식 언어색으로 쓸지 vs 잉크 틴트 통일. 디자인 원칙(무채색)상 **잉크 틴트 통일** 권장하나, 개발자 인지 친숙도(깃헙 언어색)와 트레이드오프 — 색 쓰면 "색 단독 금지" 위해 언어명 텍스트 필수 동반. 현 스펙은 무채색 채택.
5. **드롭다운 모바일 마크업**: 단일 DOM + 미디어쿼리 표시전환 vs 분기 렌더 — frontend-react 구현 편의로 택1(권장 전자).
6. **카드 클릭 = 외부 새 창** vs 내부 중간 페이지: v1은 외부 직행. 향후 큐레이션 도구 매칭(비범위) 생기면 내부 상세 검토.
