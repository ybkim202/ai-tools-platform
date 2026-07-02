# AITools — AI 도구 탐색·비교·추천 플랫폼

> AI 도구를 **탐색**하고, **나란히 비교**하고, 업무·직군에 맞춰 **추천**받는 풀스택 웹 플랫폼.

이 README는 **실제 코드 기준**으로 작성됐다. (프로젝트 헌법: [CLAUDE.md](./CLAUDE.md) — "문서-코드 충돌 시 코드가 사실이다")

---

## 현재 상태 (정직한 진단)

| 기능 | 상태 |
|---|---|
| 홈 = 큐레이션 랜딩 | ✅ 2단 Hero(카테고리 큐레이션 위젯·자동 회전·타이핑 헤드라인) + 맞춤 추천 + 깃헙 트렌드·벤치마크 프리뷰 임베드 |
| 전체 탐색 (`/explore`) | ✅ 검색·필터·정렬·페이지네이션 |
| 도구 비교 (2~5개) | ✅ 동작 (**전역 모달** — 화면 이탈 없이 그 자리 비교) |
| 맞춤 추천 (업무/직군) | ✅ 동작 (랜딩 `#recommend` 임베드 · 태그 19개 · `tool_tags` ≈312행 적재) |
| 인기 랭킹 (`/leaderboard`) | ✅ 사용자 수 기준 전체 순위 |
| 벤치마크 | ✅ 동작 (`benchmarks` · LLM 적재 · 만점/신선도 표기) |
| 뉴스/깃헙 트렌드 | ⏳ 수집 파이프라인 완비, **0행 시작 → cron 수집 후 점등** |
| 도구 자동 갱신·발견 | ✅ 인기지표(GitHub stars·HN points) 일 1회 갱신 + 신규 AI 도구 자동 발견(Hacker News "Show HN", 주 1회, 키 불필요) |
| 자동 데이터 수집 (collectors + GitHub Actions cron) | ⏳ 구현됨, 상시 자동 실행은 아님 (APScheduler 기본 비활성 · 뉴스 매일 `0 0 * * *` · 도구 발견 주간 `0 0 * * 1` · 로고 헬스체크 주간 `0 1 * * 1`) |
| 도구 로고 | ✅ 자가치유 — 큐레이션 `logo_url` 부패 시 `official_url` 도메인 파비콘(Google s2)→레터아바타로 폴백. 주간 헬스체크가 부패 로고를 `logo_status='broken'`으로 표시(운영 관측) |

**화면 구성(IA, 2026-06 재설계)**: 홈(`/`)은 전체 그리드 대신 **2단 Hero(좌: 가치 카피·CTA / 우: 카테고리별 인기 큐레이션 위젯 — 아이콘 레일·자동 회전·타이핑 헤드라인)** 아래로 **맞춤 추천 → 깃헙 트렌드 프리뷰 → 벤치마크 프리뷰**를 임베드한다(프리뷰는 데이터 0행이면 미렌더). 전체 도구는 **`/explore`**(검색·필터·정렬)로 분리. 비교는 **전역 모달**(`/compare?ids=`는 모달 오픈 딥링크 폴백), 추천은 랜딩 임베드(`/recommendations`는 `/#recommend` 리다이렉트). 네비 = 탐색·랭킹·벤치마크·트렌드▾·소개. 설계·구현 이력: [docs/UX_REVIEW.md §9](./docs/UX_REVIEW.md)(랜딩 고도화 §9.7).

진단 정본: [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md)

---

## 기술 스택 (fact 기준)

### Backend
- **Python 3.11** · **FastAPI** · **Uvicorn/Gunicorn**
- **PostgreSQL** + **raw SQL** — SQLAlchemy `text()`의 `:name` 파라미터 바인딩 사용. **ORM 모델 없음.** 데이터 로더는 `psycopg2`.
- 구조: `backend/app/{main,database,auth,exceptions}.py` + `routers/`

### Frontend
- **React 19** · **CRA (react-scripts 5)** · **순수 CSS(디자인 토큰)** · **Zustand** · **Axios** · **react-router-dom v7**
- 디자인: **무채색 캔버스 + 잉크(검정 계열) 단일 강조**, 다크모드 1급 지원. 정본 [docs/DESIGN.md](./docs/DESIGN.md) (토큰 최종 정본은 `frontend/src/styles/Home.css`의 `:root`)

