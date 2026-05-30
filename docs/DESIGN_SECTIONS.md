# DESIGN_SECTIONS.md — 4개 핵심 페이지 섹션별 디자인 스펙

> 작성일: 2026-05-31 · 작성: ux-ui-designer
> 범위: 홈/탐색 · 비교 · 추천 · 도구 상세 4개 페이지의 **섹션별 레이아웃·컴포넌트·상태·접근성 스펙**. 구현 안 함(스펙만). frontend-react가 바로 구현 가능한 토큰값 수준.
> 정본: IA는 [PRODUCT_PLAN.md](PRODUCT_PLAN.md), 토큰은 [frontend/src/styles/Home.css](../frontend/src/styles/Home.css) `:root`(최종 정본), 서술은 [DESIGN.md](DESIGN.md).
> 제약(헌법): Home.css `:root` 토큰만 사용 · 인라인 hex 금지(필요 토큰은 §6 신규 토큰 제안에 모음) · 버튼 pill 금지 · 색만으로 의미 전달 금지(텍스트/아이콘 병행) · 다크모드 자동 통과 · 반응형 ≤768px.

---

## 0. 공통 규약 (4개 페이지 전부 적용)

이 절의 토큰·패턴을 모든 페이지에서 재사용한다. 페이지 절에서 반복하지 않는다.

### 0.1 컨테이너 · 리듬
- **콘텐츠 max-width**: `1200px` (`.container`), 좌우 패딩 `--spacing-lg`(16px). ≤640px에서 `--spacing-md`(12px).
- **섹션 수직 패딩**: 데스크톱 `--spacing-3xl`(48px), ≤768px `--spacing-2xl`(32px).
- **페이지 헤더 ↔ 본문 간격**: `--spacing-2xl`(32px).
- **섹션 간 분리**: 흰 여백 갭이 아니라 `--color-surface` 상승 + 1px `--color-border` 헤어라인으로 나눈다. 새 회색 단계 만들지 않는다.

### 0.2 surface 위계 (2단)
- 페이지 캔버스 = `--color-background`. 카드·입력·테이블·필터바·패널 = `--color-surface` + 1px `--color-border`.
- 깊이가 더 필요하면 그림자 신설 대신 헤어라인 강도(또는 `--shadow-sm`)로. `--shadow-md`는 호버/들림에만, `--shadow-lg`는 1차 버튼 호버/모달에만.

### 0.3 페이지 헤더 (Compare/Recommendations/Details 공통 — 기존 `.page-header` 재사용)
- 구조: `.page-eyebrow`(eyebrow) → `.page-title`(display) → `.page-subtitle`(body-lg).
- eyebrow: `--font-size-sm`(12px)/600, uppercase, letter-spacing +0.5px, `--color-text-secondary`, 하단 `--spacing-sm`.
- title: `--font-size-3xl`(32px)/700, letter-spacing -0.5px, `--color-text-primary`.
- subtitle: `--font-size-lg`(16px)/400, `--color-text-secondary`, 상단 `--spacing-sm`.
- ≤640px: title `--font-size-2xl`(24px)로 축소.

### 0.4 버튼 (기존 `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-small` 재사용 — pill 금지)
| 변형 | 배경 | 텍스트 | 테두리 | 라운드 | 패딩 | 높이 |
|---|---|---|---|---|---|---|
| `.btn-primary` | `--color-primary` | white | 없음 | `--radius-md` | `--spacing-md --spacing-lg` | ≥40px |
| `.btn-secondary` | transparent | `--color-primary` | 1px `--color-primary` | `--radius-md` | 동일 | ≥40px |
| `.btn-small` | `--color-surface` | `--color-text-primary` | 1px `--color-border` | `--radius-md` | `--spacing-sm --spacing-lg` | ≥36px |
| `.ghost-button` | transparent | `--color-text-secondary` | 없음 | `--radius-md` | `--spacing-sm --spacing-md` | ≥36px |

- **상태(공통)**:
  - hover(primary): `--color-primary-dark` + `--shadow-lg` + `translateY(-2px)`.
  - active/press(primary): `--color-primary-darker` + `translateY(0)`.
  - hover(secondary): 배경 `--color-primary-surface`(lavender 5%).
  - **focus-visible(전부)**: `outline:none; box-shadow: 0 0 0 3px var(--color-focus-ring)`(이미 `.btn:focus-visible`에 적용됨).
  - disabled: `opacity:0.5; cursor:not-allowed; pointer-events:none` — hover/transform 없음.
  - transition: 색은 `--transition-fast`, box-shadow/transform은 `--transition-normal`.

