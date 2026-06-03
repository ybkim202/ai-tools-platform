"""자동 데이터 수집(collectors) 패키지.

각 소스 모듈(rss / github / producthunt)은 `collect(conn) -> int` 시그니처를 갖고,
수집한 뉴스를 멱등하게 news 테이블에 upsert 한 뒤 "신규 삽입 행수"를 반환한다.

소스 활성화 규칙
----------------
- rss          : 키리스. 항상 활성(공개 RSS 피드).
- github       : GITHUB_TOKEN 이 있으면 인증 호출, 없으면 무토큰 공개 호출(레이트 낮음).
- producthunt  : PRODUCT_HUNT_TOKEN 이 없으면 조용히 skip(에러 아님).

설계 원칙(헌법 + 작업 요구)
---------------------------
- 멱등: source_url 중복 시 skip. → 재실행해도 중복 적재 없음.
- 에러 격리: 한 소스/한 항목 실패가 다른 것을 막지 않게 try/except + 로깅.
- 비밀정보: 토큰은 환경변수로만 읽고 로그에 남기지 않는다.
- SQL: psycopg2 %s 파라미터 바인딩만 사용(f-string 값 삽입 금지).
"""

from .base import ACTIVE_COLLECTORS, backfill_translations, collect_all
from .github_trending import (
    backfill_translations as backfill_trends_translations,
)
from .tools_discover import collect as discover_tools

__all__ = [
    "ACTIVE_COLLECTORS",
    "backfill_translations",
    "backfill_trends_translations",
    "collect_all",
    "discover_tools",
]
