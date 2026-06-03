"""수동 1회 수집 진입점 — 스케줄러 없이 모든 활성 소스를 즉시 수집한다.

용도: 초기 적재(빈 news 테이블 채우기), 테스트, 외부 cron 운영.

실행 방법
---------
    cd backend
    DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python collect.py

기존 뉴스 한글 번역 백필
------------------------
    cd backend
    DATABASE_URL='...' python collect.py --backfill-translations [--limit N]
  title_ko 가 NULL 인 기존 뉴스를 무료 MyMemory 번역 API 로 번역해 채운다
  (멱등, 기본 limit=50, 키 불필요). 네트워크/쿼터 실패 행은 원문을 유지한 채
  남아 다음 실행에서 재시도된다. requests 미설치 시 0 건으로 조용히 종료(에러 아님).

GitHub Trending 한글 번역 백필
------------------------------
    cd backend
    DATABASE_URL='...' python collect.py --backfill-trends-translations [--limit N]
  github_trending 행 중 description 이 있고 description_ko 가 NULL 인 것을 재수집
  없이 번역해 채운다(멱등, 기본 limit=200). 과거 429 레이트로 비었던 행을 한 번에
  채울 때 사용한다. MYMEMORY_EMAIL 설정 시 일일 단어한도가 완화돼 권장. 번역 모듈
  자체에 요청 간 throttle 과 429 재시도가 들어 있어 다시 무더기 429 를 맞지 않는다.

선택 환경변수(없으면 해당 소스만 비활성, 잡은 정상)
  - GITHUB_TOKEN        : GitHub 인증 호출(없으면 무토큰 공개 호출)
  - PRODUCT_HUNT_TOKEN  : Product Hunt 활성(없으면 조용히 skip)
  - MYMEMORY_EMAIL      : (선택) 번역 무료 일일 한도 확대용 이메일(키 아님,
                          미설정이면 익명 호출. 네트워크 실패 시 원문 유지)

이 스크립트는 ENABLE_SCHEDULER/SCHEDULER_WORKER 와 무관하게 항상 1회 실행한다
(스케줄러 가드는 자동 주기 실행에만 적용된다).

멱등성
------
모든 삽입은 source_url(또는 tool_id+title) 중복검사를 거치므로 여러 번 실행해도
중복 행이 생기지 않는다.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

# cwd 와 무관하게 collectors 패키지를 import 할 수 있도록 backend 디렉토리를 path 에 둔다.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("collect")


def main(argv=None) -> int:
    """전체 소스를 1회 수집한다. 반환값은 프로세스 종료코드(0=성공).

    --backfill-translations 가 주어지면 수집 대신 기존 뉴스의 한글 번역만 백필한다.
    --backfill-trends-translations 가 주어지면 github_trending 의 description_ko 만 백필한다.
    """
    parser = argparse.ArgumentParser(description="AITools 수동 수집/번역 백필")
    parser.add_argument(
        "--backfill-translations",
        action="store_true",
        help="title_ko 가 NULL 인 기존 뉴스를 한글 번역해 채운다(수집은 하지 않음).",
    )
    parser.add_argument(
        "--backfill-trends-translations",
        action="store_true",
        help=(
            "description_ko 가 NULL 인 github_trending 행을 한글 번역해 채운다"
            "(재수집 없음, 멱등). 120행 백필 시 --limit 200 권장."
        ),
    )
    parser.add_argument(
        "--discover-tools",
        action="store_true",
        help=(
            "Hacker News 'Show HN' 에서 신규 AI 도구를 발견해 tools 에 자동 추가한다"
            "(키 불필요, 멱등). 일일 수집과 분리된 주 1회 잡 — 일일 collect 에는 미포함."
        ),
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="번역 백필 1회 처리 최대 행수(뉴스 기본 50; 트렌드는 200 권장).",
    )
    args = parser.parse_args(argv)

    if not os.getenv("DATABASE_URL", "").strip():
        raise SystemExit(
            "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
            "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python collect.py"
        )

    if args.backfill_translations:
        from collectors import backfill_translations

        logger.info("=== 뉴스 번역 백필 시작 (limit=%d) ===", args.limit)
        n = backfill_translations(limit=args.limit)
        logger.info("=== 뉴스 번역 백필 완료: %d 건 ===", n)
        return 0

    if args.backfill_trends_translations:
        from collectors import backfill_trends_translations

        logger.info("=== 트렌드 번역 백필 시작 (limit=%d) ===", args.limit)
        n = backfill_trends_translations(limit=args.limit)
        logger.info("=== 트렌드 번역 백필 완료: %d 건 ===", n)
        return 0

    if args.discover_tools:
        from collectors import discover_tools
        from collectors.base import get_connection

        logger.info("=== 신규 도구 발견 시작 (Hacker News) ===")
        conn = get_connection()
        try:
            n = discover_tools(conn)
        finally:
            conn.close()
        logger.info("=== 신규 도구 발견 완료: 신규 %d 건 ===", n)
        return 0

    from collectors import collect_all

    logger.info("=== 수동 수집 시작 ===")
    total = collect_all()
    logger.info("=== 수동 수집 완료: 신규 %d 건 ===", total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