### 0.5 상태뷰 (기존 `StateViews.jsx` 4종 — 페이지마다 새로 만들지 않는다)
- `LoadingState`: 40px/3px lavender 스피너 + `--font-size-base` `--color-text-secondary` 메시지. 중앙 정렬.
- `EmptyFilteredState`: SearchEmptyIcon(50% opacity) + title + message + `state-cta-secondary`(초기화). 필터/검색 0건 회복용.
- `EmptyNoDataState`: ComingSoonIcon + "준비 중" 배지(중립색, **에러 빨강 금지**) + title + message + (선택)CTA. `inline` 변형은 섹션 내 인라인용(아이콘 32px). 데이터 미적재(벤치마크/뉴스) 전용.
- `ErrorState`: `--color-error-surface` 배경 + 1px `--color-error-border` + ErrorIcon + title + message + `state-cta-error`(재시도). 네트워크/5xx/4xx.
- 규칙: **로딩=스피너, 0건=Filtered, 미적재=NoData(중립), 실패=Error(빨강)**. 이 어휘를 섞지 않는다.

### 0.6 접근성 공통
- **포커스 링**: 모든 인터랙티브 요소 `box-shadow: 0 0 0 3px var(--color-focus-ring)`, `:focus-visible`로(마우스 클릭 시 비노출). 입력은 추가 `inset 0 0 0 2px rgba(94,92,230,0.1)`.
- **대비**: 본문 `--color-text-secondary`(#6B7280) on surface = WCAG AA 통과. `--color-text-tertiary`는 플레이스홀더/비활성 등 비필수 텍스트에만(본문 금지).
- **터치 타깃**: 버튼 ≥40px · 칩 ≥36px(터치 뷰포트 ≥44px) · 입력 ≥44px(이미 적용).
- **색만으로 의미 금지**: 난이도·우위·상태는 색 + 점/아이콘 + 텍스트 동반.
- **시맨틱**: 페이지당 `<h1>` 1개, 섹션 `<h2>`, 카드 `<h3>`. 동적 영역은 `aria-live="polite"`, 에러는 `role="alert" aria-live="assertive"`.

---

## 1. 홈 / 탐색 (`/` · Home.jsx · styles/Home.css)

IA 순서(PRODUCT_PLAN §1.2): 히어로 → 검색+필터 → (활성 필터 칩) → 결과 헤더 → 도구 그리드 → 빈 상태 → 하단 CTA. 추가: §1.4 비교 담기 바(G-C).

### 1.1 히어로 (P0, 있음)
- **레이아웃**: 풀블리드 섹션, `min-height:100vh`(현행), 콘텐츠 중앙 정렬 스택, max-width `720px` 내부 텍스트. 배경 lavender 그라데이션 **opacity 0.05**(유일 예외, 현행 `.hero-gradient` 유지).
- **요소 간격**: badge → title `--spacing-lg`, title → subtitle `--spacing-md`, subtitle → CTA `--spacing-xl`.
- **타이포**: badge=`hero-badge`(아래) / title=`type.hero` clamp(28–48px)/700/lh1.2 / subtitle=`--font-size-lg`/400 `--color-text-secondary`.
- **`.hero-badge`**(기존): 배경 lavender 10%, 1px lavender 20%, 텍스트 `--color-primary`, `--font-size-sm`/600, `--radius-full`(배지이므로 pill 허용), 패딩 `--spacing-xs --spacing-md`.
- **CTA `.cta-button`**(기존): lavender, `--font-size-lg`, 패딩 `--spacing-lg --spacing-2xl`, `--radius-lg`, 아이콘 갭 `--spacing-md`. 한 화면 1차 액션은 이것 하나.
- **반응형 ≤768px**: title clamp 하한 적용(≈32px), CTA `width:100%`. ≤640px title≈24px.

### 1.2 검색 + 필터 (P0, 있음)
- **레이아웃**: `.search-filter` 섹션 = `--color-surface` 바탕 + 상하 1px `--color-border`. 내부 `.container`. 검색 → 필터 그룹 세로 스택, 간격 `--spacing-xl`.
- **검색 입력 `.search-input`**(기존): 배경 `--color-background`, 1px `--color-border`, `--radius-md`, 패딩 `--spacing-lg`(좌측 아이콘 폭 가산), 높이 ≥44px. 좌측 아이콘 `--color-text-tertiary`. placeholder `--color-text-tertiary`.
  - focus: 테두리 `--color-primary` + `inset 0 0 0 2px rgba(94,92,230,0.1), 0 0 0 3px var(--color-focus-ring)`.
  - ≤640px: font 16px(iOS 줌 방지).
- **필터 그룹**: `.filter-label`(eyebrow: 12px/600 uppercase +0.5px `--color-text-secondary`) + `.filter-buttons`(flex wrap, 갭 `--spacing-sm`).
- **필터 칩 `.filter-btn`**(기존): transparent, 1px `--color-border`, `--color-text-primary`/500, `--radius-md`, 패딩 `--spacing-sm --spacing-lg`, 높이 ≥36px.
  - hover: 테두리·텍스트 `--color-primary`.
  - active(`.active`): 배경 `--color-primary`, white, 글로우 `0 0 0 3px rgba(94,92,230,0.1)`.
  - focus-visible: `0 0 0 3px var(--color-focus-ring)`.
  - aria: 칩은 `role="button"`/`aria-pressed`(단일 선택 그룹이면 `aria-pressed` 정확히 1개 true).

### 1.3 활성 필터 칩 요약 (P1, **신규** — PRODUCT_PLAN §1.3)
스크롤 후 "내가 뭘 걸었는지" 유지. 결과 헤더 **위**, 필터 섹션과 그리드 사이.
- **레이아웃**: flex wrap, 갭 `--spacing-sm`, 상하 `--spacing-md`. 활성 필터(검색어/카테고리/난이도)가 1개 이상일 때만 렌더.
- **제거형 칩 `.active-filter-chip`**(신규 클래스): 배경 `--color-primary-surface`(lavender 5%), 1px `rgba(94,92,230,0.2)`, 텍스트 `--color-primary`, `--font-size-sm`/600, `--radius-full`(배지 계열), 패딩 `--spacing-xs --spacing-md`, 높이 ≥28px. 형식 `[라벨: 값  ×]`.
  - 우측 `×` 제거 버튼: 별도 ≥24px 클릭 영역, `aria-label="<라벨> 필터 제거"`. hover 시 `×` 색 `--color-error`(텍스트 "제거" 의미를 aria-label로 병행).
- **"모두 지우기"**: 칩 줄 끝에 `.ghost-button`, `resetFilters` 연결.
- 색만으로 의미 전달 금지: 칩은 라벨 텍스트("카테고리: 글쓰기")를 항상 포함.

### 1.4 비교 담기 바 (P1, **신규** G-C — PRODUCT_PLAN §1.3/§5)
카드에서 비교 선택 시 진입점 가시화. `selectedToolsForCompare.length > 0`일 때만.
- **권장 형태**: 그리드 상단 sticky 요약 바(또는 데스크톱 우하단 고정 바). 모바일은 화면 하단 고정.
- **레이아웃**: `.compare-tray`(신규) — `--color-surface`, 1px `--color-border`, `--radius-lg`, `--shadow-md`, 패딩 `--spacing-md --spacing-lg`, flex(좌: 카운터 / 우: CTA), 갭 `--spacing-md`.
- **카운터**: `.counter-pill`(기존 재사용) "비교함 N / 5", `aria-live="polite"`.
- **CTA**: `.btn-primary` "비교하기 →"(href `/compare`) + `.ghost-button` "비우기"(clearCompareList).
- sticky: `position:sticky; top:0; z-index:10`(헤더와 충돌 시 top 보정). 모바일 `position:fixed; bottom:0; left:0; right:0`, `--radius-lg` 상단만, 안전영역 `padding-bottom: env(safe-area-inset-bottom)`.

### 1.5 결과 헤더 + 도구 그리드 (P0, 있음)
- **`.tools-header`**: 좌측 `.tools-title`(heading 24px/700) + 우측 `.tools-count`(caption `--color-text-secondary` "N개의 AI 도구"). 정렬 옵션(P1) 추가 시 우측에 `<select>` 또는 칩 토글(이름순/사용자수순) — `.btn-small` 스타일 재사용.
- **그리드 `.tools-grid`**(기존): `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, 갭 `--spacing-xl`. 데스크톱 3~4열 / 태블릿 2열 / ≤768px 1열.
- **진입 애니메이션**: `fadeIn`(현행), 과한 stagger 금지.

### 1.6 ToolCard — 상세 진입 affordance 추가 (P0, **G-A** 최우선 — PRODUCT_PLAN §1.3/§5)
현행 카드 푸터 버튼은 "방문하기"(외부) + "비교"뿐 → `/details/:id` 동선 부재. 비주얼 설계:
- **권장: 카드 본문 영역을 상세 링크로** — 로고/이름/설명/메타 묶음(`.card-header`+`.card-body`)을 `<a href="/details/:id">` 또는 `react-router <Link>`로 감싼다. 푸터의 "방문하기"(외부)·"비교"(토글)는 링크 **바깥**에 두어 중첩 인터랙션 방지.
  - 카드 hover affordance(기존): `translateY(-2px)` + `--shadow-md`. 상세 진입 가능함을 알리도록 hover 시 이름 `.card-title-info h3` 색을 `--color-primary`로(텍스트 변화로 명시, 밑줄은 hover에만).
  - 카드 전체 `cursor:pointer`(링크 영역만). 푸터 버튼 영역은 기본 커서.
  - 키보드: 링크는 자연 tab 진입, focus-visible 시 카드에 포커스 링(`box-shadow: 0 0 0 3px var(--color-focus-ring)` inset 또는 outer). `aria-label="<이름> 상세 보기"`.
- **대안(중첩 회피 보수안)**: 푸터에 3번째 버튼 "자세히"(`.btn-secondary` 계열, 텍스트형). 단 푸터 3버튼은 ≤480px에서 세로 스택(현행 `.card-footer` 480 분기 활용). **권장은 본문-링크안**(클릭 영역 큼·전환율↑).
- **선택 상태 시각화(G-C 연계)**: 비교 선택 시 `.tool-card.selected`(기존: 1px `--color-primary` + `0 0 0 1px` 링) 적용 + 푸터 버튼 "✓ 선택됨"(`.btn-secondary.active` lavender 채움). 색+체크표시+텍스트 3중 표기로 접근성 충족.

### 1.7 빈 상태 / 하단 CTA
- **빈 상태**: `EmptyFilteredState`(기존). isFiltered면 "조건에 맞는 결과가 없습니다" + 초기화 CTA, 아니면 "표시할 도구가 없습니다"(초기화 없음). 자책 카피 금지.
- **하단 CTA `.footer-cta`**(기존): 중앙 정렬, heading + 설명 + 버튼 그룹(`.btn-primary` 도구 비교 / `.btn-secondary` 맞춤 추천). ≤768px 버튼 세로 스택·풀폭.

### 1.8 상태 디자인 (Home)
- 로딩: `LoadingState "도구를 불러오는 중..."`(그리드 자리). 빈/에러/그리드는 상호배타.
- 에러: `ErrorState` + `onRetry=fetchTools`.
- 부분누락: 해당 없음(Home은 단일 목록).

### 1.9 신규 토큰
- 추가 불필요. (활성 필터 칩의 lavender 20% 테두리만 §6에서 토큰화 권고 — 현재 인라인 rgba 다수 사용처와 통일 위해.)

### 1.10 구현 시 손댈 파일
- `frontend/src/components/ToolCard.jsx` (G-A 본문 링크·focus·aria), `frontend/src/styles/ToolCard.css` (hover 이름색·focus 링).
- `frontend/src/pages/Home.jsx` (활성 필터 칩 줄·비교 담기 바·정렬), `frontend/src/styles/Home.css` (`.active-filter-chip`, `.compare-tray`).

---

## 2. 비교 (`/compare` · Compare.jsx · styles/Compare.css)

IA(PRODUCT_PLAN §2.2): 페이지 헤더 → 빈/부분 상태 안내 → 비교 표(데스크톱) / 비교 카드(모바일).

### 2.1 페이지 헤더 (P0, 있음)
- `.page-header`(공통 §0.3): eyebrow "비교" → title "AI 도구 비교" → subtitle "N개의 도구를 나란히 비교하고 있습니다".
- **`.page-header-actions`**: flex 우측, 갭 `--spacing-md`.
  - `.counter-pill`(기존): "선택 N / 5", 배경 `--color-surface`, 1px `--color-border`, `--font-size-sm`/600 `--color-text-secondary`, `--radius-full`, `aria-live="polite"`.
  - `.ghost-button` "초기화" → clearCompareList.

### 2.2 비교 표 — 데스크톱 (P0, 있음)
- **컨테이너 `.comparison-table`**: 배경 `--color-surface`, 1px `--color-border`, `--radius-xl`, `--shadow-md`, `overflow-x:auto`, `tabIndex=0`, `role="region"` + 가로스크롤 안내 aria-label(현행).
- **셀 패딩** `--spacing-lg`(16px), 셀 하단 1px `--color-border`.
- **헤더 행**: 도구별 로고(40px, `--radius-md`) + 이름(`--font-size-base`/600). **첫 열 sticky-left**, **헤더 sticky-top**(`position:sticky`). 헤더 배경은 `--color-surface`(스크롤 시 비침 방지 불투명).
- **행 라벨(첫 열) `.label`**: `--color-text-secondary`/600, sticky-left, 배경 `--color-surface`.
- **행 순서(의사결정 우선, PRODUCT_PLAN §2.4)**: 가격 → 난이도 → 사용자 수 → 벤치마크(준비중) → 링크. *현행은 카테고리·난이도·사용자수·가격·벤치마크·링크 — 가격을 위로 올리는 재배열 권고(frontend-react 판단).*
- **난이도 셀**: `.difficulty {값}` 클래스(기존 매핑) — 색 + 텍스트. 점(●) 동반 권고(카드와 일관).
- **벤치마크 셀**: 데이터 0건 → `.cell-coming-soon` "준비 중"(중립 `--color-text-tertiary`, 배지 아님). 행 자체는 유지(데이터 적재 시 자동 채움). 새 가치 약속 카피 금지.
- **링크 셀**: `.btn-small` "방문 →"(외부).

### 2.3 비교 표 헤더 → 상세 링크 (P0, **G-A 연장** — PRODUCT_PLAN §2.3)
- 헤더의 로고+이름 묶음을 `/details/:id` 링크로. hover 시 이름 `--color-primary`. `aria-label="<이름> 상세 보기"`. 정렬·외부방문 버튼과 분리(중첩 회피).

### 2.4 차이 강조 — 우위 표시 (P1, **신규** — PRODUCT_PLAN §2.3, 열린질문)
보유 데이터로 계산(가격 최저·사용자수 최다). **색만으로 금지 → 텍스트 병행 필수.**
- **`.cell-best`**(신규/DESIGN.md 예고): 배경 lavender 6%(`--color-primary-surface`보다 옅게 — §6 토큰 제안), 텍스트 `--color-primary`/700, **prefix 텍스트 배지** "최저"/"최다"(아이콘 ▲ 또는 🏆 + 텍스트). 단정 카피("최고") 금지 — "이 항목 최저/최다" 사실 진술.
- 적용 행: 가격(최저), 사용자 수(최다). 난이도는 주관 → 강조 안 함.
- aria: 강조 셀에 `<span class="sr-only">이 항목에서 가장 낮음</span>` 등 스크린리더 보조.

### 2.5 비교 카드 — 모바일 ≤768px (P0, 있음)
- 데스크톱 `.comparison-table` 숨김, `.comparison-cards` 표시(CSS `@media`).
- **`.comparison-card`**: 배경 `--color-surface`, 1px `--color-border`, `--radius-lg`, 패딩 `--spacing-lg`, 카드 간 갭 `--spacing-lg`, 세로 스택.
  - header: 로고(40px) + 이름(`--font-size-lg`/600). → 상세 링크 동일 적용.
  - `<dl>` 행: `dt`(라벨 `--color-text-secondary`/600) ↔ `dd`(값), 행 간 `--spacing-md`, 라벨/값 space-between. **표 헤더가 없으므로 각 항목 라벨을 카드 안에 명시**(접근성, 현행 패턴 유지).

### 2.6 도구 추가/교체 동선 (P0, **신규** — PRODUCT_PLAN §2.3)
비교 안에서 빈 슬롯 채우기(이탈 없이 완성).
- **`.compare-add-slot`**(신규): 표 마지막 열(또는 카드 목록 끝)에 점선 1px `--color-border`(dashed), `--radius-lg`, 중앙 "＋ 도구 추가"(`.btn-secondary` 텍스트형), 높이 표 행과 정렬. N=5 도달 시 비활성(disabled, "최대 5개" 안내).
- 클릭 → 인라인 검색 패널(또는 모달): `.search-input` 재사용 + 결과 리스트(`getTools`), 항목 선택 시 store add. 모달 시 `--color-background` + `--shadow-lg` + `--radius-xl`, 포커스 트랩.

### 2.7 상태 디자인 (Compare)
- 미선택(`length===0`): `EmptyNoDataState`(SearchEmptyIcon) "비교할 도구를 선택해주세요" + "도구 탐색하기" CTA(`/`). *§2.6 도입 시 여기에 "지금 추가" 1차 동선 병행 권고.*
- 로딩: `LoadingState "비교 정보를 불러오는 중..."`.
- 에러: `ErrorState` + retry.
- 결과 0건(선택은 했으나 전부 누락): `EmptyFilteredState` + "선택 초기화".
- **부분 누락**(결과<선택): `.compare-partial-notice`(`role="status"`) — `--color-surface` 또는 warning 12% 틴트 배경, 1px 헤어라인, `--radius-md`, 패딩 `--spacing-md`. 누락 도구명 `.compare-missing-names`(`--color-text-primary`/600)로 명시. 빨강(에러) 아님 — 정보성. 현행 패턴 유지.

### 2.8 신규 토큰
- `--color-primary-surface-strong`(lavender 6%) 1개 권고(§6) — `.cell-best` 배경. 기존 `--color-primary-surface`(5%)와 미세 구분.

### 2.9 구현 시 손댈 파일
- `frontend/src/pages/Compare.jsx` (행 재배열·헤더 상세링크·우위강조·추가슬롯), `frontend/src/styles/Compare.css` (`.cell-best`, `.compare-add-slot`, sticky 보강).

---

## 3. 추천 (`/recommendations` · Recommendations.jsx · styles/Recommendations.css)

IA(PRODUCT_PLAN §3.2): 페이지 헤더 → 탭(업무별/직업별) → 선택지 그리드 → (결과 맥락) → 결과 그리드 → 빈 상태(2분기) → 초기 안내.

### 3.1 페이지 헤더 (P0, 있음)
- `.page-header`(공통): eyebrow "맞춤 추천" → title "나에게 맞는 AI 도구" → subtitle.

### 3.2 탭 — 업무별/직업별 (P0, 있음)
- **`.recommendation-tabs`**(`role="tablist"`): flex, 하단 1px `--color-border`(밑줄형 탭). 각 `.tab` 패딩 `--spacing-md --spacing-lg`, `--font-size-base`/500, `--color-text-secondary`.
  - active(`.active`, `aria-selected`): 텍스트 `--color-primary`/600 + 하단 2px `--color-primary` 인디케이터(밑줄). **밑줄+굵기+색 3중 표기**(색만 의존 금지).
  - hover(비활성): 텍스트 `--color-text-primary`.
  - focus-visible: `0 0 0 3px var(--color-focus-ring)`.
  - 라운드 없음(밑줄형). pill 금지 준수.

### 3.3 선택지 그리드 (P0, 있음)
- **`.selection-area`** → `.options`: 제목 `<h3>`(title 20px/600) "업무를/직업을 선택하세요" + `.option-grid`(flex wrap, 갭 `--spacing-sm`).
- **`.option-btn`**(필터 칩 계열, 기존): transparent, 1px `--color-border`, `--color-text-primary`/500, `--radius-md`, 패딩 `--spacing-sm --spacing-lg`, 높이 ≥36px. `aria-pressed`.
  - hover/active/focus: §1.2 `.filter-btn`과 동일 상태 토큰. active = lavender 채움.
- 옵션 0건(메타 로드 실패/중): `.state-message`(`role="status"`) "선택지를 불러오는 중이거나 준비된 분류가 없습니다."

### 3.4 결과 헤더 맥락화 (P1, **신규** — PRODUCT_PLAN §3.3)
- 현행 "추천 결과" → "'개발자'에게 추천하는 도구 N개"처럼 선택 맥락 명시. `<h2>`(heading) + 선택값 강조(`--color-primary`/600). `aria-live="polite"`.

### 3.5 결과 그리드 + 추천 근거 (P1, **신규** — PRODUCT_PLAN §3.3)
- **그리드**: `.tools-grid`(Home과 동일 토큰) + `ToolCard` 재사용 → §1.6 상세 링크·비교 담기 affordance 그대로 상속(G-A·G-C가 추천에도 자동 적용).
- **추천 근거 한 줄(신규)**: ToolCard 본문에 매칭 태그 칩 줄 추가 — `.match-reason`(신규): `--font-size-sm` `--color-text-secondary`, prefix 아이콘 + "콘텐츠작성·마케터 태그 일치". 매칭 태그는 `.status-badge` 계열(배경 `--color-surface`, 1px `--color-border`, `--radius-full`, `--font-size-sm`). 신뢰·설명가능성↑. 데이터는 `tool_tags`로 이미 존재.
  - 카드 변형으로 `ToolCard`에 옵셔널 prop(`reasonTags`) 추가 권고 — 추천 페이지에서만 렌더.

### 3.6 상태 디자인 (Recommendations — 2분기가 핵심)
- 초기(미선택): `.state-container`(`role="status"`) "업무 또는 직업을 선택하면 추천이 표시됩니다". 중앙, `--color-text-secondary`.
- 로딩: `LoadingState "추천을 불러오는 중..."`.
- 에러: `ErrorState` + retry(선택값 유지).
- **0건 2분기(정합성 핵심, 유지)**:
  - `feature_status==='coming_soon'`(태그 미적재): `EmptyNoDataState`(중립, ComingSoonIcon, "준비 중" 배지) + "도구 탐색하기" CTA. **빨강 금지**.
  - 그 외(해당 선택만 0건): `EmptyFilteredState` "다른 업무/직업을 선택해보세요" + "선택 초기화".
- 탭 전환 시 결과/선택/에러 초기화(현행) — 위계 혼선 방지.

### 3.7 신규 토큰
- 추가 불필요. (`.match-reason` 태그는 기존 `.status-badge` 토큰 재사용.)

### 3.8 구현 시 손댈 파일
- `frontend/src/pages/Recommendations.jsx` (결과 맥락 헤더·근거 prop 전달), `frontend/src/components/ToolCard.jsx` (`reasonTags` 옵셔널), `frontend/src/styles/Recommendations.css` (`.match-reason`).

---

## 4. 도구 상세 (`/details/:id` · Details.jsx · styles/Details.css)

IA(PRODUCT_PLAN §4.2): 뒤로가기 → 헤더 → 가격 → 벤치마크(준비중) → 뉴스(준비중). 추가: 태그(§4.3)·관련 도구(§4.6).

### 4.1 뒤로가기 — 맥락화 (P0, **G-B** — PRODUCT_PLAN §4.3)
- **`.back-btn`**: 좌상단, 텍스트형(`.ghost-button` 계열), "← 뒤로가기", `--color-text-secondary`, hover `--color-text-primary`. 높이 ≥40px, 좌측 아이콘 갭 `--spacing-xs`.
- **동작 변경 권고**: `navigate('/')` → `navigate(-1)`(추천/비교에서 진입 시 맥락 복귀). 히스토리 없을 때(직접 진입) 폴백 `/`. *구현 판단은 frontend-react.*
- 페이지 헤더와 간격 `--spacing-lg`.

### 4.2 헤더 (P0, 있음)
- **`.details-header`**: 좌 로고(64px, `--radius-lg`) + 우 `.header-info` 스택. 갭 `--spacing-xl`. ≤768px 세로 스택.
- **`.header-info`**: `.page-eyebrow`(카테고리) → `.page-title`(이름, display 32px/700) → `.description`(body-lg, `--color-text-secondary`, line-clamp 없음 전체) → `.meta`(국가·난이도) → 액션 버튼.
- **`.meta`**: 국가(`.status-badge` 계열) + 난이도(`.difficulty-badge {값}` — 점+텍스트, 카드와 동일). 갭 `--spacing-sm`.
- **액션 버튼 그룹**: `.btn-primary` "공식 사이트 방문 →"(외부, 1차) + **§4.4 비교 담기**(2차). 갭 `--spacing-md`. ≤480px 세로 스택·풀폭.

### 4.3 태그 노출 (P1, **신규** — PRODUCT_PLAN §4.3)
- 헤더 근처(meta 아래 또는 description 위) task/profession 태그 칩 줄. `.detail-tags`(신규): flex wrap, 갭 `--spacing-sm`. 각 칩 = `.status-badge` 계열(`--color-surface`, 1px `--color-border`, `--radius-full`, `--font-size-sm`, `--color-text-secondary`). "이 도구는 어떤 업무/직무용인지" 즉시 전달, 추천과 일관. 데이터 `tool_tags`.

### 4.4 헤더 "비교 담기" (P1, **신규** G-C — PRODUCT_PLAN §4.3)
- 액션 그룹에 `.btn-secondary` "비교에 추가"(미선택) / "✓ 비교함"(선택, `.btn-secondary.active` lavender 채움). store add/remove 토글. 색+체크+텍스트 3중 표기. `aria-pressed`.

### 4.5 가격 (P0, 있음)
- **`.pricing-section`**: `<h2>` "가격"(heading) + `.pricing-grid`(`repeat(auto-fill, minmax(220px,1fr))`, 갭 `--spacing-lg`).
- **`.pricing-card`**: `--color-surface`, 1px `--color-border`, `--radius-lg`, 패딩 `--spacing-xl`. 구조: `<h3>` plan_name(title) → `.price` → `<p>` description(`--color-text-secondary`).
- **`.price`**: `--font-size-2xl`/700. **무료는 `--color-success` + "무료" 텍스트**(색+텍스트), 유료는 `--color-text-primary` "$N/period". 색만 의존 금지.

### 4.6 관련 도구 (P1, **신규** — PRODUCT_PLAN §4.3)
- **`.related-section`**: `<h2>` "관련 도구"(heading) + `.tools-grid`(같은 토큰) + `ToolCard`(같은 category N개). 상세 링크·비교 담기 affordance 상속. 재탐색·비교 깔때기. 자기 자신 제외, N=3~6.

### 4.7 벤치마크 / 뉴스 (P1·P2, 데이터 0건 — "준비 중" 유지)
- 두 섹션 **항상 렌더(숨김 금지)**. 각 `<h2>` + 본문 상태분기:
  - 로딩: `LoadingState`. 에러(5xx 등): `ErrorState` + retry. 404/0건: `EmptyNoDataState inline`(중립, "준비 중" — **빨강 아님**).
- 데이터 있을 때(향후): 벤치마크 `.benchmark-grid`(점수 카드, score/100) + 평균. 뉴스 `.news-list`(카드: 제목·내용·원문 링크).
- 카피: "아직 검증된 벤치마크 점수가 없습니다"(현행 담백함 유지). 페이지 핵심 가치로 카피하지 않는다.

### 4.8 상태 디자인 (Details — 헤더 3분기)
- 헤더 로딩: `LoadingState "도구 정보를 불러오는 중..."`(전체 페이지).
- 헤더 에러: `ErrorState` + `fetchToolDetail(id)`.
- 404(`!selectedTool`): `EmptyNoDataState` "도구를 찾을 수 없습니다" + "전체 도구 보기" CTA(`/`).
- 본문 섹션(가격/벤치/뉴스)은 각자 독립 상태(부분 실패가 페이지 전체를 막지 않음 — 현행 패턴 우수).

### 4.9 신규 토큰
- 추가 불필요(`.detail-tags`·관련도구 모두 기존 토큰 재사용).

### 4.10 구현 시 손댈 파일
- `frontend/src/pages/Details.jsx` (back `navigate(-1)`·태그·비교담기·관련도구), `frontend/src/styles/Details.css` (`.detail-tags`, `.related-section`, 액션 그룹).

---

## 5. 페이지 간 일관성 체크리스트 (frontend-react 구현 가이드)

- [ ] 상세 진입(G-A)은 `ToolCard` 본문-링크 **한 패턴**으로 Home·추천·관련도구·비교헤더 전부에 동일 적용.
- [ ] 비교 담기(G-C)는 카드/상세 모두 `.btn-secondary.active`(lavender 채움 + ✓ + 텍스트) 동일 표기.
- [ ] 상태뷰는 `StateViews.jsx` 4종만 사용. 페이지별 커스텀 로딩/에러 금지.
- [ ] 난이도·우위·무료가격·상태 = 색 + 아이콘/점/배지 + 텍스트 3중.
- [ ] 모든 인터랙티브 요소 `:focus-visible` 포커스 링(`--color-focus-ring`).
- [ ] 새 색·간격·라운드 신설 금지 — §6 외 인라인 hex 0건.
- [ ] ≤768px: 카드 그리드 1열 · 비교 테이블→카드 스택 · 버튼 풀폭 · 비교 담기 바 하단 고정.
- [ ] 다크모드: 모든 신규 클래스가 토큰만 사용 → 자동 통과 확인.

---

## 6. 신규 토큰 제안

대부분 기존 토큰으로 충분. 아래 2건만 신설 권고(인라인 rgba 반복을 토큰화해 일관성·다크모드 안정성 확보).

| 토큰명 | 라이트 값 | 다크 값 | 용도 |
|---|---|---|---|
| `--color-primary-surface-strong` | `rgba(94, 92, 230, 0.10)` | `rgba(94, 92, 230, 0.18)` | 비교 표 우위 강조 셀(`.cell-best`) 배경, hero-badge 배경, 활성 칩 글로우 통일. (현재 0.06/0.10이 인라인 산재) |
| `--color-primary-border` | `rgba(94, 92, 230, 0.20)` | `rgba(94, 92, 230, 0.30)` | 활성 필터 칩(`.active-filter-chip`)·hero-badge 테두리. (현재 인라인 lavender 20% 다수) |

- 다크모드 값을 약간 올린 이유: 다크 캔버스(#0F172A)에서 동일 alpha는 시각적으로 더 옅게 보여 대비 손실. opacity를 한 단계 보강해 동일 인지 강도 유지.
- 위 2건 외 **추가 불필요**. `.cell-best`의 lavender 6%는 위 strong(10%)로 통일하거나, DESIGN.md 예고대로 별도 6%가 꼭 필요하면 `--color-primary-surface-strong`을 6%로 잡고 hero-badge는 별도 처리(frontend-react/디자인 합의).
- 신설 시 `Home.css :root` + `@media(prefers-color-scheme:dark)` + `[data-theme="dark"]` 3곳 모두 정의(현행 다크 패턴과 동일).

---

## 7. 열린 디자인 질문

1. **ToolCard 상세 진입(G-A) 형태**: 본문 전체 링크(권장·클릭영역 큼) vs 푸터 "자세히" 버튼 추가(중첩 안전). 본문 링크 시 내부 "비교"/"방문" 버튼과의 중첩 인터랙션 처리 합의 필요(stopPropagation/링크 분리).
2. **비교 담기 바(§1.4) 위치**: 그리드 상단 sticky vs 화면 하단 고정 바. 모바일은 하단 고정이 자연스러우나 데스크톱 위치를 product-strategist와 확정.
3. **우위 강조(§2.4)** 도입 여부: "최저/최다"가 객관 데이터지만 단정으로 읽힐 위험(PRODUCT_PLAN §7-3). 텍스트 병행으로 완화 가능 — 도입할지 결정.
4. **`.cell-best` 강조 강도**: lavender 6% vs 10%(§6). 다크모드 가독성 테스트 후 확정.
5. **상세 뒤로가기(§4.1)**: `navigate(-1)` vs "전체 도구 보기" 고정 라벨 유지(PRODUCT_PLAN §7-2). 둘 다 둘지(아이콘 뒤로 + 보조 "전체 보기")도 옵션.
6. **추천 근거 칩(§3.5)**을 `ToolCard` 변형으로 넣을지, 추천 전용 래퍼 카드로 분리할지 — 컴포넌트 책임 경계 frontend-react와 협의.
7. **정렬 옵션(§1.5)** UI: `<select>` vs 칩 토글. 백엔드 정렬 파라미터 유무(backend-fastapi) 확인 후 결정.
