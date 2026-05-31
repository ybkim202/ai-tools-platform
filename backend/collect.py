"""수동 1회 수집 진입점 — 스케줄러 없이 모든 활성 소스를 즉시 수집한다.

용도: 초기 적재(빈 news 테이블 채우기), 테스트, 외부 cron 운영.

실행 방법
---------
    cd backend
    DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB' python collect.py

선택 환경변수(없으면 해당 소스만 비활성, 잡은 정상)
  - GITHUB_TOKEN        : GitHub 인증 호출(없으면 무토큰 공개 호출)
  - PRODUCT_HUNT_TOKEN  : Product Hunt 활성(없으면 조용히 skip)

이 스크립트는 ENABLE_SCHEDULER/SCHEDULER_WORKER 와 무관하게 항상 1회 실행한다
(스케줄러 가드는 자동 주기 실행에만 적용된다).

멱등성
------
모든 삽입은 source_url(또는 tool_id+title) 중복검사를 거치므로 여러 번 실행해도
중복 행이 생기지 않는다.
"""

from __future__ import annotations

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


def main() -> int:
    """전체 소스를 1회 수집한다. 반환값은 프로세스 종료코드(0=성공)."""
    if not os.getenv("DATABASE_URL", "").strip():
        raise SystemExit(
            "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
            "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python collect.py"
        )

    from collectors import collect_all

    logger.info("=== 수동 수집 시작 ===")
    total = collect_all()
    logger.info("=== 수동 수집 완료: 신규 %d 건 ===", total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
