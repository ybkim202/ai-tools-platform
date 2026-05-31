"""APScheduler 기반 자동 수집 스케줄러 — main.py 라이프사이클에서 가드로 호출.

기본 비활성(중요)
------------------
이 모듈의 start_scheduler() 는 ENABLE_SCHEDULER 가 'true' 일 때만 실제로 잡을 띄운다.
미설정/false 면 아무 일도 하지 않고 None 을 반환한다.
→ 머지/배포만으로 prod 에서 갑자기 외부 API 호출·DB 쓰기가 시작되지 않는다.

멀티워커 중복 방지(중요 — 한계 명시)
------------------------------------
gunicorn 다중 워커에서 각 워커가 스케줄러를 띄우면 잡이 워커 수만큼 중복 실행된다.
이를 막기 위해 두 단계 가드를 둔다:
  1) ENABLE_SCHEDULER=true 인 환경에서만 동작.
  2) SCHEDULER_WORKER=true 인 단일 프로세스에서만 동작(미설정이면 비활성).
권장 운영: 웹 워커는 SCHEDULER_WORKER 미설정으로 두고, 수집 전용 1프로세스
(예: 워커 1개짜리 별도 서비스 또는 cron 잡)에만 SCHEDULER_WORKER=true 를 준다.
또는 스케줄러 없이 collect.py 를 외부 cron 으로 돌리는 방식을 권장(아래 README 참조).
멱등 upsert 가 있으므로 만에 하나 중복 실행돼도 데이터는 손상되지 않는다(중복 적재 없음).

주기
----
COLLECT_INTERVAL_HOURS(기본 24) 시간마다 collect_all 을 실행한다.
다음 실행 시각을 로깅해 관측 가능하게 한다.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_HOURS = 24

# 단일 전역 핸들(중복 start 방지 + shutdown 참조).
_scheduler = None


def _enabled() -> bool:
    """ENABLE_SCHEDULER 가드. 'true'(대소문자 무시)일 때만 True."""
    return os.getenv("ENABLE_SCHEDULER", "").strip().lower() == "true"


def _is_scheduler_worker() -> bool:
    """멀티워커 중복 방지 가드. SCHEDULER_WORKER='true' 인 프로세스만 True."""
    return os.getenv("SCHEDULER_WORKER", "").strip().lower() == "true"


def _interval_hours() -> int:
    """COLLECT_INTERVAL_HOURS 환경변수(정수). 잘못된 값이면 기본값."""
    raw = os.getenv("COLLECT_INTERVAL_HOURS", "").strip()
    if not raw:
        return DEFAULT_INTERVAL_HOURS
    try:
        h = int(raw)
        return h if h > 0 else DEFAULT_INTERVAL_HOURS
    except ValueError:
        logger.warning("COLLECT_INTERVAL_HOURS 파싱 실패(%r) — 기본 %dh 사용", raw, DEFAULT_INTERVAL_HOURS)
        return DEFAULT_INTERVAL_HOURS


def _run_collection_job() -> None:
    """스케줄 잡 본체 — 전체 소스 수집을 에러 격리해 실행한다.

    잡 전체가 예외로 죽어 스케줄러가 멈추지 않도록 최상위 try/except 로 감싼다.
    """
    logger.info("[scheduler] 수집 잡 시작")
    try:
        from collectors import collect_all

        total = collect_all()
        logger.info("[scheduler] 수집 잡 완료: 신규 %d 건", total)
    except Exception:
        logger.exception("[scheduler] 수집 잡 실패(다음 주기에 재시도)")


def start_scheduler():
    """가드를 통과하면 BackgroundScheduler 를 시작하고 핸들을 반환한다.

    가드 불충족(기본)이면 None 을 반환하고 앱은 스케줄러 없이 정상 기동한다.
    """
    global _scheduler

    if not _enabled():
        logger.info("[scheduler] ENABLE_SCHEDULER 미설정 — 스케줄러 비활성(정상).")
        return None
    if not _is_scheduler_worker():
        logger.info(
            "[scheduler] SCHEDULER_WORKER 미설정 — 이 프로세스에서는 스케줄러를 띄우지 않음 "
            "(멀티워커 중복 방지)."
        )
        return None
    if _scheduler is not None:
        logger.info("[scheduler] 이미 실행 중 — 재시작 생략.")
        return _scheduler

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except Exception:
        logger.exception("[scheduler] apscheduler 미설치 — 스케줄러 비활성.")
        return None

    interval = _interval_hours()
    scheduler = BackgroundScheduler(timezone="UTC")
    # coalesce + max_instances=1: 밀린 실행을 합치고 동시 중복 실행을 막는다.
    scheduler.add_job(
        _run_collection_job,
        trigger="interval",
        hours=interval,
        id="collect_news",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler

    job = scheduler.get_job("collect_news")
    next_run = getattr(job, "next_run_time", None)
    logger.info(
        "[scheduler] 시작됨. 주기=%dh, 다음 실행=%s (UTC)", interval, next_run
    )
    return scheduler


def shutdown_scheduler() -> None:
    """스케줄러를 안전하게 종료한다(없으면 무동작)."""
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
        logger.info("[scheduler] 종료됨.")
    except Exception:
        logger.exception("[scheduler] 종료 중 오류")
    finally:
        _scheduler = None
