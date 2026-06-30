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
- **자동 차단**: [gitleaks](https://github.com/gitleaks/gitleaks)가 2단계로 시크릿 커밋을 막는다 — ① CI(`.github/workflows/ci.yml`)가 PR/push마다 전체 히스토리를 스캔(발견 시 실패), ② 로컬 pre-commit 훅(`.pre-commit-config.yaml`)이 커밋 전 선차단. 룰셋·허용 목록은 루트 `.gitleaks.toml`.
- **시크릿 공유**: 운영 시크릿은 git 밖(패스워드 매니저 공유 볼트)으로만 전달. 슬랙 평문·이슈·커밋 금지. 로컬 개발에는 운영 시크릿이 필요 없다(로컬 DB 부트스트랩으로 충분 — `.env.example` 참조).

### 4.2 SQL 바인딩 (G7) — **MUST `:name` 통일**
SQLAlchemy `text()`에 psycopg2 스타일 `%(name)s`를 쓰지 않는다(런타임 오류 위험). `:name` 바인딩 + `params` dict로 통일. 모든 DB 접근은 parameterized(문자열 포매팅으로 쿼리 조립 금지 → SQL Injection 방지).

### 4.3 필터·옵션 동기화 (G5/G6) — **MUST DB와 일치**
프론트 필터 카테고리·추천 옵션값을 임의 하드코딩하지 않는다. 실제 DB의 distinct 카테고리/태그를 받아 동적 렌더하거나, 최소한 실제 데이터와 일치하는 목록만 노출한다. 선택 시 0건이 나오는 옵션을 노출하지 않는다.

### 4.4 CORS (G10) — **MUST 화이트리스트**
`allow_origins=["*"]`와 `allow_credentials=True`를 함께 쓰지 않는다. 운영 오리진을 명시적 화이트리스트로 지정한다.

### 4.5 레이트리밋 (G13) — **MUST 실제 적용**
`auth.py`의 `check_rate_limit`이 정의만 되고 라우터에 연결되지 않았다. 의존성으로 실제 연결하거나, README의 "분당 100요청" 문구를 실상에 맞게 정정한다.

### 4.6 라이선스(`is_open_source`)는 파생값 — **NEVER raw 컬럼 SELECT**
`is_open_source`는 `tools` 테이블의 **실제 컬럼이 아니다**. `github_repo`(있으면 오픈소스)에서 파생한다. 라우터에서 라이선스를 노출할 때는 `tools.py`/상세와 동일하게 `github_repo`를 조회해 `is_open_source = (github_repo is not None)`로 계산한다. `SELECT ... is_open_source FROM tools`처럼 raw 컬럼으로 조회하면 `column "is_open_source" does not exist`로 **해당 엔드포인트 전체가 500**이 된다(실제 사고: compare.py가 PR #55~#67까지 상시 장애였음). 카드·필터가 "이미 쓰니 컬럼이 있겠지"는 함정 — 그것도 파생값을 쓴 것이다.

### 4.7 예외 추적성 (error_id) — **MUST 공통 헬퍼/핸들러 경유**
라우터 `except Exception`에서 응답을 직접 조립하지 말고 `app/exceptions.py`의 `db_error(logger, "<작업명>")`를 쓴다. 이 헬퍼는 짧은 `error_id`를 생성해 **서버 로그(traceback)와 응답 `error.error_id`에 동시에** 남긴다. 모든 예외를 generic `DATABASE_ERROR`로 뭉뚱그리면 원인이 가려진다(실제로 compare 장애 원인을 1주+ 못 찾음). **prod 디버깅 절차**: 사용자/화면(ErrorState "오류 코드: …")에서 받은 `error_id`로 Railway 로그를 grep → 해당 traceback 확인. 5xx에만 부여(4xx 예상 오류엔 없음). 내부 메시지·스택은 응답에 노출하지 않는다.

> 위 항목들의 **실제 코드 패치는 이 문서의 범위가 아니다**(규칙 고정만). 패치는 PROJECT_OVERVIEW 10장 P0 로드맵을 따른다.

---

## 5. 커밋 / PR 체크리스트

### 5.0 신규 합류자 온보딩
1. 레포 클론 → `.env.example`을 참고해 로컬 환경 구성(로컬은 `DATABASE_URL` 하나면 충분, 운영 시크릿 불필요).
2. 로컬 PostgreSQL + `cd backend && DATABASE_URL=... python bootstrap.py`(스키마+도구+태그+벤치마크 멱등 적재). 절차 정본: [backend/README.md](../backend/README.md).
3. 프론트: `cd frontend && cp .env.example .env.local && npm start`.
4. 시크릿 사고 예방용 pre-commit(권장): `pip install pre-commit && pre-commit install`(레포당 1회).
- 빠른 시작·환경변수 상세는 [README.md](../README.md).

### 5.1 브랜치·커밋
- 기본 브랜치에서 직접 작업하지 않는다 — feature 브랜치를 먼저 만든다.
- 커밋·푸시는 **사용자가 명시적으로 요청할 때만** 수행한다.
- 커밋 메시지: 간결한 명령형 + 범위(예: `Fix: tools.py SQL 바인딩 :name 통일`).

### 5.2 PR 전 점검
- [ ] `cd frontend && npm run build` 통과(ESLint 경고 0).
- [ ] 백엔드 변경 시 임포트/구문·기동 점검.
- [ ] **시크릿 없음** — 키·비밀번호·커넥션 문자열 미포함(CI gitleaks가 자동 검증하나, pre-commit으로 선차단 권장).
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
| [docs/UX_REVIEW.md](./UX_REVIEW.md) | 기획-UX 검토(5화면 실무 컨펌 포함) | 단일 출처 |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) / [API_SPECIFICATION.md](API_SPECIFICATION.md) | API 계약 | **코드 라우터와 대조 필요** |
| [DATA_COLLECTION_PLAN.md](DATA_COLLECTION_PLAN.md) | 자동 수집 설계 | 구현 완료(`collectors/`·`collect.py`·`scheduler.py`) |
| [README.md](../README.md) / [ARCHITECTURE.md](ARCHITECTURE.md) | 제품 소개·아키텍처 | fact 기준 정정 완료(2026-06) |
| `.claude/agents/*.md` | 각 에이전트 지시문 | 에이전트 동작의 정본 |

**문서 배치 규칙**: `CLAUDE.md`(루트 — Claude Code 자동 로드)·`README.md`(루트 — GitHub 표시)만 루트에 둔다. 나머지 문서는 전부 `docs/`. CLAUDE.md를 `docs/`로 옮기면 프로젝트 규칙이 세션에 자동 로드되지 않는다.

**충돌 시 우선순위**: 실제 코드 > PROJECT_OVERVIEW(진단) > 기타 문서.

---

## 7. 변경 이력 / 결정 로그

원칙·규칙·스택 결정이 바뀌면 여기에 한 줄씩 누적한다(최신이 위).

- **2026-06-15** 팀 협업 온보딩 정비 — ① 세션 기록 훅 3종을 `.claude/settings.json`으로 팀 공유(로그는 `.claude/local/` 개인 분리), ② `.env.example`(backend/frontend) 추가로 로컬은 `DATABASE_URL`만으로 실행, ③ gitleaks 시크릿 스캔(CI+pre-commit) 도입, ④ 문서 배치 규칙 명문화(CLAUDE.md·README만 루트). (G9 자동화 보강)
- **2026-06-15** 배포 정의 일원화(G11 해소) — 고아 `render.yaml`(Render Blueprint)·`Procfile`(uvicorn worker 미지정으로 기동 실패하던 깨진 설정) 제거. 배포 정의를 `Dockerfile`(Railway, uvicorn) 단일로 통일. 실제 토폴로지는 **백엔드 Railway · DB Render · 프론트 Vercel** 변동 없음.
- **2026-06-30** DB 호스팅 Render→**Neon** 이전 — Render 무료 PostgreSQL 만료로 운영 DB 중단. 만료 직전 `pg_dump` 백업(111도구·뉴스155·트렌드95)을 Neon(`ap-southeast-1`)으로 `pg_restore` 복원 후 `DATABASE_URL` 교체. **재발 방지**: ① 무료 DB는 만료 주기 있음 → `backend/backup_db.py`(pg_dump 풀백업) 도입, ② 운영 누적분이 레포 시드에 없던 갭 → `backend/export_seeds.py`(라이브→시드 baseline)로 `tools_data.json` 78→111 갱신, ③ `pg_dump`/`pg_restore`는 **클라이언트 버전 ≥ 서버(PG17+)** 필요(`brew install libpq`), ④ Neon 대량 복원·DDL은 **direct 엔드포인트**(pooler 아님). 현 토폴로지: **백엔드 Railway · DB Neon · 프론트 Vercel**.

- 2026-05-30 — 거버넌스 문서 신설(CLAUDE.md + GOVERNANCE.md). 8개 에이전트 라우팅, P0 갭(G5/G7/G9/G10/G13) 하드룰화.
