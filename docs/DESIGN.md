# AITools Design System

> **AITools** — AI 도구 비교 플랫폼. Linear Design System을 기반으로 한 **라이트-캔버스, 데이터 밀도 중심**의 제품 디자인 언어.
> 정본 토큰 소스: [frontend/src/styles/Home.css](../frontend/src/styles/Home.css) `:root`. 이 문서는 그 토큰을 서술·확장한 것이며, 토큰 값이 바뀌면 Home.css가 우선한다.

---

## 색 정책 갱신 (2026-06-28) — 이 노트가 우선

> 리브랜딩(Grepity)에 맞춰 색 정책을 일부 완화한다. **아래가 현재 정본**이며, 본문 곳곳의 "채도 0 / 채도 높은 브랜드색 없음 / 시맨틱도 그레이 강제" 류 강성 문구는 이 노트로 **대체**된다.

- **기본 골격 유지** — 무채색 캔버스 + 잉크(`--color-primary`) 강조는 그대로 제품의 기본 언어다(절제 우선).
- **유채색 시맨틱 허용** — success/warning/error 등 **의미 있는 색은 채도를 가져도 된다**(다크에서 그레이 강제 아님). 단 **색 단독 의미전달 금지** — 명도/아이콘/텍스트를 항상 병행(접근성, 유지).
- **브랜드 포인트 색 허용** — 절제된 1종 포인트 색을 둘 수 있다. 현재: **워드마크 커서 그린** `--brand-cursor`(라이트=잉크 `var(--color-text-primary)`, **다크=터미널 그린 `#86EFAC`**). 토큰으로만 사용(인라인 hex 금지 — 토큰가드 유지, hex는 Home.css에서만).
- **추가 규칙**: 새 색은 반드시 Home.css `:root`/다크 블록에 **토큰으로** 추가하고 사용처는 `var(--…)` 참조. 무분별한 유채색 남발은 여전히 지양(포인트는 인색하게).

---

## Overview

AITools는 Linear의 절제된 시스템 미감을 **라이트 캔버스**에서 구현한다. Linear가 다크 캔버스 위에 제품 스크린샷을 주인공으로 세우고, Apple이 사진 위에 UI를 숨긴다면, AITools의 주인공은 **데이터** — 78개+ AI 도구의 카드, 비교 테이블, 벤치마크 점수다. 따라서 우리 시스템은 사진이 아니라 **스캔 가능성(scannability)**과 **정보 위계**를 위해 설계된다.

