# AITools Design System

> **AITools** — AI 도구 비교 플랫폼. Linear Design System을 기반으로 한 **라이트-캔버스, 데이터 밀도 중심**의 제품 디자인 언어.
> 정본 토큰 소스: [frontend/src/styles/Home.css](../frontend/src/styles/Home.css) `:root`. 이 문서는 그 토큰을 서술·확장한 것이며, 토큰 값이 바뀌면 Home.css가 우선한다.

---

## Overview

AITools는 Linear의 절제된 시스템 미감을 **라이트 캔버스**에서 구현한다. Linear가 다크 캔버스 위에 제품 스크린샷을 주인공으로 세우고, Apple이 사진 위에 UI를 숨긴다면, AITools의 주인공은 **데이터** — 78개+ AI 도구의 카드, 비교 테이블, 벤치마크 점수다. 따라서 우리 시스템은 사진이 아니라 **스캔 가능성(scannability)**과 **정보 위계**를 위해 설계된다.

캔버스는 순백 `{colors.background}` (#FFFFFF), 그 위에 한 단계 들린 `{colors.surface}` (#F9FAFB)가 카드·패널·입력의 바탕이 된다. 깊이는 그림자가 아니라 **1px 헤어라인 `{colors.border}` (#E5E7EB) + 미묘한 surface 상승**으로 만든다. 단 하나의 채도 높은 강조색은 **단일 Sky Cyan** `{colors.primary}` (#0EA5E9) — CTA, 포커스 링, 활성 필터, 링크 강조에만 인색하게 쓴다. 흰 텍스트가 올라가는 1차 버튼/CTA/활성칩 배경은 AA 대비를 위해 한 단계 진한 `{colors.primary-darker}` (#0369A1)를 쓴다.

타이포그래피는 **Inter** 한 가족으로 display부터 caption까지 한 목소리를 낸다(가중치 400/500/600/700). 페이지 리듬은 Linear/Apple처럼 풀블리드 섹션 교차가 아니라, **카드 그리드 + 비교 테이블 + 필터 칩**이라는 SaaS형 밀도다. 다크모드는 `prefers-color-scheme`로 토큰 레벨에서 자동 전환된다 — 두 레퍼런스가 단일 테마만 가진 것과 달리, 우리는 **라이트가 기본이되 다크를 1급으로 지원**한다.

**Key Characteristics:**
- **라이트-캔버스 데이터 시스템** — `{colors.background}` (#FFFFFF)가 앵커, `{colors.surface}` (#F9FAFB)가 한 단계 위.
- **단일 Sky Cyan 강조** (`{colors.primary}` #0EA5E9) — CTA·포커스·활성 상태·링크에만 인색하게. 흰 텍스트 배경은 `{colors.primary-darker}` #0369A1(AA).
- **그림자 최소, 헤어라인 중심** — 깊이는 `{colors.border}` 1px + surface 상승. `{shadow.md}`는 호버/들린 카드에만.
- **데이터가 주인공** — 도구 카드 그리드와 비교 테이블의 스캔 가능성이 최우선. 장식 크롬 없음.
- **Inter 단일 보이스** — display 700 → body 400, 한 가족. 음수 자간은 큰 헤드라인에만 가볍게.
- **카드 = `{rounded.lg}` 8px**, 큰 패널 = `{rounded.xl}` 12px. 버튼·입력은 `{rounded.md}` 6px. pill은 배지·필터에만.
- **다크모드 1급 지원** — 모든 색을 토큰으로만 쓰면 다크 전환은 무료.
- 채도 높은 2차 브랜드색 없음. 분위기 그라데이션 없음(히어로 0.05 틴트 1곳 예외). 스포트라이트 카드 없음.

---

## Colors

> 정본: [Home.css:5-66](../frontend/src/styles/Home.css#L5-L66). 라이트가 기본, 다크는 `@media (prefers-color-scheme: dark)`에서 surface/border/text 토큰만 재정의된다.

### Brand & Accent
- **Sky Cyan** (`{colors.primary}` — #0EA5E9): 시그니처 강조. 링크, 포커스 링 루트, 테두리·아이콘 강조, 1차 버튼 **호버** 배경(명도 상승). 흰 배경 위 본문 텍스트로는 쓰지 않는다(대비 ≈2.8:1).
- **Sky Cyan Dark** (`{colors.primary-dark}` — #0284C7): 1차 버튼/CTA 프레스(active) 상태.
- **Sky Cyan Darker** (`{colors.primary-darker}` — #0369A1): **흰 텍스트 1차 버튼·CTA·활성 필터칩·배지의 기본 배경**(흰텍스트 ≈4.9:1 AA), 활성칩/링크 컨텍스트 텍스트색.
- **Sky Tint 5%** (`{colors.primary-surface}` — `rgba(14,165,233,0.05)`): btn-secondary 호버, footer-cta 단색 그라데이션, category-badge 바탕.
- **Sky Tint Strong** (`{colors.primary-surface-strong}` — light `rgba(14,165,233,0.10)` / dark `0.18`): 활성 필터칩·트레이 카운터·hero badge 배경, 활성 글로우.
- **Sky Border** (`{colors.primary-border}` — light `rgba(14,165,233,0.20)` / dark `0.30`): sky 틴트 면의 1px 테두리(칩·badge·카운터).

> 신규 토큰 2종(`primary-surface-strong`/`primary-border`)은 `:root` + 다크 2블록에 각각 정의되며, 다크에서는 캔버스(#0F172A) 대비 인지 강도 보존을 위해 알파를 상향한다.

### Surface
- **Background** (`{colors.background}` — #FFFFFF / dark #0F172A): 기본 페이지 캔버스.
- **Surface** (`{colors.surface}` — #F9FAFB / dark #1E293B): 한 단계 위 — 카드, 입력, 비교 테이블, 검색/필터 섹션 바탕.
- **Border** (`{colors.border}` — #E5E7EB / dark #334155): 1px 헤어라인 — 카드, 구분선, 입력 테두리, 테이블 셀 라인.

> Linear의 4단 surface 사다리와 달리 우리는 **background → surface 2단**이면 충분하다. 더 깊은 위계가 필요하면 헤어라인 강도(2px) 또는 `{shadow}`로 표현하고, 임의의 회색 단계를 새로 만들지 않는다.

### Text
- **Ink** (`{colors.text-primary}` — #111827 / dark #F1F5F9): 모든 헤드라인·본문 강조.
- **Ink Secondary** (`{colors.text-secondary}` — #6B7280 / dark #CBD5E1): 부가 설명, 메타, 카드 본문.
- **Ink Tertiary** (`{colors.text-tertiary}` — #9CA3AF / dark #94A3B8): 플레이스홀더, 비활성, 각주.

### Semantic
- **Success** (`{colors.success}` — #16A34A): 난이도 "쉬움", 무료 가격, 성공 토스트. 10% 틴트 배경과 함께 배지로.
- **Warning** (`{colors.warning}` — #FB923C): 난이도 "보통".
- **Error** (`{colors.error}` — #EF4444): 난이도 "어려움", 에러 상태, 삭제 호버, 재시도 버튼.

> 시맨틱 색은 **배지·상태**에만. Linear처럼 마케팅 면에 무분별하게 뿌리지 않는다. 색만으로 의미를 전달하지 말고 항상 텍스트/아이콘을 동반한다(접근성).

### Note
순흑(`#000000`)을 텍스트나 배경에 쓰지 않는다 — Ink는 #111827이다. 다크모드 캔버스도 순흑이 아닌 #0F172A(slate)다.

---

## Typography

### Font Family
- **Inter** (`{font.family}`) — `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. display부터 caption까지 전 구간을 단일 가족으로 운용한다. 가중치 사다리는 **400 / 500 / 600 / 700**.
- 모노 가족은 정의하지 않는다. 코드/ID 토큰이 필요하면 `ui-monospace, SF Mono, Menlo` 폴백을 인라인으로 쓴다(드묾).

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{type.hero}` | clamp(28–48px) | 700 | 1.2 | 0 | 히어로 헤드라인 (반응형 clamp) |
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
- **Tokens:** `{spacing.xs}` 4px · `{spacing.sm}` 8px · `{spacing.md}` 12px · `{spacing.lg}` 16px · `{spacing.xl}` 24px · `{spacing.2xl}` 32px · `{spacing.3xl}` 48px · `{spacing.4xl}` 64px.
- **카드 내부 패딩:** `{spacing.xl}` 24px (ToolCard, feature 카드). 테이블 셀: `{spacing.lg}` 16px.
- **버튼 패딩:** 1차 CTA `{spacing.lg} {spacing.2xl}` (16px 32px), 일반 버튼 `{spacing.md} {spacing.xl}` (12px 24px), 소형 `{spacing.sm} {spacing.lg}` (8px 16px).
- **입력 패딩:** `{spacing.lg}` 16px (검색 입력은 좌측 아이콘 폭만큼 가산).
- **섹션 수직 패딩:** `{spacing.3xl}` 48px (데스크톱), 모바일 `{spacing.2xl}` 32px.

### Grid & Container
- **최대 콘텐츠 폭:** 1200px (`.container`, [Home.css:92-96](../frontend/src/styles/Home.css#L92-L96)), 좌우 `{spacing.lg}` 16px 패딩.
- **도구 카드 그리드:** `repeat(auto-fill, minmax(280px, 1fr))` — 데스크톱 자동 3~4열, 태블릿 2열, 모바일 1열. 갭 `{spacing.xl}` 24px.
- **비교 테이블:** 콘텐츠 폭 가득, 가로 스크롤(`overflow-x: auto`). 데스크톱은 가로 비교, 모바일(≤768px)은 도구별 세로 카드 스택으로 전환(별도 스펙 [UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md) 참조).
- **추천/필터:** 필터는 칩(`{filter-btn}`) 가로 wrap, 추천 결과는 카드 그리드 재사용.

### Whitespace Philosophy
캔버스(흰색)가 여백이다. 섹션은 흰 공백의 갭이 아니라 **surface 상승 + 헤어라인**으로 나뉜다. 카드 내부는 `{spacing.xl}` 24px로 숨 쉬게 하고, 섹션 간은 `{spacing.3xl}` 48px. 데이터가 밀집된 비교 테이블은 셀 패딩을 `{spacing.lg}` 16px로 유지해 밀도와 가독성의 균형을 잡는다.

---

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | 그림자·테두리 없음 | 본문, 히어로 텍스트, 푸터 |
| 1 (헤어라인) | `{colors.surface}` 배경 + 1px `{colors.border}` | 기본 카드, 입력, 비교 테이블, 패널 |
| 2 (소프트) | `{shadow.sm}` (`0 1px 2px rgba(0,0,0,0.05)`) | 정적 들린 타일 |
| 3 (호버) | `{shadow.md}` (`0 4px 6px / 0 2px 4px`) + `translateY(-2px)` | 카드 호버, 1차 버튼 |
| 4 (강조) | `{shadow.lg}` (`0 10px 15px / 0 4px 6px`) | 1차 버튼 호버, 모달 |
| Focus | 포커스 링: `box-shadow: 0 0 0 3px {colors.focus-ring}` (`rgba(14,165,233,0.2)`) (+ 입력은 inset 2px sky-tint-strong) | 포커스된 입력/버튼/필터 |

깊이는 **헤어라인 + surface**가 1차, 그림자는 인터랙션 피드백(호버/들림)에만. 정적 카드에 무거운 그림자를 깔지 않는다(Linear 정신). 다크모드에선 그림자가 약하므로 헤어라인(`{colors.border}` #334155)이 위계를 진다.

### Decorative Depth
- **데이터 카드와 비교 테이블**이 시각적 주인공. 사진·일러스트 의존 없음.
- 분위기 그라데이션 없음. **예외 1곳**: 히어로 배경 그라데이션을 **opacity 0.05**로 극히 옅게. **단일 sky**(`primary → primary-darker`)만 쓰며, 기존 2차 보라(#764ba2)는 제거했다. footer-cta도 2차 보라를 제거하고 sky 5% 단색으로 평면화. 그 외 어떤 면에도 그라데이션 금지.
- 스포트라이트 카드·네온 글로우 없음. 강조는 sky 틴트 + 가중치로만.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 4px | 소형 칩, 상태 배지 |
| `{rounded.md}` | 6px | **모든 버튼, 입력, 필터 칩** |
| `{rounded.lg}` | 8px | **카드 (도구 카드, 추천 카드), CTA 버튼** |
| `{rounded.xl}` | 12px | 큰 패널, 비교 테이블 컨테이너, hero 카드 |
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

**`button-primary`** — 1차 sky CTA(흰 텍스트, AA).
- 배경 **`{colors.primary-darker}`**(#0369A1, 흰텍스트 ≈4.9:1 AA), 텍스트 white, 타입 `{type.button}`, 패딩 `{spacing.md} {spacing.xl}`, 라운드 `{rounded.md}`, `{shadow.md}`.
- 호버: 배경 `{colors.primary}`(#0EA5E9, **명도 상승** = 들림 신호) + `{shadow.lg}` + `translateY(-2px)`.
- 프레스: 배경 `{colors.primary-dark}`(#0284C7).

**`cta-button`** — 대형 히어로 CTA. 같은 색 단계(기본 `{colors.primary-darker}` → 호버 `{colors.primary}` → press `{colors.primary-dark}`), `{type.body-lg}`, 패딩 `{spacing.lg} {spacing.2xl}`, 라운드 `{rounded.lg}`, 아이콘 갭 `{spacing.md}`.

**`button-secondary`** — 보조 버튼. 배경 transparent, 1px `{colors.border}`, 텍스트 `{colors.text-primary}`. 호버 시 테두리·텍스트 `{colors.primary}` + sky 5%(`{colors.primary-surface}`) 배경. 활성(`.active`) 상태는 배경 `{colors.primary-darker}` + 흰 텍스트(AA).

**`button-small`** — 테이블 "방문 →" 등. 패딩 `{spacing.sm} {spacing.lg}`, 타입 `{type.caption}`~`{type.button}`, 라운드 `{rounded.md}`.

### Filters

**`filter-btn`** + **`filter-btn-active`** — 카테고리/난이도 필터 칩. 정본 [Home.css:259-282](../frontend/src/styles/Home.css#L259-L282).
- 기본: 배경 transparent, 1px `{colors.border}`, 텍스트 `{colors.text-primary}`, 가중치 500, 라운드 `{rounded.md}`, 패딩 `{spacing.sm} {spacing.lg}`. 호버 시 sky 테두리·텍스트.
- 활성: 배경 `{colors.primary-darker}`(흰텍스트 AA), 텍스트 white, sky tint-strong 글로우(`0 0 0 3px {colors.primary-surface-strong}`).
- **`filter-label`**: 그룹 라벨 — `{type.eyebrow}` (12px/600, uppercase, +0.5px 자간), `{colors.text-secondary}`.

### Cards & Containers

**`tool-card`** — 핵심 카드. 도구 로고·이름·카테고리·메타·비교 추가 버튼. 구현 [ToolCard.jsx](../frontend/src/components/ToolCard.jsx).
- 배경 `{colors.surface}`, 1px `{colors.border}`, 라운드 `{rounded.lg}`, 패딩 `{spacing.xl}`. 호버: `{shadow.md}` + `translateY(-2px)`.

**`comparison-table`** — 비교 테이블 컨테이너. 배경 `{colors.surface}`, 1px `{colors.border}`, 라운드 `{rounded.xl}`, `{shadow.md}`, `overflow-x: auto`. 헤더 sticky-top, 첫 열 sticky-left. 셀 패딩 `{spacing.lg}`, 1px `{colors.border}` 하단 라인. ([UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md) 스펙)
**`recommendation-card`** — 맞춤 추천 결과 카드. tool-card 구조 재사용 + 매칭 근거(`{match-reason}`) 라인 추가(체크 아이콘 + "…태그 일치").

**`tool-card-link`** — tool-card 본문(헤더+바디)을 감싸는 상세 진입 링크(`/details/:id`). 호버 시 도구명 `{colors.primary}` + 밑줄, focus-visible 포커스 링. 푸터 액션 버튼은 링크 **바깥**(중첩 회피).

**`compare-tray`** — 비교 담기 트레이. 배경 `{colors.surface}`, 1px `{colors.border}`, 라운드 `{rounded.lg}`, `{shadow.md}`. 데스크톱 상단 sticky, 모바일(≤768px) 하단 fixed + safe-area. 좌측 카운터 pill(sky tint-strong) + 우측 "비교하기"(button-primary)/"비우기"(ghost-button).

**`active-filter-chip`** — 활성 필터 칩. 배경 `{colors.primary-surface-strong}`, 1px `{colors.primary-border}`, 텍스트 `{colors.primary-darker}`(#0369A1 AA), `{type.caption}`/600, 라운드 `{rounded.full}`. 형식 `[라벨: 값 ×]` — 라벨 텍스트 항상 포함(색 단독 의미전달 금지). × 제거 버튼은 별도 클릭영역, 호버 시 `{colors.error}`.

**`hero-badge`** — 히어로 상단 pill 배지. 배경 `{colors.primary-surface-strong}`, 1px `{colors.primary-border}`, 텍스트 `{colors.primary-darker}`(AA), `{type.caption}`/600, 라운드 `{rounded.full}`, backdrop-blur.

**`counter-pill`** — 비교 선택 카운터("3 / 5"). 전역 기본은 배경 `{colors.surface}`, 1px `{colors.border}`, `{colors.text-secondary}`. 비교 트레이 안(`.compare-tray .counter-pill`)에서는 sky 틴트(`{colors.primary-surface-strong}` + `{colors.primary-border}` + `{colors.primary-darker}`)로 강조.

### Badges

**`difficulty-badge`** — 난이도. inline-flex, 점(●)+텍스트(색맹 대응), `{type.caption}`/600, 라운드 `{rounded.full}`, 패딩 `{spacing.xs} {spacing.md}`.
- easy: success 10% 배경 / `{colors.success}`. medium: warning 12% / `{colors.warning}`. hard: error 10% / `{colors.error}`.

**`status-badge`** — 일반 상태 pill. 배경 `{colors.surface}`, 텍스트 `{colors.text-secondary}`, `{type.caption}`, 라운드 `{rounded.full}`, 패딩 `{spacing.xs} {spacing.sm}`.

### Inputs & Forms

**`search-input`** + **`search-input-focused`** — 검색 입력. 정본 [Home.css:214-230](../frontend/src/styles/Home.css#L214-L230).
- 배경 `{colors.background}`, 1px `{colors.border}`, 텍스트 `{colors.text-primary}`, 라운드 `{rounded.md}`, 패딩 `{spacing.lg}` (좌측 아이콘 폭 가산). 좌측 아이콘 `{colors.text-tertiary}`.
- 포커스: 테두리 `{colors.primary}` + `inset 0 0 0 2px {colors.primary-surface-strong}, 0 0 0 3px {colors.focus-ring}`.
- 모바일에서 폰트 16px로 키워 iOS 줌 방지([Home.css:584-586](../frontend/src/styles/Home.css#L584-L586)).

### State Containers

**`loading-state`** — 정본 [Home.css:326-345](../frontend/src/styles/Home.css#L326-L345). `{colors.primary}` 회전 스피너(40px, 3px border) + `{type.body}` `{colors.text-secondary}` 텍스트. 또는 [LoadingSpinner.jsx](../frontend/src/components/LoadingSpinner.jsx) 재사용.

**`error-state`** — error 5% 배경, 1px error 20%, 아이콘 + `{type.body-lg}`/600 제목 + `{colors.text-secondary}` 메시지 + 재시도 버튼(`{colors.error}`). ([Home.css:347-389](../frontend/src/styles/Home.css#L347-L389))

**`empty-state`** — 중앙 정렬, 50% 불투명 아이콘 + 제목 + 메시지 + sky CTA(`{colors.primary-darker}` 배경). ([Home.css:391-430](../frontend/src/styles/Home.css#L391-L430))

> 모든 페이지(Compare/Recommendations/Details)는 이 3종 상태 컨테이너를 **동일 패턴**으로 재사용한다. 페이지마다 다른 로딩/에러 UI를 만들지 않는다.

### Animations
- `{transition.fast}` 100ms / `{transition.normal}` 200ms / `{transition.slow}` 300ms (`ease-out`). ([Home.css:51-54](../frontend/src/styles/Home.css#L51-L54))
- `fadeInUp` (히어로), `fadeIn` (그리드), `spin` (스피너). 과한 모션 금지 — 진입 페이드 + 호버 미세 상승(`translateY(-2px)`)이 전부.

---

## Do's and Don'ts

### Do
- `{colors.background}` #FFFFFF를 앵커 캔버스로, `{colors.surface}` #F9FAFB를 한 단계 위 면으로 사용한다.
- `{colors.primary}` sky는 **CTA·포커스·활성 필터·링크 강조**에만 인색하게 쓴다. 흰 텍스트 배경은 `{colors.primary-darker}`(AA).
- 깊이는 **헤어라인 `{colors.border}` 1px + surface 상승**으로. 그림자는 호버/들림 피드백에만.
- 모든 색·간격·라운드를 **토큰으로** 쓴다 — 다크모드가 무료로 따라온다.
- 헤드라인 700 / 타이틀·버튼 600 / 본문 400. 기본 본문은 14px.
- 버튼은 `{rounded.md}` 6px 또는 `{rounded.lg}` 8px. CTA는 sky(`{colors.primary-darker}` 배경, `{colors.primary}` 호버).
- 난이도·상태는 **색 + 점/아이콘 + 텍스트**를 함께 써 접근성을 지킨다.
- 모든 페이지에서 loading/error/empty 3종 상태 컨테이너를 동일 패턴으로 재사용한다.

### Don't
- **버튼을 pill(`{rounded.full}`)로 만들지 않는다** — pill은 배지·카운터 전용.
- sky를 섹션 배경이나 카드 바탕으로 깔지 않는다(히어로 0.05 틴트 1곳 예외).
- 2차 채도색(주황/분홍/청록 등)을 브랜드 강조로 도입하지 않는다 — 시맨틱 색은 배지에만.
- 분위기 그라데이션·스포트라이트 카드·네온 글로우를 추가하지 않는다.
- 정적 카드에 무거운 그림자를 깔지 않는다(`{shadow.lg}`는 호버/모달만).
- 순흑 `#000000`을 텍스트/배경에 쓰지 않는다(Ink = #111827, 다크 캔버스 = #0F172A).
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
6. sky는 희소 자원: CTA·포커스·활성·링크 강조에만. 흰 텍스트 배경은 `{colors.primary-darker}`(AA).
7. 강조가 필요하면 **sky 틴트 + 가중치 + 헤어라인**을 먼저 쓰고, 그림자·새 색은 마지막 수단.
8. 모든 토큰 사용은 다크모드를 자동 통과해야 한다 — 하드코딩 색을 남기지 않는다.

---

## Known Gaps

- 토큰 정본은 [Home.css:5-66](../frontend/src/styles/Home.css#L5-L66)의 `:root` CSS 변수다. 이 문서는 그 서술이며, 값 불일치 시 Home.css가 우선한다.
- **다크모드 정책 미확정**: 현재 `prefers-color-scheme` 자동 전환과 앱 내 수동 토글(`darkMode` store, [toolStore.js:130](../frontend/src/stores/toolStore.js#L130))이 공존한다. `[data-theme]` 기반 통일은 후속 과제.
- 폼 검증/에러 필드 스타일은 아직 미정의(검색 입력만 존재).
- 난이도 데이터 값이 한글(`쉬움/보통/어려움`)인지 영문 enum인지 확인 필요 — 배지 클래스 매핑에 영향([tools-data-curator] 협의).
- 모노 타입·커뮤니티(아바타/댓글)·차트(벤치마크 시각화) 컴포넌트는 로드맵 단계로 아직 토큰화되지 않았다.
- Inter 외 커스텀 디스플레이 컷은 없음 — 의도된 단일 가족 정책이다.
