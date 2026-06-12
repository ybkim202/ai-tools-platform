# AITools Governance

> 프로젝트 거버넌스 세부 문서. 요약·진입점은 루트 [CLAUDE.md](../CLAUDE.md). 이 문서는 **원칙의 근거 / 에이전트 협업 / 코드 컨벤션 / 보안·정합성 하드룰 / 커밋·PR / 문서 맵**을 담는다.
> 마지막 갱신: 2026-05-30.

---

## 1. 프로젝트 원칙 (근거 포함)

### 1.1 실제 코드가 사실이다
문서(README·ARCHITECTURE)와 코드가 어긋날 때 **코드를 사실로 본다.** 실제로 스택 다수가 불일치한다 — 문서는 TypeScript·Tailwind·Vite·Render를 주장하나 코드는 JavaScript·순수 CSS·CRA이며 Render/Railway 설정이 공존한다([PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) 5장). 작업 중 불일치를 발견하면 **추측하지 말고 코드를 확인하고, 가능하면 문서를 동기화**한다.

### 1.2 일관성 우선
새 코드를 짜기 전에 기존 패턴을 찾는다. 컴포넌트는 `components/`·`pages/`의 구조를, API 호출은 `services/api.js`를, 상태는 `stores/`를, 색·간격은 [DESIGN.md](./DESIGN.md) 토큰을 재사용한다. 일관성은 사람의 기억이 아니라 이 문서와 기존 코드가 보장한다.

### 1.3 데이터 정합성이 기능보다 먼저다
현재 추천·벤치마크·뉴스는 데이터가 비어 동작하지 않고(G1~G4), 프론트 필터는 실제 DB 카테고리와 불일치해 빈 결과를 낸다(G5). **새 기능을 얹기 전에** 기존 인터랙션이 빈 화면을 내지 않게 만든다. 빈 상태는 데이터로 채우거나 명시적 empty-state로 처리한다.

### 1.4 비밀정보는 절대 커밋하지 않는다
하드코딩된 API 키·DB 비밀번호가 이미 커밋된 이력이 있다(G9). 모든 자격증명은 환경변수로만 읽고, `.env`는 커밋하지 않으며, 예제는 `.env.example`에 placeholder로만 둔다.

---

## 2. 에이전트 팀 — 역할과 협업

> 각 에이전트의 **세부 지시문 정본은 `.claude/agents/<name>.md`**다. 이 절은 라우팅·협업 규칙만 정의하고 지시문을 복제하지 않는다(DRY). 커스텀 에이전트는 **Claude Code 재시작 후** Agent 자동 위임이 활성화된다.

### 2.1 레이어 흐름
```
기획            디자인              구현                     품질·데이터
product-     →  ux-ui-       →   backend-fastapi     ↔   api-contract-guardian
strategist      designer         frontend-react          tools-data-curator
                                                          security-reviewer
                                                          data-collector
```
무엇을 왜(기획) → 어떻게 보이고 동작(디자인) → 실제 코드(구현) → 정합성·품질·보안·수집(검증/데이터).

### 2.2 책임 / 비책임 / 호출 시점

| 에이전트 | 책임 | 비책임(위임) | 언제 호출 |
|---|---|---|---|
| `product-strategist` | 기능 기획, 시장·트렌드 리서치, 우선순위, PRD | 코드·기술 구현 | "무엇을/왜 만들지", 경쟁 조사 |
| `ux-ui-designer` | UX 흐름·IA, 디자인 시스템, 컴포넌트 스펙(토큰), 접근성 | 코드 구현(→ frontend) | "예쁘게/현대적으로/UX 개선", 새 화면 설계 |
| `backend-fastapi` | 라우터·DB 쿼리·인증·예외·레이트리밋 | 계약 정합성 판정(→ guardian) | `backend/app` 변경, 백엔드 버그 |
| `frontend-react` | 페이지·컴포넌트·상태·연동·스타일 | 디자인 스펙 결정(→ designer) | `frontend/src` 변경 |
| `api-contract-guardian` | 백엔드 구현·프론트 호출·문서 3자 정합성 점검(읽기) | 코드 수정 | 엔드포인트/스키마 변경 직후 |
| `tools-data-curator` | `tools_data.json`·벤치마크·뉴스 스키마·품질 | DB 마이그레이션 실행(→ backend) | 데이터 추가·검증 |
| `security-reviewer` | 인증·SQLi·CORS·시크릿·입력검증 점검(읽기) | 패치 적용(→ back/front) | 배포 전, 디프 보안 리뷰 |
| `data-collector` | APScheduler 수집 잡·외부 소스 연동 | 데이터 스키마 정의(→ curator) | 자동 수집 구현·운영 |

