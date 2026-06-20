# CLAUDE.md — AITools 프로젝트 헌법

> 이 파일은 매 세션 자동 로드된다. 사람과 AI 에이전트 모두의 **단일 출처(요약)**다. 세부는 [docs/GOVERNANCE.md](docs/GOVERNANCE.md)와 각 정본 문서를 가리킨다. 짧게 유지할 것.

## 프로젝트

**AITools** — AI 도구를 탐색·비교·추천받는 풀스택 웹 플랫폼.
**정직한 현재 상태**: 탐색·비교·추천·벤치마크 동작(데이터 적재 완료). **뉴스·깃헙트렌드는 0행 시작 → 수집 cron으로 점등.** (진단 정본: [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md))

## 실제 기술 스택 (fact 기준 — 문서 주장과 다를 수 있음)

- **백엔드**: FastAPI · raw SQL(SQLAlchemy `text()`, ORM 모델 없음) · PostgreSQL · 구조 `backend/app/{main,database,auth,exceptions}.py + routers/`
- **프론트**: React 19 · CRA(react-scripts) · 순수 CSS · Zustand · Axios · react-router-dom v7
- **주의**: README/ARCHITECTURE는 fact 기준으로 정정 완료(2026-05). 그래도 문서-코드 충돌 시 **코드가 사실이다**.

## 핵심 원칙

1. **실제 코드가 사실이다.** 문서-코드 충돌 시 코드 우선, 발견하면 문서를 동기화한다.
2. **일관성 우선.** 새 코드는 기존 패턴·토큰·구조를 재사용한다(새로 만들기 전에 찾는다).
3. **데이터 정합성이 기능보다 먼저다.** 빈 결과·깨진 필터를 남기지 않는다.
4. **비밀정보는 절대 커밋하지 않는다.**

## 에이전트 라우터

세부 지시문 정본은 `.claude/agents/<name>.md`. (커스텀 에이전트는 **Claude Code 재시작 후** 자동 위임 활성화)

| 에이전트 | 언제 호출 | 위임/협업 |
|---|---|---|
| `product-strategist` | 기능 기획, 시장·트렌드 리서치, 로드맵·PRD | → 실현성은 구현 에이전트 |
| `ux-ui-designer` | UX/UI 설계, 디자인 시스템, 컴포넌트 스펙 | → 구현은 frontend-react |
| `backend-fastapi` | 라우터·DB·인증·예외 등 `backend/app` 변경 | ↔ api-contract-guardian |
| `frontend-react` | 페이지·컴포넌트·상태·연동 `frontend/src` 변경 | ↔ ux-ui-designer |
| `api-contract-guardian` | 엔드포인트/스키마 변경 후 정합성 점검(읽기) | ← back/front |
| `tools-data-curator` | `tools_data.json`·벤치마크·뉴스 데이터 품질 | ↔ backend, data-collector |
| `security-reviewer` | 보안 점검(인증·SQLi·CORS·시크릿, 읽기) | → 수정은 back/front |
| `data-collector` | APScheduler 자동 수집 파이프라인 | → 스키마는 tools-data-curator |

## 핵심 하드룰 (MUST / NEVER)

- **NEVER**: API 키·DB 비밀번호 등 비밀정보를 소스/커밋에 하드코딩. 환경변수만 사용. (근거 G9)
- **MUST**: 모든 DB 접근은 parameterized. SQLAlchemy `text()`는 `:name` 바인딩을 쓴다 — `%(name)s` 금지. (근거 G7)
- **MUST**: 프론트 필터/추천 옵션값은 실제 DB 카테고리·태그와 동기화. 임의 하드코딩 목록 금지. (근거 G5/G6)
- **MUST**: 색·간격·라운드는 [docs/DESIGN.md](docs/DESIGN.md) 토큰만 사용(인라인 hex 금지). 버튼 pill 금지.
- **MUST**: API 응답은 `{success, data, error}` 포맷 유지. 라우터 `except`는 `exceptions.py`의 `db_error(logger, "작업명")`로 통일(error_id 추적성). (근거 G/4.7)
- **MUST**: API 계약(경로·파라미터·응답) 변경 시 프론트 `services/api.js` + API 문서를 함께 갱신.
- **NEVER**: `is_open_source`를 raw 컬럼으로 SELECT. 실제 컬럼 아님 — `github_repo` 유무로 파생(`tools.py` 규칙). raw 조회 시 엔드포인트 500. (근거 4.6)

## 코드 컨벤션 (요약 — 세부는 GOVERNANCE.md)

- **백엔드**: PEP 8 · 타입 힌팅 · 함수/클래스 docstring. 예외는 `exceptions.py` 패턴 재사용.
- **프론트**: ESLint(react-app) 통과, **빌드 깨는 경고 금지**(Vercel 엄격). 서버 호출은 `services/api.js` 경유(직접 axios 금지). Linear 토큰 준수. 색만으로 의미 전달 금지(텍스트/아이콘 병행).

## 커밋 / PR

- 기본 브랜치에서 바로 작업하지 말고 브랜치를 먼저 만든다. 커밋·푸시는 **사용자가 요청할 때만**.
- PR 전: `cd frontend && npm run build` 통과 · 시크릿 없음 · 문서/계약 동기화 확인.

## 문서 맵 (단일 출처)

| 문서 | 무엇의 정본 |
|---|---|
| **CLAUDE.md** (이 파일) | 원칙·규칙·에이전트 라우팅 요약 |
| [docs/GOVERNANCE.md](docs/GOVERNANCE.md) | 거버넌스 세부(컨벤션·하드룰·협업·체크리스트) |
| [docs/DESIGN.md](docs/DESIGN.md) | 디자인 토큰·컴포넌트 서술 (코드 `frontend/src/styles/Home.css` `:root`가 최종 정본) |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | 현 상태 진단·갭(G1~G13)·개선 로드맵 |
| [docs/UX_REVIEW.md](docs/UX_REVIEW.md) | 기획-UX 검토 (단일 출처) |
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | API 계약 (단, 코드 라우터와 대조 필요) |
| [docs/DATA_COLLECTION_PLAN.md](docs/DATA_COLLECTION_PLAN.md) | 자동 수집 설계안 (구현은 `collectors/`·`collect.py`로 완료) |
| [backend/README.md](backend/README.md) | DB 부트스트랩 절차(schema.sql·bootstrap.py·검증) 정본 |
| `.claude/agents/*.md` | 각 에이전트 지시문 |

> 충돌 시 우선순위: **실제 코드 > PROJECT_OVERVIEW(진단) > 기타 문서**. CLAUDE.md·README 외 문서는 `docs/`에 둔다(CLAUDE.md는 자동 로드, README는 GitHub 표시 때문에 루트 고정).
