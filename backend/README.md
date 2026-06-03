# AITools 백엔드 — DB 부트스트랩 가이드

FastAPI + 원시 SQL(SQLAlchemy `text()`, ORM 없음) + PostgreSQL.
이 문서는 **빈 새 DB 를 레포만으로 세우는 절차의 정본**이다.

> 과거에는 `tools`/`pricing`/`benchmarks`/`news` 테이블이 레포 밖에서 수동 생성되어
> 재현이 불가능했다. 이제 [`schema.sql`](schema.sql) 이 8개 테이블의 정본이고,
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
| 1 | [`init_db.py`](init_db.py) | `schema.sql` 실행 → 8개 테이블/인덱스 생성(`github_trending`·`events` 포함) |
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

### ⚠️ 운영 중 DB 에 `github_trending` 테이블 선적용(중요)

`schema.sql` 의 `CREATE TABLE IF NOT EXISTS github_trending ...` 는 **이미 운영 중인 DB**
에도 안전하게 적용된다(없으면 생성, 있으면 무동작). 단, **코드(라우터/수집기)가 새 테이블을
쓰기 전에 DB 에 테이블이 먼저 존재해야 한다.** 과거 `news.title_ko` 컬럼을 코드가 먼저
참조해 운영에서 깨졌던 사고의 교훈이다 — **순서를 반드시 지킬 것**:

```bash
# 1) 코드 배포 전(또는 직후 즉시) 운영 DB 에 스키마 재적용 → github_trending 생성.
cd backend
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python init_db.py
# 2) 그 다음에 수집(테이블 채우기). 비어 있으면 라우터는 빈 결과를 graceful 반환.
DATABASE_URL='...' [GITHUB_TOKEN=...] python collect.py
```

테이블이 없는 상태로 `/api/trends/github` 가 호출되면 라우터는 예외를 잡아
`{success:false, error:DATABASE_ERROR}` 로 응답한다(앱은 죽지 않음). 정상 점등을 위해
**선적용 → 수집** 순서를 지킨다.

#### `events` 테이블도 동일(전환 추적 — POST /api/events)

`events` 테이블 역시 **코드(`routers/events.py`)가 INSERT 하기 전에 DB 에 먼저 존재해야 한다.**
배포 전(또는 직후 즉시) 운영 DB 에 `python init_db.py` 를 한 번 실행하면 `CREATE TABLE
IF NOT EXISTS events ...` 가 멱등 적용된다(데이터 적재 불필요 — 빈 테이블로 시작해 클릭 시 채워짐).
프론트는 실패를 침묵 처리하므로 테이블 부재 시에도 사용자 동선은 무해하지만, 계측 점등을 위해
**스키마 선적용**을 지킨다. 개인정보(IP/User-Agent)는 저장하지 않는다.

#### `tools` 자동 갱신/발견 컬럼도 동일(인기지표·신규 도구)

`schema.sql` 은 `tools` 에 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 로 자동 갱신 컬럼
(`github_repo`·`github_stars`·`hn_object_id`·`hn_points`·`metrics_synced_at`·`source`)을
멱등 추가한다. **수집기(`collectors/tools_metrics.py`·`tools_discover.py`)나 라우터가 이
컬럼을 읽기 전에 운영 DB 에 먼저 적용해야 한다** — 동일하게 `python init_db.py` 선실행.
- 인기지표 갱신: 일일 `collect.py`(에 `tools_metrics` 등록됨)가 `github_stars`/`hn_points`
  를 갱신한다. **검증 가능한 공식 API 값만** 갱신하고 `user_count` 는 건드리지 않는다.
- 신규 도구 발견: `python collect.py --discover-tools`(주간 워크플로우)가 Hacker News
  "Show HN" 에서 AI 도구를 찾아 `source='auto_hn'` 로 자동 공개한다. 카테고리는 기존 20종
  화이트리스트로 정규화돼 프론트 필터를 오염시키지 않는다.