### 2.3 협업 규칙(핸드오프)
- **디자인 → 구현**: ux-ui-designer는 토큰값까지 명시한 스펙을 산출하고, frontend-react가 그대로 구현한다. 예: [UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md).
- **계약 변경 → guardian**: backend/frontend가 엔드포인트·파라미터·응답을 바꾸면 api-contract-guardian로 3자 정합성을 점검한다.
- **데이터 변경 → curator + backend**: 데이터 스키마가 바뀌면 tools-data-curator(품질)와 backend-fastapi(쿼리·적재)를 함께 돌린다.
- **수집 산출물**: data-collector의 출력은 tools-data-curator의 스키마·중복·출처 규칙을 따른다.

---

## 3. 코드 컨벤션 (상세)

### 3.1 백엔드 (Python / FastAPI)
- **스타일**: PEP 8 준수, 타입 힌팅 사용, 함수·클래스 docstring 필수(README:239-241).
- **실제 구조**: `backend/app/main.py`(앱·미들웨어·라우터 등록), `database.py`(엔진/세션), `auth.py`(인증·레이트리밋), `exceptions.py`(예외 핸들러), `routers/`(엔드포인트). ORM 모델·`models/`·`schemas/`·`services/` 폴더는 **없다**(문서 주장과 다름).
- **DB 접근**: SQLAlchemy `text()` + raw SQL. 바인딩은 **`:name` 스타일로 통일**한다(아래 4.2). 새 라우터는 `compare.py`·`benchmarks.py`의 `:name` 패턴을 따른다.
- **예외**: `exceptions.py`의 핸들러/패턴 재사용. 응답에 내부 정보(스택트레이스·DB 오류·경로) 노출 금지.
- **응답 포맷**: 모든 엔드포인트는 `{success, data, error}` 구조를 유지한다. 프론트 에러 처리(`services/api.js`)가 이에 의존한다.

### 3.2 프론트엔드 (React / CRA)
- **파일 구조**: `pages/`(라우트 단위), `components/`(재사용), `services/api.js`(모든 서버 호출), `stores/`(Zustand), `styles/`(CSS). 새 파일은 이 구조와 네이밍을 따른다.
- **상태관리 정책**: 전역·교차 페이지 상태는 **Zustand 스토어**(`stores/toolStore.js`)로. 단일 컴포넌트 국소 상태만 `useState`. 현재 Home·Recommendations가 로컬 useState로 중복 구현돼 이원화돼 있다(G8) → 신규/리팩터는 **Zustand로 수렴**한다.
- **API 연동**: 직접 `axios` 호출 금지. 반드시 `services/api.js`의 레이어를 거친다. 엔드포인트·파라미터는 API 문서/코드 계약과 일치시킨다.
- **스타일**: [DESIGN.md](./DESIGN.md)의 Linear 토큰(정본: `frontend/src/styles/Home.css` `:root`)만 사용. 인라인 hex·임의 간격 금지. 버튼은 `{rounded.md}`/`{rounded.lg}`, **pill 금지**.
- **빌드 위생**: 미사용 변수 등 ESLint 경고를 남기지 않는다(Vercel 빌드가 경고에 엄격). PR 전 `npm run build` 통과 필수.
- **접근성**: 색만으로 의미를 전달하지 않는다(난이도·상태에 텍스트/아이콘 병행). 명도 대비 WCAG AA, 키보드 포커스 유지.

---

## 4. 보안·정합성 하드룰 (P0 규칙화)

> [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) 8장의 갭을 재발 방지 규칙으로 고정한다. 괄호는 근거 갭 번호.

### 4.1 비밀정보 (G9) — **NEVER 하드코딩**
API 키·DB 비밀번호·커넥션 문자열을 소스에 적지 않는다. `os.environ`/`.env`로만 읽고, `.env`는 `.gitignore`에 둔다. 노출된 키는 즉시 로테이션한다.

### 4.2 SQL 바인딩 (G7) — **MUST `:name` 통일**
SQLAlchemy `text()`에 psycopg2 스타일 `%(name)s`를 쓰지 않는다(런타임 오류 위험). `:name` 바인딩 + `params` dict로 통일. 모든 DB 접근은 parameterized(문자열 포매팅으로 쿼리 조립 금지 → SQL Injection 방지).