### Deployment
- **백엔드 → Railway** (Dockerfile)
- **DB → Supabase** (PostgreSQL 17, `ap-northeast-2` 서울, 프로젝트 `grepity`) — 2026-06-30 Render 무료 만료로 이전. 무료 티어는 장기 유휴 시 **일시정지(pause)**될 수 있으나 데이터는 보존(영구 삭제 없음). 조직당 무료 프로젝트 2개 한도.
- **프론트 → Vercel**
- 백엔드↔DB는 교차 프로바이더. `DATABASE_URL`은 Supabase **Session pooler**(포트 5432, IPv4) 연결 문자열 사용 — direct 연결(`db.<ref>.supabase.co`)은 IPv6 전용이라 IPv4 환경에선 실패. CORS는 `ALLOWED_ORIGINS` 환경변수 필수.
- **백업·복구**: `backend/backup_db.py`(pg_dump 풀백업) · `backend/export_seeds.py`(라이브→레포 시드 baseline 갱신) · 빈 DB 재구축은 `backend/bootstrap.py`. 절차 정본 [backend/README.md](./backend/README.md).

> ⚠️ 일부 옛 문서(ARCHITECTURE 등)는 TS·Tailwind·Vite를 주장하나 **실제와 다르다**. 코드가 사실이다.

---

## 빠른 시작 (로컬)

### 사전 요구
```
Python 3.11+ · Node.js 18+ · PostgreSQL 14+ (또는 원격 DB URL)
```

### 1) 백엔드 + DB 부트스트랩
```bash
cd backend
pip install -r requirements.txt

# DB 스키마 + 도구(78개) + 추천 태그(19) + 벤치마크(24)를 한 번에 적재 (멱등)
# bootstrap.py 가 init_db.py(schema.sql)→load_tools_fixed.py→seed_tags.py→seed_benchmarks.py 순 실행
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python bootstrap.py

# 개발 서버
DATABASE_URL='postgresql://...' uvicorn app.main:app --reload
```
- 부트스트랩 상세·검증 절차: [backend/README.md](./backend/README.md)
- 환경변수 템플릿: [backend/.env.example](./backend/.env.example) — 로컬은 `DATABASE_URL` 하나면 충분.
- 비밀정보는 **환경변수로만** 주입(소스 하드코딩 금지).

### 2) 프론트엔드
```bash
cd frontend
npm install

# 백엔드 주소를 빌드 변수로 주입 (또는 .env.example을 .env.local로 복사)
cp .env.example .env.local
npm start
# 프로덕션 빌드
CI=true npm run build
```
미설정 시 기본값은 `http://localhost:8000/api`.

### 3) 확인
```bash
curl http://localhost:8000/api/tools?limit=3      # 도구 목록
open http://localhost:8000/docs                   # Swagger UI
```

---

## 환경변수

템플릿: [backend/.env.example](./backend/.env.example) · [frontend/.env.example](./frontend/.env.example) — 변수 전체 목록·기본값·용도가 적혀 있다.
**로컬 개발에 운영 시크릿은 필요 없다**(로컬 DB 부트스트랩으로 충분). 운영 시크릿을 공유해야 할 때는 git 밖(패스워드 매니저 공유 볼트)으로만.

| 변수 | 위치 | 설명 |
|---|---|---|
| `DATABASE_URL` | 백엔드 | PostgreSQL 접속 문자열 (필수) |
| `ALLOWED_ORIGINS` | 백엔드 | CORS 허용 오리진(콤마 구분, 정확 일치). 미설정 시 `localhost:3000`만 허용 |
| `ALLOWED_ORIGIN_REGEX` | 백엔드 | (선택) CORS 허용 오리진 정규식. Vercel 프리뷰처럼 도메인이 매번 바뀌는 경우 패턴으로 허용. 예) `https://ai-tools-platform-.*\.vercel\.app`. 미설정 시 정규식 매칭 비활성 |
| `API_KEY` / `API_KEYS` | 백엔드 | (선택) `X-API-Key` 인증용. 미설정 시 인증 없이 공개 |
| `REACT_APP_API_URL` | 프론트(빌드) | 백엔드 API 베이스 URL (`.../api`) |

---

## API 개요

응답은 모두 `{ "success": bool, "data": ..., "error": ... }` 포맷. 인증은 선택적 `X-API-Key`(미설정 시 공개), 레이트리밋은 인메모리(IP/키 기준).

| 메서드 · 경로 | 설명 |
|---|---|
| `GET /api/tools` | 도구 목록 (검색·필터·페이징 · 인기지표 `github_stars`/`hn_points` 포함) |
| `GET /api/tools/meta` | 필터 옵션값(카테고리·태그·난이도) + 카운트(`total_tools`·`total_categories`) |
| `GET /api/tools/{id}` | 도구 상세 (가격·태그·벤치/뉴스) |
| `GET /api/recommendations` | 업무(`task`)/직군(`profession`) 추천 |
| `GET /api/compare?ids=` | 도구 비교 (2~5개) |
| `GET /api/news`, `/api/news/trending` | 뉴스 (0행 시작 — 수집 전엔 빈 결과) |
| `GET /api/benchmarks`, `/summary/{id}`, `/types`, `/categories`, `/matrix` | 벤치마크 (카테고리별 정본 셋 적재 · 다축 비교) |
| `GET /api/trends/github` | 깃헙 트렌드 (0행 시작 — 수집 전엔 빈 결과) |
| `POST /api/events` | 클릭 전환 이벤트 수집 (About CTA, 1st-party·IP/UA 미수집·rate limit) |