- 롤백: 자동 발견 도구는 `DELETE FROM tools WHERE source='auto_hn'` 로 일괄 제거 가능.

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
UNION ALL SELECT 'news',       COUNT(*) FROM news        -- 0 예상
UNION ALL SELECT 'github_trending', COUNT(*) FROM github_trending;  -- 0 예상(수집 전)
```
기대: `tools=78`, `pricing>0`, `tags=19`, `tool_tags=312`, `benchmarks=24`, `news=0`, `github_trending=0`.

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
| `collectors/github_trending.py` | GitHub Search 로 트렌딩 레포 수집 → **독립 `github_trending` 테이블**을 period 별 멱등 교체(`GITHUB_TOKEN` 선택). `/api/trends/github` 의 소스 |
| `app/trends_themes.py` | 깃헙 트렌드 주제(테마) 매핑 단일 정본 — `routers/trends.py` 전용 |
| `scheduler.py` | APScheduler(BackgroundScheduler), 가드/시작/종료 |
| `collect.py` | 스케줄러 없이 **수동 1회** 전체 수집(초기 적재·테스트·외부 cron 용). `--backfill-translations`(뉴스), `--backfill-trends-translations`(github_trending) 백필 플래그 포함 |

### 환경변수

| 변수 | 기본 | 설명 |
|---|---|---|
| `ENABLE_SCHEDULER` | (off) | `true` 일 때만 스케줄러 가동. 미설정/false 면 앱은 스케줄러 없이 정상 기동. |
| `SCHEDULER_WORKER` | (off) | 멀티워커 중복 방지. `true` 인 **단일 프로세스**에서만 잡을 띄움. |
| `COLLECT_INTERVAL_HOURS` | `24` | 수집 주기(시간). |
| `GITHUB_TOKEN` | (선택) | 있으면 GitHub 인증 호출(릴리스+Search 레이트↑). 없으면 무토큰. |
| `PRODUCT_HUNT_TOKEN` | (선택) | 있어야 Product Hunt 소스 활성. 없으면 조용히 skip. |
| `GITHUB_TRENDING_MIN_STARS_WEEKLY` | `25` | 주간 트렌딩 별점 임계값(품질 필터 중간 강도로 상향). |
| `GITHUB_TRENDING_MIN_STARS_MONTHLY` | `100` | 월간 트렌딩 별점 임계값(품질 필터 중간 강도로 상향). |
| `MYMEMORY_EMAIL` | (선택) | 번역 무료 일일 단어한도 확대용 이메일(키 아님). 대량 번역/백필 시 **권장**. |

> 비밀정보(토큰)는 환경변수로만 주입하며 코드/로그에 남기지 않는다(헌법 G9).

### 수동 수집(권장 초기 적재법)

```bash
cd backend
DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python collect.py
# 토큰을 함께 주면 해당 소스도 수집:
#   GITHUB_TOKEN=... PRODUCT_HUNT_TOKEN=... DATABASE_URL=... python collect.py
```

멱등하므로 여러 번 실행해도 중복 행이 생기지 않는다(같은 `source_url` 또는 `(tool_id, title)` skip).

### 한글 번역 백필(재수집 없음, 멱등)

```bash
cd backend
# 뉴스: title_ko 가 NULL 인 행 번역
DATABASE_URL='...' python collect.py --backfill-translations --limit 50
# GitHub Trending: description_ko 가 NULL 인 행 번역(과거 429 로 빈 행 채우기, 120행이면 --limit 200)
DATABASE_URL='...' MYMEMORY_EMAIL='you@example.com' python collect.py --backfill-trends-translations --limit 200
```

번역 모듈에 요청 간 throttle(약 1.1초)·429 점증 backoff 재시도가 내장돼 무더기 429 를 예방한다. 일시 실패 행은 원문을 유지한 채 남아 다음 실행에서 재시도된다. `MYMEMORY_EMAIL` 설정 시 일일 단어한도가 완화돼 권장.

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
- 트렌딩: 수집 후 `github_trending` 행수 확인, `GET /api/trends/github?period=weekly` ·
  `?period=monthly` 점등. period 멱등 교체이므로 재실행 시 행수는 누적되지 않고 상위 N 으로 수렴.

## TODO (후속, 이번 범위 밖)

- **render.yaml 인프라 코드화**: `databases:` 블록 + `fromDatabase` 로 `DATABASE_URL`
  자동 주입을 두면 대시보드 수동 입력을 없앨 수 있다. 단, 현재 DB 를 대시보드에서
  수동 생성/관리 중이라 충돌을 피하려 보류했다. Blueprint 일원화 시 도입 검토.
- 수집 소스 확장(RSS 피드/리포/벤치마크), 슬랙 알림은 후속.