### 4.3 필터·옵션 동기화 (G5/G6) — **MUST DB와 일치**
프론트 필터 카테고리·추천 옵션값을 임의 하드코딩하지 않는다. 실제 DB의 distinct 카테고리/태그를 받아 동적 렌더하거나, 최소한 실제 데이터와 일치하는 목록만 노출한다. 선택 시 0건이 나오는 옵션을 노출하지 않는다.

### 4.4 CORS (G10) — **MUST 화이트리스트**
`allow_origins=["*"]`와 `allow_credentials=True`를 함께 쓰지 않는다. 운영 오리진을 명시적 화이트리스트로 지정한다.

### 4.5 레이트리밋 (G13) — **MUST 실제 적용**
`auth.py`의 `check_rate_limit`이 정의만 되고 라우터에 연결되지 않았다. 의존성으로 실제 연결하거나, README의 "분당 100요청" 문구를 실상에 맞게 정정한다.

> 위 항목들의 **실제 코드 패치는 이 문서의 범위가 아니다**(규칙 고정만). 패치는 PROJECT_OVERVIEW 10장 P0 로드맵을 따른다.

---

## 5. 커밋 / PR 체크리스트

### 5.1 브랜치·커밋
- 기본 브랜치에서 직접 작업하지 않는다 — feature 브랜치를 먼저 만든다.
- 커밋·푸시는 **사용자가 명시적으로 요청할 때만** 수행한다.
- 커밋 메시지: 간결한 명령형 + 범위(예: `Fix: tools.py SQL 바인딩 :name 통일`).

### 5.2 PR 전 점검
- [ ] `cd frontend && npm run build` 통과(ESLint 경고 0).
- [ ] 백엔드 변경 시 임포트/구문·기동 점검.
- [ ] **시크릿 없음** — 키·비밀번호·커넥션 문자열 미포함.
- [ ] API 계약 변경 시 `services/api.js` + API 문서 동기화(필요 시 api-contract-guardian).
- [ ] 데이터 스키마 변경 시 `tools_data.json` 유효성(`python -m json.tool`)·로더 확인.
- [ ] 디자인 변경 시 DESIGN.md 토큰 준수, 다크모드 깨짐 없음.

---

## 6. 문서 맵 (단일 출처)

| 문서 | 무엇의 정본 | 비고 |
|---|---|---|
| [CLAUDE.md](../CLAUDE.md) | 원칙·규칙·라우팅 **요약** | 매 세션 자동 로드, 간결 유지 |
| [docs/GOVERNANCE.md](./GOVERNANCE.md) (이 문서) | 거버넌스 **세부** | 컨벤션·하드룰·협업·체크리스트 |
| [docs/DESIGN.md](./DESIGN.md) | 디자인 토큰·컴포넌트 **서술** | 최종 정본은 코드 `Home.css :root` |
| [docs/PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | **현 상태 진단**·갭(G1~G13)·로드맵 | 상태 판단의 정본 |
| [docs/UX_Compare_Page_Redesign.md](./UX_Compare_Page_Redesign.md) | Compare 페이지 UX 스펙 | 구현 대기 |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) / [API_SPECIFICATION.md](API_SPECIFICATION.md) | API 계약 | **코드 라우터와 대조 필요** |
| [DATA_COLLECTION_PLAN.md](DATA_COLLECTION_PLAN.md) | 자동 수집 설계 | 미구현 |
| [README.md](../README.md) / [ARCHITECTURE.md](ARCHITECTURE.md) | 제품 소개·아키텍처 | **스택 정정 필요**(TS/Tailwind/Vite/Render 주장) |
| `.claude/agents/*.md` | 각 에이전트 지시문 | 에이전트 동작의 정본 |

**충돌 시 우선순위**: 실제 코드 > PROJECT_OVERVIEW(진단) > 기타 문서.

---

## 7. 변경 이력 / 결정 로그

원칙·규칙·스택 결정이 바뀌면 여기에 한 줄씩 누적한다(최신이 위).

- 2026-05-30 — 거버넌스 문서 신설(CLAUDE.md + GOVERNANCE.md). 8개 에이전트 라우팅, P0 갭(G5/G7/G9/G10/G13) 하드룰화.