계약 정본: [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) · [API_SPECIFICATION.md](./docs/API_SPECIFICATION.md)

---

## 보안

- ✅ **파라미터라이즈드 SQL** (`:name` 바인딩) — SQL Injection 방지
- ✅ **비밀정보 환경변수 전용** (소스/커밋 하드코딩 금지)
- ✅ **CORS 화이트리스트** (`ALLOWED_ORIGINS`, 와일드카드 미사용)
- ✅ **에러 메시지 새니타이즈** (DB/스택 미노출, 서버 로그만)
- ✅ 선택적 `X-API-Key` 인증
- ⚠️ **레이트리밋은 인메모리** — 다중 워커/인스턴스에서는 정밀 제한 아님(향후 Redis 이전 권장)

---

## 문서 맵

| 문서 | 정본 내용 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 프로젝트 원칙·하드룰·에이전트 라우팅 |
| [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) | 거버넌스·컨벤션·체크리스트 |
| [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md) | 현 상태 진단·갭·로드맵 |
| [docs/DESIGN.md](./docs/DESIGN.md) | 디자인 시스템(무채색+잉크 토큰) |
| [docs/PRODUCT_PLAN.md](./docs/PRODUCT_PLAN.md) · [docs/DESIGN_SECTIONS.md](./docs/DESIGN_SECTIONS.md) | 4페이지 기획·섹션 디자인 스펙 |
| [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) · [API_SPECIFICATION.md](./docs/API_SPECIFICATION.md) | API 계약 |
| [backend/README.md](./backend/README.md) | DB 부트스트랩 절차 |
| [DATA_COLLECTION_PLAN.md](./docs/DATA_COLLECTION_PLAN.md) | 자동 수집 설계안 (구현은 `collectors/`·`collect.py`·`scheduler.py`로 완료) |

---

## 프로젝트 구조

```
ai-tools-platform/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI 앱 · CORS · 라우터 등록
│   │   ├── database.py        # DATABASE_URL 엔진/세션
│   │   ├── auth.py            # 선택적 API Key · 레이트리밋
│   │   ├── exceptions.py      # 표준 에러 핸들러
│   │   └── routers/           # tools · recommendations · compare · news · benchmarks · trends
│   ├── collectors/            # 수집 파이프라인 (base · rss · github · producthunt · github_trending · tools_metrics · tools_discover · logo_health)
│   ├── collect.py             # 수집 진입점 (--backfill-translations: 번역 백필 · --discover-tools: HN 신규 도구 발견 · --check-logos: 로고 헬스체크)
│   ├── scheduler.py           # APScheduler (기본 비활성)
│   ├── schema.sql             # 테이블 정본 DDL
│   ├── init_db.py             # schema.sql 실행 러너
│   ├── load_tools_fixed.py    # tools/pricing 적재 (tools_data.json)
│   ├── seed_tags.py           # tags/tool_tags 적재 (추천)
│   ├── seed_benchmarks.py     # benchmarks 적재 (benchmarks_data.json)
│   └── bootstrap.py           # 위 적재 단계 원샷 진입점 (멱등)
└── frontend/
    └── src/
        ├── pages/             # Home · About(소개) · Compare · Recommendations · News · Trends(GitHub) · Benchmarks · Details · NotFound(404)
        ├── components/        # ToolCard · CompareTray · Pagination · 상태뷰 등
        ├── stores/            # Zustand
        ├── services/api.js    # 모든 서버 호출 단일 경유
        └── styles/            # 디자인 토큰(:root) · 페이지 CSS
```

---

## 기여

1. 브랜치 생성 → 변경 → PR (기본 브랜치 직접 커밋 금지)
2. PR 전 체크: `cd frontend && CI=true npm run build` 통과 · 시크릿 없음 · 문서/계약 동기화
   - 시크릿은 CI의 gitleaks가 차단한다. 로컬 선차단(권장): `pip install pre-commit && pre-commit install` (1회)
3. 백엔드 PEP8·타입힌팅·docstring, 프론트 ESLint(react-app) 통과·빌드 경고 0
4. 모든 DB 접근은 `:name` 바인딩, API 응답은 `{success, data, error}` 유지

세부 규약: [docs/GOVERNANCE.md](./docs/GOVERNANCE.md)

---

> 라이선스 미설정(LICENSE 파일 없음). 사용 전 저장소 소유자에게 문의.
