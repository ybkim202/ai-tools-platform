# AITools 백엔드 — DB 부트스트랩 가이드

FastAPI + 원시 SQL(SQLAlchemy `text()`, ORM 없음) + PostgreSQL.
이 문서는 **빈 새 DB 를 레포만으로 세우는 절차의 정본**이다.

> 과거에는 `tools`/`pricing`/`benchmarks`/`news` 테이블이 레포 밖에서 수동 생성되어
> 재현이 불가능했다. 이제 [`schema.sql`](schema.sql) 이 6개 테이블의 정본이고,
> [`bootstrap.py`](bootstrap.py) 한 번으로 스키마 → 데이터가 멱등 적재된다.

## 사전 준비

- Python 의존성: `pip install -r requirements.txt`
- **비밀정보는 환경변수로만.** 접속정보를 소스/`backend/env` 에 적지 않는다(헌법 G9).
  `backend/env` 는 `.gitignore` 로 추적 제외돼 있다 — 여기에 비밀번호를 넣어도 커밋되지 않지만,
  습관적으로 셸 `export` 또는 배포 플랫폼 env 사용을 권장한다.

## 부트스트랩 (한 번에)

```bash
cd backend
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python bootstrap.py
```

`bootstrap.py` 가 아래 3단계를 순서대로(멱등) 실행한다:

| 순서 | 스크립트 | 하는 일 |
|---|---|---|
| 1 | [`init_db.py`](init_db.py) | `schema.sql` 실행 → 6개 테이블/인덱스 생성 |
| 2 | [`load_tools_fixed.py`](load_tools_fixed.py) | `tools_data.json`(78개) → `tools` / `pricing` 적재 |
| 3 | [`seed_tags.py`](seed_tags.py) | `tags_seed.json` → `tags` / `tool_tags` 적재(추천 활성화) |
| 4 | [`seed_benchmarks.py`](seed_benchmarks.py) | `benchmarks_data.json` → `benchmarks` 적재(벤치마크 활성화, LLM 9개·24행) |

### 개별 실행도 가능

```bash
DATABASE_URL='...' python init_db.py            # 스키마만
DATABASE_URL='...' python load_tools_fixed.py   # 도구/가격만
DATABASE_URL='...' python seed_tags.py          # 태그만
DATABASE_URL='...' python seed_benchmarks.py    # 벤치마크만(도구 적재 후)
```

> **알려진 한계**: `load_tools_fixed.py` 는 도구가 이미 존재하면 UPDATE 만 하고
> `pricing` 은 신규 INSERT 분기에서만 채운다. 따라서 **빈 새 DB 에 1회 실행**을 전제로 한다.
> (부분 적재 후 재실행 시 pricing 이 비어 있을 수 있음.)

## 새 DB 로 교체(노출된 옛 DB 폐기) 절차

1. Render → **New + → PostgreSQL** 로 새 DB 생성(같은 region/버전).
2. 위 `python bootstrap.py` 를 **새 External URL** 로 1회 실행.
3. Render **백엔드 서비스 → Environment → `DATABASE_URL`** 을 새 URL 로 교체(자동 재배포).
4. 아래 검증 통과 후 → Render 에서 **옛 DB 삭제** = 노출 URL 완전 무효화.

## 검증

### 행수
```sql
SELECT 'tools' AS t, COUNT(*) FROM tools
UNION ALL SELECT 'pricing',    COUNT(*) FROM pricing
UNION ALL SELECT 'tags',       COUNT(*) FROM tags
UNION ALL SELECT 'tool_tags',  COUNT(*) FROM tool_tags
UNION ALL SELECT 'benchmarks', COUNT(*) FROM benchmarks   -- 24 예상(LLM 9개)
UNION ALL SELECT 'news',       COUNT(*) FROM news;        -- 0 예상
```
기대: `tools=78`, `pricing>0`, `tags=19`, `tool_tags=312`, `benchmarks=24`, `news=0`.

### 추천 활성화
`GET /api/recommendations?task=<시드에 존재하는 task명>` →
`meta.feature_status == "ready"` 이고 `data` 가 비어 있지 않으면 성공.
(빈 DB 일 때 `coming_soon` 이 정상 — 적재 후 `ready` 전환이 핵심 신호.)