캔버스는 순백 `{colors.background}` (#FFFFFF), 그 위에 한 단계 들린 `{colors.surface}` (#F9FAFB)가 카드·패널·입력의 바탕이 된다. 깊이는 그림자가 아니라 **1px 헤어라인 `{colors.border}` (#E5E7EB) + 미묘한 surface 상승**으로 만든다. 시스템은 **무채색(monochrome) 캔버스 + 잉크(검정 계열 그레이) 단일 강조**로 운영한다 — 채도 높은 브랜드색은 없고, 유일한 강조는 잉크 `{colors.primary}` (라이트 #111827) 한 색으로 CTA, 포커스 링, 활성 필터, 링크 강조에만 인색하게 쓴다. 흰 텍스트가 올라가는 1차 버튼/CTA/활성칩 배경은 AA 대비를 위해 가장 진한 잉크 `{colors.primary-darker}` (라이트 #030712, 순흑 #000000은 금지)를 쓰고, 그 위 텍스트/아이콘은 `{colors.on-primary}` (라이트 #FFFFFF)다. 강조는 테마에 따라 **반전**된다: 라이트=어두운 잉크 강조, 다크=밝은 잉크 강조(다크 캔버스 #0D1117에서 어두운 잉크는 보이지 않으므로 `{colors.primary}`를 #E6EDF3 계열로 재정의하고 그 위 텍스트는 어두운 잉크 #0D1117). 시맨틱 색(success/warning/error)은 이 무채색 규칙의 **예외로 그대로 유지**되어 난이도(쉬움/보통/어려움)와 상태를 색+아이콘+텍스트로 함께 전달한다.

타이포그래피는 **Inter** 한 가족으로 display부터 caption까지 한 목소리를 낸다(가중치 400/500/600/700). 페이지 리듬은 Linear/Apple처럼 풀블리드 섹션 교차가 아니라, **카드 그리드 + 비교 테이블 + 필터 칩**이라는 SaaS형 밀도다. 다크모드는 `prefers-color-scheme`로 토큰 레벨에서 자동 전환된다 — 두 레퍼런스가 단일 테마만 가진 것과 달리, 우리는 **라이트가 기본이되 다크를 1급으로 지원**한다.

**Key Characteristics:**
- **라이트-캔버스 데이터 시스템** — `{colors.background}` (#FFFFFF)가 앵커, `{colors.surface}` (#F9FAFB)가 한 단계 위.
- **무채색 + 단일 잉크 강조** (`{colors.primary}` — 라이트 #111827 / 다크 #E6EDF3) — CTA·포커스·활성 상태·링크에만 인색하게. 강조는 테마 반전(라이트=어두운 잉크 / 다크=밝은 잉크). 솔리드 배경은 `{colors.primary-darker}`(라이트 #030712 / 다크 #B6BFC9), 그 위 텍스트는 `{colors.on-primary}`(라이트 #FFFFFF / 다크 #0D1117)로 AA 확보. 채도 높은 브랜드 강조색 없음.
- **그림자 최소, 헤어라인 중심** — 깊이는 `{colors.border}` 1px + surface 상승. `{shadow.md}`는 호버/들린 카드에만.
- **데이터가 주인공** — 도구 카드 그리드와 비교 테이블의 스캔 가능성이 최우선. 장식 크롬 없음.
- **Inter 단일 보이스** — display 700 → body 400, 한 가족. 음수 자간은 큰 헤드라인에만 가볍게.
- **카드 = `{rounded.lg}` 8px**, 큰 패널 = `{rounded.xl}` 12px. 버튼·입력은 `{rounded.md}` 6px. pill은 배지·필터에만.
- **다크모드 1급 지원** — 모든 색을 토큰으로만 쓰면 다크 전환은 무료.
- 채도 높은 2차 브랜드색 없음. 분위기 그라데이션 없음(히어로 0.05 틴트 1곳 예외). 스포트라이트 카드 없음.

---

## Colors

> 정본: [Home.css `:root`](../frontend/src/styles/Home.css#L5). 라이트가 기본, 다크는 `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`에서 surface/border/text 토큰과 **잉크 강조 계열(primary/on-primary/틴트/포커스)을 밝은 잉크로 반전** 재정의한다. 시맨틱 색(success/warning/error)은 두 테마 모두 유지된다.

### Brand & Accent (무채색 · 잉크)

강조는 **단일 잉크(검정 계열 그레이) 한 색**이며 테마에 따라 반전된다 — 라이트는 어두운 잉크, 다크는 밝은 잉크. 채도 높은 브랜드색은 없다. 순흑 #000000은 금지(가장 진한 값도 #030712).

- **Ink** (`{colors.primary}` — 라이트 #111827 / 다크 #E6EDF3): 시그니처 강조. 링크, 포커스 링 루트, 테두리·아이콘 강조, 1차 버튼 **호버** 배경. 라이트에서 흰 배경 위 본문 텍스트로 써도 무방하나(잉크=텍스트 명도), 강조 의미로만 인색하게 쓴다.
- **Ink Dark** (`{colors.primary-dark}` — 라이트 #0B1120 / 다크 #E5E7EB): 1차 버튼/CTA 프레스(active) 보조 단계.
- **Ink Darker** (`{colors.primary-darker}` — 라이트 #030712 / 다크 #B6BFC9): **1차 버튼·CTA·활성 필터칩·배지의 솔리드 배경**. 그 위 텍스트/아이콘은 `{colors.on-primary}`.
- **On Primary** (`{colors.on-primary}` — 라이트 #FFFFFF / 다크 #0D1117): 솔리드 잉크 배경 위 텍스트/아이콘 색. 라이트=흰텍스트 on 어두운 잉크, 다크=어두운 텍스트 on 밝은 잉크. 양쪽 AA 확보.
- **Ink Tint 4%** (`{colors.primary-surface}` — 라이트 `rgba(17,24,39,0.04)` / 다크 `rgba(241,245,249,0.06)`): btn-secondary 호버, footer-cta 단색 그라데이션, category-badge 바탕.
- **Ink Tint Strong** (`{colors.primary-surface-strong}` — 라이트 `rgba(17,24,39,0.06)` / 다크 `rgba(241,245,249,0.10)`): 활성 필터칩·트레이 카운터·hero badge 배경, 활성 글로우.
- **Ink Border** (`{colors.primary-border}` — 라이트 `rgba(17,24,39,0.16)` / 다크 `rgba(241,245,249,0.22)`): 잉크 틴트 면의 1px 테두리(칩·badge·카운터).

> 강조 토큰 계열은 `:root`(라이트, 어두운 잉크)와 다크 2블록(`@media` + `[data-theme="dark"]`, 밝은 잉크)에 각각 정의된다. 다크에서는 캔버스(#0D1117) 대비 인지 강도 보존을 위해 색을 밝은 잉크로 반전하고 틴트 알파를 조정한다. 시맨틱 색(아래)은 무채색 규칙의 예외로 두 테마 모두 유지된다.

### Surface
- **Background** (`{colors.background}` — #FFFFFF / dark #0D1117): 기본 페이지 캔버스.
- **Surface** (`{colors.surface}` — #F9FAFB / dark #161B22): 한 단계 위 — 카드, 입력, 비교 테이블, 검색/필터 섹션 바탕.
- **Border** (`{colors.border}` — #E5E7EB / dark #2A2F37): 1px 헤어라인 — 카드, 구분선, 입력 테두리, 테이블 셀 라인.

> Linear의 4단 surface 사다리와 달리 우리는 **background → surface 2단**이면 충분하다. 더 깊은 위계가 필요하면 헤어라인 강도(2px) 또는 `{shadow}`로 표현하고, 임의의 회색 단계를 새로 만들지 않는다.

### Text
- **Ink** (`{colors.text-primary}` — #111827 / dark #E6EDF3): 모든 헤드라인·본문 강조.
- **Ink Secondary** (`{colors.text-secondary}` — #6B7280 / dark #9198A1): 부가 설명, 메타, 카드 본문.
- **Ink Tertiary** (`{colors.text-tertiary}` — #9CA3AF / dark #6E7681): 플레이스홀더, 비활성, 각주.

### Semantic
- **Success** (`{colors.success}` — #16A34A): 난이도 "쉬움". *(무료 가격·성공 토스트는 계획 — 현재 미구현)*. 10% 틴트 배경과 함께 배지로.
- **Warning** (`{colors.warning}` — #FB923C): 난이도 "보통".
- **Error** (`{colors.error}` — #EF4444): 난이도 "어려움", 에러 상태, 삭제 호버, 재시도 버튼.

> 시맨틱 색은 **배지·상태**에만. Linear처럼 마케팅 면에 무분별하게 뿌리지 않는다. 색만으로 의미를 전달하지 말고 항상 텍스트/아이콘을 동반한다(접근성).

> **다크모드 캔버스는 중성 그레이**(`background` #121212 / `surface` #1C1C1C / `border` #313131)지만, **시맨틱 색은 유채색을 유지한다**(정책 갱신, 상단 참조) — 다크 튜닝값: success `#4ADE80`(녹) / warning `#FB923C`(주) / error `#F87171`(적), 난이도 잉크는 이 토큰을 참조하고 배지 배경은 저알파 동색 틴트다. 의미는 **색 + 점 문자(○◐●) + 텍스트 라벨** 다중 채널로 전달한다(색 단독 금지).

### Note
순흑(`#000000`)을 텍스트나 배경에 쓰지 않는다 — Ink는 #111827이다. 다크모드 캔버스도 순흑이 아닌 #0D1117(slate)다.

---

## Typography

### Font Family
- **Inter** (`{font.family}`) — `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. display부터 caption까지 전 구간을 단일 가족으로 운용한다. 가중치 사다리는 **400 / 500 / 600 / 700**.
- 모노 가족은 정의하지 않는다. 코드/ID 토큰이 필요하면 `ui-monospace, SF Mono, Menlo` 폴백을 인라인으로 쓴다(드묾).

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{type.hero}` | clamp(28–48px) | 700 | 1.2 | 0 | 히어로 헤드라인 (반응형 clamp) |
| `{type.metric}` | 44px (`--font-size-4xl`) | 700 | 1 | -0.5px | 대형 지표 숫자 — 벤토 히어로 헤드라인(예: 깃헙 트렌드 큰 별점) |
| `{type.display}` | 32px (`--font-size-3xl`) | 700 | 1.2 | -0.5px | 페이지 타이틀 |
| `{type.heading}` | 24px (`--font-size-2xl`) | 700 | 1.3 | -0.3px | 섹션 제목, 카드 그룹 헤더 |
| `{type.title}` | 20px (`--font-size-xl`) | 600 | 1.4 | -0.2px | 카드 타이틀, 도구명 |
| `{type.body-lg}` | 16px (`--font-size-lg`) | 400 | 1.6 | 0 | 리드 문단, CTA 라벨 |
| `{type.body}` | 14px (`--font-size-base`) | 400 | 1.6 | 0 | 기본 본문, 테이블 셀, 카드 본문 |
| `{type.caption}` | 12px (`--font-size-sm`) | 400 | 1.4 | 0 | 캡션, 메타, 배지, 푸터 |
| `{type.button}` | 14px (`--font-size-base`) | 600 | 1.2 | 0 | 버튼 라벨 |
| `{type.eyebrow}` | 12px (`--font-size-sm`) | 600 | 1.3 | +0.5px | 필터 라벨 등 분류 라벨 (양수 자간, uppercase) |

### Principles
- **기본 본문은 14px (`--font-size-base`).** Apple의 17px과 달리, 데이터 밀도가 높은 비교/카드 UI에선 14px가 스캔에 유리하다. 리드/CTA만 16px.
- **단일 보이스.** display 700 → body 400, 같은 Inter. 별도 디스플레이 컷 없음.
- **음수 자간은 큰 헤드라인에만 가볍게**(-0.2 ~ -0.5px). 14px 이하엔 적용하지 않는다.
- **Eyebrow/필터 라벨은 양수 자간**(+0.5px) + uppercase — 분류 라벨임을 시각적으로 표시(`{filter-label}` 패턴, [Home.css:245-251](../frontend/src/styles/Home.css#L245-L251)).
- **가중치 500은 필터 버튼 등 "중간 강조"에만.** 헤드라인은 700, 본문 400, 버튼/타이틀 600.

### Note on Font
Inter는 무료 가변 폰트로 이미 채택돼 있다. macOS/iOS에선 `-apple-system` 폴백이 SF로 해석되며 자연스럽다. 별도 라이선스 없이 cross-platform 일관성을 보장한다.

---

## Layout

### Spacing System
- **Base unit:** 4px. 정본: [Home.css:20-29](../frontend/src/styles/Home.css#L20-L29).
- **Tokens:** `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.lg}` 16px · `{spacing.xl}` 24px · `{spacing.2xl}` 32px · `{spacing.3xl}` 48px · `{spacing.4xl}` 64px · `{spacing.5xl}` 96px.
- **카드 내부 패딩:** `{spacing.xl}` 24px (ToolCard, feature 카드). 테이블 셀: `{spacing.lg}` 16px.
- **버튼 패딩:** 1차 CTA `{spacing.lg} {spacing.2xl}` (16px 32px), 일반 버튼 `{spacing.md} {spacing.xl}` (12px 24px), 소형 `{spacing.sm} {spacing.lg}` (8px 16px).
- **입력 패딩:** `{spacing.lg}` 16px (검색 입력은 좌측 아이콘 폭만큼 가산).
- **섹션 수직 패딩:** `{spacing.3xl}` 48px (데스크톱), 모바일 `{spacing.2xl}` 32px.
- **랜딩 주요 섹션 간 간격:** `{spacing.5xl}` 96px — 홈(`/`)의 큰 섹션(Hero·맞춤추천·깃헙트렌드·벤치마크) 사이 일관 간격. `.curated-section`/`.bench-teaser` margin, `.recommend-panel` 상단 padding에 적용.

### Grid & Container
- **최대 콘텐츠 폭:** 1200px (`.container`, [Home.css:92-96](../frontend/src/styles/Home.css#L92-L96)), 좌우 `{spacing.lg}` 16px 패딩.
- **도구 카드 그리드:** `repeat(auto-fill, minmax(280px, 1fr))` — 데스크톱 자동 3~4열, 태블릿 2열, 모바일 1열. 갭 `{spacing.xl}` 24px.
- **비교 테이블:** 콘텐츠 폭 가득, 가로 스크롤(`overflow-x: auto`). 데스크톱은 가로 비교, 모바일(≤768px)은 도구별 세로 카드 스택으로 전환(별도 스펙 [UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md) 참조).
- **추천/필터:** 필터는 칩(`{filter-btn}`) 가로 wrap, 추천 결과는 카드 그리드 재사용.

### Whitespace Philosophy
캔버스(흰색)가 여백이다. 섹션은 흰 공백의 갭이 아니라 **surface 상승 + 헤어라인**으로 나뉜다. 카드 내부는 `{spacing.xl}` 24px로 숨 쉬게 하고, 일반 섹션 간은 `{spacing.3xl}` 48px, **랜딩 주요 섹션 간은 `{spacing.5xl}` 96px**로 더 크게 띄워 큐레이션의 호흡을 만든다. 데이터가 밀집된 비교 테이블은 셀 패딩을 `{spacing.lg}` 16px로 유지해 밀도와 가독성의 균형을 잡는다.

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | 그림자·테두리 없음 | 본문, 히어로 텍스트, 푸터 |
| 1 (헤어라인) | `{colors.surface}` 배경 + 1px `{colors.border}` | 기본 카드, 입력, 비교 테이블, 패널 |
| 2 (소프트) | `{shadow.sm}` (`0 1px 2px rgba(0,0,0,0.05)`) | 정적 들린 타일 |
| 3 (호버) | `{shadow.md}` (`0 4px 6px / 0 2px 4px`) + `translateY(-2px)` | 카드 호버, 1차 버튼 |
| 4 (강조) | `{shadow.lg}` (`0 10px 15px / 0 4px 6px`) | 1차 버튼 호버, 모달 |
| Focus | 포커스 링: `box-shadow: 0 0 0 3px {colors.focus-ring}` (잉크 링 — 라이트 `rgba(17,24,39,0.28)` / 다크 `rgba(241,245,249,0.36)`) (+ 입력은 inset 2px ink-tint-strong) | 포커스된 입력/버튼/필터 |

깊이는 **헤어라인 + surface**가 1차, 그림자는 인터랙션 피드백(호버/들림)에만. 정적 카드에 무거운 그림자를 깔지 않는다(Linear 정신). 다크모드에선 그림자가 약하므로 헤어라인(`{colors.border}` #2A2F37)이 위계를 진다.

### Decorative Depth
- **데이터 카드와 비교 테이블**이 시각적 주인공. 사진·일러스트 의존 없음.
- 분위기 그라데이션 없음. **예외**: 히어로 배경 — 기본 히어로는 잉크 그라데이션 **opacity 0.05**, 2단 Hero(`hero--split`)는 우측 위젯 뒤 **단일 잉크 radial 헤일로 ≤0.06 + 도트 그리드 패턴**(`{colors.border}`, 엣지로 마스크 페이드). 모두 **단일 잉크**만(`primary → primary-darker`), 채도색 금지. footer-cta도 잉크 틴트(`primary-surface`) 단색 평면화. 그 외 어떤 면에도 그라데이션 금지.
- 스포트라이트 카드·네온 글로우 없음. 강조는 잉크 틴트 + 가중치로만.

---

## Glassmorphism (Liquid Glass)

콘텐츠 **위에 떠 있는/상승한 레이어**에만 쓰는 반투명 + `backdrop-filter` 처리. 정본 토큰·유틸: [Home.css](../frontend/src/styles/Home.css) (`:root` 의 `--color-glass-*`·`--glass-*` 토큰, `.glass-strong`/`.glass-soft` 유틸).

### 원칙 · 사용 시점
- **허용:** 떠 있는 레이어 — GNB 플로팅 독, Compare 모달, Compare 독(트레이), Hero 배지. **+ 강조 surface 1개**(예: 추천 히어로 카드)까지 콘텐츠에 확장 가능.
- **금지:** 일반 도구 카드 그리드 전체, 본문 버튼, 텍스트 위 직접 적용.
- **남용 가드:** **한 화면에 글래스 면 최대 2개**(떠 있는 레이어 + 강조 1). 그 이상이면 위계가 무너진다. 글래스는 "위에 떠 있음"의 신호지 장식이 아니다.

### 토큰
| Token | Light | Dark | 용도 |
|---|---|---|---|
| `--color-glass-bg` | `rgba(249,250,251,.6)` | `rgba(28,28,28,.64)` | 반투명 패널 배경 |
| `--color-glass-border` | `rgba(255,255,255,.6)` | `rgba(255,255,255,.1)` | 글래스 보더 |
| `--color-glass-highlight` | `rgba(255,255,255,.6)` | `rgba(255,255,255,.12)` | 경면 sheen·rim(strong 전용) |
| `--glass-blur/saturate/brightness-strong` | `16px / 180% / 1.05` | 동일 | strong 티어 필터 |
| `--glass-blur/saturate-soft` | `14px / 160%` | 동일 | soft 티어 필터 |

### 2티어 레시피
| 티어 | 필터 | 광택 | 적용처 |
|---|---|---|---|
| **strong** (`.glass-strong`) | `blur(16) saturate(180%) brightness(1.05)` | inset sheen + `::after` 번짐 rim(1px, blur 1.5px) | Compare 모달, **GNB 독** |
| **soft** (`.glass-soft`) | `blur(14) saturate(160%)` | 없음(평평) | Compare 독, Hero 배지, 강조 카드 |

- **적용 방법:** 단순 면은 `.glass-strong`/`.glass-soft` 유틸 클래스. 커스텀 그림자·라운드가 필요한 컴포넌트(모달=`shadow-lg`, 독=`shadow-md`)는 유틸 대신 `--glass-*` 토큰을 자체 규칙에서 직접 참조한다(box-shadow 합성 충돌 회피).
- **Liquid 광택은 strong 티어 전용**. soft는 광택 없이 깔끔하게.

### 필수 폴백 (접근성 — 빠뜨리지 말 것)
- `@supports not (backdrop-filter)` → 불투명 `{colors.surface}` 배경(가독성 보장).
- `@media (prefers-reduced-transparency: reduce)` → 불투명 + 광택(`::after`) 제거.
- `@media (prefers-reduced-motion: reduce)` → 글래스 표면의 트랜지션/모핑 애니메이션 제거.
- 위 폴백은 `.glass-*` 유틸에 한 번 집약돼 있다. 토큰을 직접 쓰는 컴포넌트는 같은 폴백을 컴포넌트 CSS에 동봉한다.

### 주의
- `--color-glass-*`·overlay 의 rgba 리터럴은 **`Home.css :root`(토큰 정본)에서만** 정의한다(토큰 가드 G). 사용처 CSS엔 `var(--…)`로만.
- **미적용(예정):** GNB 독(`App.css`)은 strong 값과 동일하나 아직 토큰/유틸로 이전 전(리브랜드 WIP와 충돌 회피). 리브랜드 머지 후 `.glass-strong` 또는 토큰 참조로 정리.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 4px | 소형 칩, 상태 배지 |
| `{rounded.md}` | 6px | **모든 버튼, 입력, 필터 칩** |
| `{rounded.lg}` | 8px | **카드 (도구 카드, 추천 카드), CTA 버튼** |
| `{rounded.xl}` | 12px | 큰 패널, 비교 테이블 컨테이너, hero 카드 |
| `{rounded.2xl}` | 15px | 모달·글래스 패널(Compare 모달 등) |
| `{rounded.3xl}` | 20px | **벤토(Bento) 카드** — 큰 라운드 surface 셀 |
| `{rounded.full}` | 9999px | pill 배지, hero badge, 카운터 칩, 아바타 |

정본: [Home.css:44-49](../frontend/src/styles/Home.css#L44-L49). **버튼은 절대 pill로 만들지 않는다**(Linear 규칙) — `{rounded.md}` 6px 또는 `{rounded.lg}` 8px. pill(`{rounded.full}`)은 배지·카운터·뱃지 전용.

### Imagery Geometry
- **도구 로고:** `{rounded.md}`~`{rounded.lg}` 사각, 32~40px. 원형 처리 금지(브랜드 로고 보존).
- **아바타(향후 커뮤니티):** `{rounded.full}` 32~40px.
- 풀블리드 히어로 사진 없음 — 우리 제품의 시각 자산은 로고 타일과 데이터다.

---

## Components

> 실제 구현 위치를 함께 표기한다. 새 변형은 별도 항목으로 추가한다.

### Buttons

**`button-primary`** — 1차 잉크 CTA(`{colors.on-primary}` 텍스트, AA).
- 배경 **`{colors.primary-darker}`**(라이트 #030712 / 다크 #B6BFC9), 텍스트 `{colors.on-primary}`(라이트 #FFFFFF / 다크 #0D1117, 양쪽 AA), 타입 `{type.button}`, 패딩 `{spacing.md} {spacing.xl}`, 라운드 `{rounded.md}`, `{shadow.md}`.
- 호버: 배경 `{colors.primary}`(라이트 #111827 / 다크 #E6EDF3, **명도 이동** = 들림 신호) + `{shadow.lg}` + `translateY(-2px)`. 텍스트는 `{colors.on-primary}` 유지.
- 프레스: 배경 `{colors.primary-dark}`(라이트 #0B1120 / 다크 #E5E7EB).

**`cta-button`** — 대형 히어로 CTA. 같은 색 단계(기본 `{colors.primary-darker}` → 호버 `{colors.primary}` → press `{colors.primary-dark}`), `{type.body-lg}`, 패딩 `{spacing.lg} {spacing.2xl}`, 라운드 `{rounded.lg}`, 아이콘 갭 `{spacing.md}`.

**`button-secondary`** — 보조 버튼. 배경 transparent, 1px `{colors.border}`, 텍스트 `{colors.text-primary}`. 호버 시 테두리·텍스트 `{colors.primary}` + 잉크 틴트(`{colors.primary-surface}`) 배경. 활성(`.active`) 상태는 배경 `{colors.primary-darker}` + `{colors.on-primary}` 텍스트(AA).

**`button-small`** — 테이블 "방문 →" 등. 패딩 `{spacing.sm} {spacing.lg}`, 타입 `{type.caption}`~`{type.button}`, 라운드 `{rounded.md}`.

### Filters

**`filter-btn`** + **`filter-btn-active`** — 카테고리/난이도 필터 칩. 정본 [Home.css:259-282](../frontend/src/styles/Home.css#L259-L282).
- 기본: 배경 transparent, 1px `{colors.border}`, 텍스트 `{colors.text-primary}`, 가중치 500, 라운드 `{rounded.md}`, 패딩 `{spacing.sm} {spacing.lg}`. 호버 시 잉크 테두리·텍스트.
- 활성: 배경 `{colors.primary-darker}`(AA), 텍스트 `{colors.on-primary}`, 잉크 tint-strong 글로우(`0 0 0 3px {colors.primary-surface-strong}`).
- **`filter-label`**: 그룹 라벨 — `{type.eyebrow}` (12px/600, uppercase, +0.5px 자간), `{colors.text-secondary}`.

### Cards & Containers

**`tool-card`** — 핵심 카드. 도구 로고·이름·카테고리·메타·비교 추가 버튼. 구현 [ToolCard.jsx](../frontend/src/components/ToolCard.jsx).
- 배경 `{colors.surface}`, 1px `{colors.border}`, 라운드 `{rounded.lg}`, 패딩 `{spacing.xl}`. 호버: `{shadow.md}` + `translateY(-2px)`.

**`comparison-table`** — 비교 테이블 컨테이너. 배경 `{colors.surface}`, 1px `{colors.border}`, 라운드 `{rounded.xl}`, `{shadow.md}`, `overflow-x: auto`. 헤더 sticky-top, 첫 열 sticky-left. 셀 패딩 `{spacing.lg}`, 1px `{colors.border}` 하단 라인. ([UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md) 스펙)
**`recommendation-card`** — 맞춤 추천 결과 카드. tool-card 구조 재사용 + 매칭 근거(`{match-reason}`) 라인 추가(체크 아이콘 + "…태그 일치").

**`tool-card-link`** — tool-card 본문(헤더+바디)을 감싸는 상세 진입 링크(`/details/:id`). 호버 시 도구명 `{colors.primary}` + 밑줄, focus-visible 포커스 링. 푸터 액션 버튼은 링크 **바깥**(중첩 회피).

**`compare-tray`** — 비교 담기 트레이. 배경 `{colors.surface}`, 1px `{colors.border}`, 라운드 `{rounded.lg}`, `{shadow.md}`. 데스크톱 상단 sticky, 모바일(≤768px) 하단 fixed + safe-area. 좌측 카운터 pill(ink tint-strong) + 우측 "비교하기"(button-primary)/"비우기"(ghost-button).

**`active-filter-chip`** — 활성 필터 칩. 배경 `{colors.primary-surface-strong}`(잉크 틴트), 1px `{colors.primary-border}`, 텍스트 `{colors.primary-darker}`(라이트 #030712 / 다크 #B6BFC9, 틴트 면 위 AA), `{type.caption}`/600, 라운드 `{rounded.full}`. 형식 `[라벨: 값 ×]` — 라벨 텍스트 항상 포함(색 단독 의미전달 금지). × 제거 버튼은 별도 클릭영역, 호버 시 `{colors.error}`.

**`hero-badge`** — 히어로 상단 pill 배지. **글래스(soft 티어)** 배경 `{colors.glass-bg}` + 1px `{colors.glass-border}` + `backdrop-filter: blur(14) saturate(160%)`, 텍스트 `{colors.primary-darker}`(AA), `{type.caption}`/600, 패딩 `{spacing.xs} {spacing.md}`(축소), 라운드 `{rounded.full}`. → Glassmorphism 섹션 참조.

**`hero--split`** — 랜딩 2단 Hero. 좌: 가치 카피(타이핑 헤드라인)+CTA(좌측정렬, `cta-button` 크기 축소 — 패딩 `{spacing.sm} {spacing.lg}`·`{type.body}`), 우: 큐레이션 위젯(`hero-split-inner` 1200 그리드, 위젯 수직 중앙). 배경은 전체폭 — 단일 잉크 radial 헤일로(≤0.06) + 도트 그리드(`{colors.border}`, 마스크 페이드). 데코 깊이 규칙(아래) 준수.

**`curated-hero` (CuratedHeroWidget)** — 벤치마크 프리뷰형 2단. 좌: 아이콘 전용 카테고리 레일(hover 시 이름 핀 확장, 무채색 라인 아이콘 — 이모지 금지), 우: 인기 Top 5 세로 리스트(로고 폴백은 ToolCard와 동일 `alt`+`data-official-url` 체인). 4.5초 자동 회전, 전환 fade. 아이콘·카피 정본 `utils/categoryMeta.js`.

**`curated-section-title` / `curated-section-subtitle`** — 랜딩 섹션 헤더. 제목은 전 섹션 `{type.h2}` 24px 통일(recommend-panel·footer h2와 동일), 제목 아래 한 줄 소제목(`{type.caption}`·`{colors.text-secondary}`). 섹션 간 간격은 `{spacing.5xl}` 96px.

**`bento-grid` / `bento-cell` / `bento-hero`** — 재사용 **Apple 벤토(Bento) 그리드** 프리미티브. 4열 CSS Grid에 **히어로 셀(2×2)** + **컴팩트 셀(1×1)**의 비대칭·모듈 배치. 셀 = `{colors.surface}` + 1px `{colors.border}` + `{rounded.3xl}` 20px, 패딩 `{spacing.xl}`, 링크형은 hover 시 잉크 보더. 반응형 4→2(태블릿, 히어로 2×1)→1열(모바일). 무채색·토큰만(스포트라이트/네온 없음 — 평면 surface 카드).
- **적용: 깃헙 트렌드 프리뷰(GithubTrendTeaser)** — 히어로 셀 = 1위 레포(이름 `{type.heading}` + 설명 4줄 클램프 + **큰 별점 `{type.metric}` 44px** + 언어·토픽), 컴팩트 셀 = 2~5위(owner/repo·이름·별점·언어). 셀 전체가 깃헙 외부 링크(새 창).

**`counter-pill`** — 비교 선택 카운터("3 / 5"). 전역 기본은 배경 `{colors.surface}`, 1px `{colors.border}`, `{colors.text-secondary}`. 비교 트레이 안(`.compare-tray .counter-pill`)에서는 잉크 틴트(`{colors.primary-surface-strong}` + `{colors.primary-border}` + `{colors.primary-darker}`)로 강조.

**`explore-sidebar` / `facet-option` (탐색 퍼싯)** — /explore 좌측 퍼싯 사이드바(surface 카드 + 1px `{colors.border}` + `{rounded.lg}`, `position: sticky`). 퍼싯 그룹은 `fieldset/legend`. **`facet-option`**: 비활성 은은(`{colors.text-secondary}`), hover=background 상승, **활성=잉크 틴트**(`{colors.primary-surface-strong}` + `{colors.primary-border}` + `{colors.primary-darker}`, `aria-pressed`). 카운트 `{facet-count}`=보조톤 숫자(색 단독 아님, 라벨 병행), **0건은 `disabled`**(opacity 0.4). 카테고리는 다중선택(OR)·목록 내 검색·세로 스크롤(max-height 264). 모바일: 사이드바 → 슬라이드 **드로어**(오버레이 `{colors.overlay}`·ESC·스크롤락, `필터(N)` 토글). 카운트·옵션은 전부 DB 실값(하드코딩 금지) — 데이터 정합성 원칙.

### Badges

**`difficulty-badge`** — 난이도. inline-flex, 점(○◐●)+텍스트(색맹 대응), `{type.caption}`/600, 라운드 `{rounded.full}`, 패딩 `{spacing.xs} {spacing.md}`.
- **점 문자는 난이도 3단계를 단조 증가하는 채움 정도로 표현한다**: 쉬움/easy `○`(빈 원) < 보통/medium `◐`(반 채움) < 어려움/hard `●`(꽉 채움). 매핑은 `utils/difficulty.js`(`difficultyDot`)가 단일 출처이며 한글/영문 enum 양쪽을 처리하고, 미매핑 값은 중립 점 `◌`로 폴백한다. 색과 독립된 시각 채널이라 라이트·다크 양쪽에서 색 단독 의존을 막는다(접근성).
- 배경/잉크는 `--difficulty-{easy,medium,hard}-{bg,ink}` 6종 토큰 경유(raw rgba 직접 사용 금지).
- easy: `--difficulty-easy-bg`(라이트 success 10%) / `--difficulty-easy-ink`. medium: `--difficulty-medium-bg`(warning 12%) / `--difficulty-medium-ink`. hard: `--difficulty-hard-bg`(error 10%) / `--difficulty-hard-ink`.
- **다크**: 유채색 잉크(easy `#4ADE80` 녹 / medium `#FB923C` 주 / hard `#F87171` 적, `--color-success/warning/error` 참조)에 저알파 동색 틴트 배경(easy 10% / medium 12% / hard 14%). 점 문자(○◐●)가 색과 독립된 채널로 함께 작동한다.

**`status-badge`** — 일반 상태 pill. 배경 `{colors.surface}`, 텍스트 `{colors.text-secondary}`, `{type.caption}`, 라운드 `{rounded.full}`, 패딩 `{spacing.xs} {spacing.sm}`.

### Inputs & Forms

**`search-input`** + **`search-input-focused`** — 검색 입력. 정본 [Home.css:214-230](../frontend/src/styles/Home.css#L214-L230).
- 배경 `{colors.background}`, 1px `{colors.border}`, 텍스트 `{colors.text-primary}`, 라운드 `{rounded.md}`, 패딩 `{spacing.lg}` (좌측 아이콘 폭 가산). 좌측 아이콘 `{colors.text-tertiary}`.
- 포커스: 테두리 `{colors.primary}` + `inset 0 0 0 2px {colors.primary-surface-strong}, 0 0 0 3px {colors.focus-ring}`.
- 모바일에서 폰트 16px로 키워 iOS 줌 방지([Home.css:584-586](../frontend/src/styles/Home.css#L584-L586)).

### State Containers

**`loading-state`** — 정본 [Home.css:326-345](../frontend/src/styles/Home.css#L326-L345). `{colors.primary}` 회전 스피너(40px, 3px border) + `{type.body}` `{colors.text-secondary}` 텍스트. 또는 [LoadingSpinner.jsx](../frontend/src/components/LoadingSpinner.jsx) 재사용.

**`error-state`** — error 5% 배경, 1px error 20%, 아이콘 + `{type.body-lg}`/600 제목 + `{colors.text-secondary}` 메시지 + 재시도 버튼(`{colors.error}`). ([Home.css:347-389](../frontend/src/styles/Home.css#L347-L389))

**`empty-state`** — 중앙 정렬, 50% 불투명 아이콘 + 제목 + 메시지 + 잉크 CTA(`{colors.primary-darker}` 배경). ([Home.css:391-430](../frontend/src/styles/Home.css#L391-L430))

> 모든 페이지(Compare/Recommendations/Details)는 이 3종 상태 컨테이너를 **동일 패턴**으로 재사용한다. 페이지마다 다른 로딩/에러 UI를 만들지 않는다.

### Animations
- `{transition.fast}` 100ms / `{transition.normal}` 200ms / `{transition.slow}` 300ms (`ease-out`). ([Home.css:51-54](../frontend/src/styles/Home.css#L51-L54))
- `fadeInUp` (히어로), `fadeIn` (그리드), `spin` (스피너). 과한 모션 금지 — 진입 페이드 + 호버 미세 상승(`translateY(-2px)`)이 전부.

---

## Do's and Don'ts

### Do
- `{colors.background}` #FFFFFF를 앵커 캔버스로, `{colors.surface}` #F9FAFB를 한 단계 위 면으로 사용한다.
- `{colors.primary}` 잉크는 **CTA·포커스·활성 필터·링크 강조**에만 인색하게 쓴다. 솔리드 배경은 `{colors.primary-darker}`, 그 위 텍스트는 `{colors.on-primary}`(AA). 강조는 테마 반전(라이트=어두운 잉크 / 다크=밝은 잉크).
- 깊이는 **헤어라인 `{colors.border}` 1px + surface 상승**으로. 그림자는 호버/들림 피드백에만.
- 모든 색·간격·라운드를 **토큰으로** 쓴다 — 다크모드가 무료로 따라온다.
- 헤드라인 700 / 타이틀·버튼 600 / 본문 400. 기본 본문은 14px.
- 버튼은 `{rounded.md}` 6px 또는 `{rounded.lg}` 8px. CTA는 잉크(`{colors.primary-darker}` 배경 + `{colors.on-primary}` 텍스트, `{colors.primary}` 호버).
- 난이도·상태는 **색 + 점/아이콘 + 텍스트**를 함께 써 접근성을 지킨다.
- 모든 페이지에서 loading/error/empty 3종 상태 컨테이너를 동일 패턴으로 재사용한다.

### Don't
- **버튼을 pill(`{rounded.full}`)로 만들지 않는다** — pill은 배지·카운터 전용.
- 잉크 솔리드를 섹션 배경이나 카드 바탕으로 깔지 않는다(히어로 0.05 틴트 1곳 예외).
- 2차 채도색(주황/분홍/청록 등)을 브랜드 강조로 도입하지 않는다 — 시맨틱 색은 배지에만.
- 분위기 그라데이션·스포트라이트 카드·네온 글로우를 추가하지 않는다.
- 정적 카드에 무거운 그림자를 깔지 않는다(`{shadow.lg}`는 호버/모달만).
- 순흑 `#000000`을 텍스트/배경에 쓰지 않는다(Ink = #111827, 다크 캔버스 = #0D1117).
- 색만으로 의미를 전달하지 않는다(난이도·상태에 항상 텍스트 동반).
- 페이지마다 제각각인 로딩/에러 UI를 만들지 않는다.

---

## Responsive Behavior

### Breakpoints
정본 미디어쿼리: [Home.css:532-599](../frontend/src/styles/Home.css#L532-L599).

| Name | Width | Key Changes |
|---|---|---|
| Desktop | ≥ 769px | 기본 레이아웃. 카드 그리드 auto-fill 3~4열, 비교 테이블 가로 |
| Tablet/Mobile | ≤ 768px | 카드 그리드 1열, 히어로 32px, CTA 풀폭, **비교 테이블 → 세로 카드 스택** |
| Small | ≤ 640px | container 패딩 `{spacing.md}` 12px, 히어로 24px, 검색 입력 16px(줌 방지), 필터 갭 축소 |

### Touch Targets
- 1차 CTA·버튼 ≥ 40px 높이.
- 필터 칩 ≥ 36px, 터치 뷰포트 ≥ 44px.
- 입력 ≥ 44px 터치 타깃, 모바일 폰트 16px.

### Collapsing Strategy
- **카드 그리드:** auto-fill 3~4열 → 768px에서 1열.
- **비교 테이블:** 데스크톱 가로 테이블 → 768px에서 도구별 세로 카드 스택([UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md)).
- **히어로 타이포:** `{type.hero}` clamp(28–48px) → 768px 32px → 640px 24px.
- **CTA:** 모바일에서 풀폭(`width:100%`), 버튼 그룹 세로 스택.

### Image Behavior
- 도구 로고는 종횡비 유지, 32~40px(모바일 28px). 크롭 없음.
- 향후 스크린샷/일러스트 도입 시 lazy-load + `srcset` 적용.

---

## Iteration Guide

1. 한 번에 **컴포넌트 하나**에 집중하고 `{component}` 토큰명으로 참조한다.
2. 새 변형(`-active`, `-focused`, `-featured`)은 `Components`에 별도 항목으로 추가한다.
3. **인라인 hex 금지** — 항상 `{token}` 참조. 토큰에 없는 값이 필요하면 먼저 Home.css `:root`에 토큰을 추가한다.
4. 새 섹션은 먼저 **어느 surface(background/surface)에 얹을지** 정한다.
5. 기본 본문은 `{type.body}` 14px/400. 헤드라인은 700, 타이틀·버튼은 600.
6. 잉크 강조는 희소 자원: CTA·포커스·활성·링크 강조에만. 솔리드 배경은 `{colors.primary-darker}` + `{colors.on-primary}` 텍스트(AA). 강조는 테마 반전(라이트=어두운 잉크 / 다크=밝은 잉크).
7. 강조가 필요하면 **잉크 틴트 + 가중치 + 헤어라인**을 먼저 쓰고, 그림자·새 색은 마지막 수단.
8. 모든 토큰 사용은 다크모드를 자동 통과해야 한다 — 하드코딩 색을 남기지 않는다.

---

## Known Gaps

- 토큰 정본은 [Home.css:5-66](../frontend/src/styles/Home.css#L5-L66)의 `:root` CSS 변수다. 이 문서는 그 서술이며, 값 불일치 시 Home.css가 우선한다.
- **다크모드 정책 미확정**: 현재 `prefers-color-scheme` 자동 전환과 앱 내 수동 토글(`darkMode` store, [toolStore.js:130](../frontend/src/stores/toolStore.js#L130))이 공존한다. `[data-theme]` 기반 통일은 후속 과제.
- 폼 검증/에러 필드 스타일은 아직 미정의(검색 입력만 존재).
- 난이도 데이터 값이 한글(`쉬움/보통/어려움`)인지 영문 enum인지 확인 필요 — 배지 클래스 매핑에 영향([tools-data-curator] 협의).
- 모노 타입·커뮤니티(아바타/댓글)·차트(벤치마크 시각화) 컴포넌트는 로드맵 단계로 아직 토큰화되지 않았다.
- Inter 외 커스텀 디스플레이 컷은 없음 — 의도된 단일 가족 정책이다.