### 스모크
- 탐색: `GET /api/tools?category=생성형AI`
- 상세: `GET /api/tools/{id}` (benchmarks/news 가 빈 배열이어도 200)
- 비교: `GET /api/compare?ids=1,2,3`

## 자동 데이터 수집 (APScheduler)

빈 `news` 테이블을 공개 소스에서 자동/수동으로 채워 뉴스·트렌딩 기능을 점등한다.
설계 배경은 [`../DATA_COLLECTION_PLAN.md`](../DATA_COLLECTION_PLAN.md), 구현은 아래.

| 파일 | 역할 |
|---|---|
| `collectors/base.py` | DB 연결 · news 멱등 upsert · HTTP(타임아웃/재시도) · tools 매칭 · `collect_all()` |
| `collectors/rss.py` | **키리스**(토큰 불필요) 공개 RSS 피드 파싱 — 항상 활성 |
| `collectors/github.py` | GitHub 릴리스 — `GITHUB_TOKEN` 있으면 인증, 없으면 무토큰 공개 호출 |
| `collectors/producthunt.py` | Product Hunt 트렌딩 — `PRODUCT_HUNT_TOKEN` 없으면 조용히 skip |
| `scheduler.py` | APScheduler(BackgroundScheduler), 가드/시작/종료 |
| `collect.py` | 스케줄러 없이 **수동 1회** 전체 수집(초기 적재·테스트·외부 cron 용) |

### 환경변수

| 변수 | 기본 | 설명 |
|---|---|---|
| `ENABLE_SCHEDULER` | (off) | `true` 일 때만 스케줄러 가동. 미설정/false 면 앱은 스케줄러 없이 정상 기동. |
| `SCHEDULER_WORKER` | (off) | 멀티워커 중복 방지. `true` 인 **단일 프로세스**에서만 잡을 띄움. |
| `COLLECT_INTERVAL_HOURS` | `24` | 수집 주기(시간). |
| `GITHUB_TOKEN` | (선택) | 있으면 GitHub 인증 호출(레이트↑). 없으면 무토큰. |
| `PRODUCT_HUNT_TOKEN` | (선택) | 있어야 Product Hunt 소스 활성. 없으면 조용히 skip. |

> 비밀정보(토큰)는 환경변수로만 주입하며 코드/로그에 남기지 않는다(헌법 G9).

### 수동 수집(권장 초기 적재법)

```bash
cd backend
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python collect.py
# 토큰을 함께 주면 해당 소스도 수집:
#   GITHUB_TOKEN=... PRODUCT_HUNT_TOKEN=... DATABASE_URL=... python collect.py
```

멱등하므로 여러 번 실행해도 중복 행이 생기지 않는다(같은 `source_url` 또는 `(tool_id, title)` skip).

### 자동 스케줄러 켜는 법

```bash
ENABLE_SCHEDULER=true SCHEDULER_WORKER=true COLLECT_INTERVAL_HOURS=24 \
  DATABASE_URL=... gunicorn app.main:app
```

**멀티워커 한계(중요)**: gunicorn 워커마다 스케줄러가 뜨면 중복 실행된다.
두 가드(`ENABLE_SCHEDULER` + `SCHEDULER_WORKER`)로 단일 프로세스만 가동하도록 막는다.
권장 운영은 둘 중 하나:
1. **웹과 분리**: 웹 서비스는 가드 미설정(스케줄러 off), 수집은 별도 1프로세스에만 두 가드를 켠다.
2. **외부 cron(가장 단순)**: 스케줄러를 쓰지 않고 `python collect.py` 를 cron 으로 주기 실행.
만에 하나 중복 실행돼도 멱등 upsert 라 데이터는 손상되지 않는다.

### 검증

- 수동 수집 후 `news` 행수 증가 확인, `GET /api/news` · `GET /api/news/trending` 점등.
- 재실행 시 신규 0 / 스킵 N 으로 수렴(멱등).

## TODO (후속, 이번 범위 밖)

- **render.yaml 인프라 코드화**: `databases:` 블록 + `fromDatabase` 로 `DATABASE_URL`
  자동 주입을 두면 대시보드 수동 입력을 없앨 수 있다. 단, 현재 DB 를 대시보드에서
  수동 생성/관리 중이라 충돌을 피하려 보류했다. Blueprint 일원화 시 도입 검토.
- 수집 소스 확장(RSS 피드/리포/벤치마크), 슬랙 알림은 후속.
