"""수집 공통 유틸 — DB 연결, news 멱등 upsert, HTTP 호출(타임아웃/재시도), 도구 매칭.

이 모듈은 외부 의존(psycopg2/requests)을 함수 내부에서 lazy import 한다.
그래야 import 단계에서 패키지가 없어도(예: 오프라인 단위검증) 깨지지 않는다.

news 스키마(정본: backend/schema.sql)
  id, tool_id(FK tools.id, NOT NULL), title(NOT NULL), content,
  news_date(TIMESTAMP), source_url(VARCHAR 500), collected_date(DEFAULT now())

멱등성의 근거
  news 테이블에는 UNIQUE 제약이 없으므로, 삽입 전에 source_url 존재 여부를
  SELECT 로 확인한다(source_url 이 없는 항목은 (tool_id, title) 로 확인).
  → 같은 항목을 여러 번 수집해도 행이 1개만 남는다.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# 외부 HTTP 호출 기본값(작업 요구: 타임아웃·재시도·레이트리밋).
HTTP_TIMEOUT_SECONDS = 10
HTTP_RETRIES = 3
HTTP_RETRY_BACKOFF = 2  # 초; 시도마다 backoff * attempt 만큼 대기
USER_AGENT = "AITools-DataCollector/1.0 (+https://github.com/ybkim202)"

# title 은 NOT NULL. source_url 은 500자 제한이라 방어적으로 자른다.
TITLE_MAX = 500
SOURCE_URL_MAX = 500


@dataclass
class NewsItem:
    """한 건의 뉴스. collector 가 만들어 upsert_news_item 에 넘긴다.

    tool_name 으로 tools 테이블을 매칭해 tool_id 를 채운다(매칭 실패 시 skip).
    """

    tool_name: str
    title: str
    content: Optional[str] = None
    news_date: Optional[datetime] = None
    source_url: Optional[str] = None


# ==================== DB ====================
def get_connection():
    """DATABASE_URL 로 psycopg2 연결을 연다.

    Raises:
        RuntimeError: DATABASE_URL 미설정(비밀정보는 환경변수로만 주입, 헌법 G9).
    """
    import psycopg2

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError(
            "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
            "수집은 DATABASE_URL 로만 DB 에 접속합니다(비밀정보 하드코딩 금지)."
        )
    return psycopg2.connect(database_url)


def _build_tool_index(cursor) -> dict:
    """tools 테이블의 name → id 매핑(소문자 키)을 만든다.

    뉴스의 tool_name 을 느슨하게(대소문자 무시) 매칭하기 위함.
    """
    cursor.execute("SELECT id, name FROM tools")
    return {name.lower(): tid for tid, name in cursor.fetchall()}


def _resolve_tool_id(tool_index: dict, tool_name: str):
    """tool_name 을 tool_id 로 변환한다(완전일치 우선, 없으면 부분포함).

    완전일치가 없으면 인덱스 키가 tool_name 에 포함되거나 그 반대인 첫 항목을 쓴다
    (예: 'OpenAI ChatGPT' → 'chatgpt'). 매칭 실패 시 None.
    """
    key = tool_name.strip().lower()
    if key in tool_index:
        return tool_index[key]
    for name_key, tid in tool_index.items():
        if name_key in key or key in name_key:
            return tid
    return None


def upsert_news_item(cursor, item: NewsItem, tool_index: dict) -> bool:
    """news 한 건을 멱등 삽입한다. 신규 삽입이면 True, skip 이면 False.

    멱등 규칙:
      - source_url 이 있으면 동일 source_url 존재 시 skip.
      - source_url 이 없으면 (tool_id, title) 중복 시 skip.

    한 건 실패가 잡 전체를 막지 않도록, 호출측에서 항목 루프를 try/except 로 감싼다.
    여기서는 SQL 만 수행하고 예외는 그대로 올린다(트랜잭션 일관성).
    """
    tool_id = _resolve_tool_id(tool_index, item.tool_name)
    if tool_id is None:
        logger.debug("tools 에서 매칭 실패라 skip: tool_name=%s", item.tool_name)
        return False

    title = (item.title or "").strip()
    if not title:
        logger.debug("title 이 비어 skip: tool=%s", item.tool_name)
        return False
    title = title[:TITLE_MAX]

    source_url = item.source_url[:SOURCE_URL_MAX] if item.source_url else None

    # 멱등 중복 확인.
    if source_url:
        cursor.execute("SELECT 1 FROM news WHERE source_url = %s LIMIT 1", (source_url,))
    else:
        cursor.execute(
            "SELECT 1 FROM news WHERE tool_id = %s AND title = %s LIMIT 1",
            (tool_id, title),
        )
    if cursor.fetchone() is not None:
        return False

    # 한글 번역(무료 MyMemory, 키 불필요). 네트워크/쿼터 실패 시 (None, None)
    # 이므로 원문만 NULL 한글로 저장된다(원문 title/content 는 항상 유지). 번역
    # 모듈이 예외를 흡수하지만, 방어적으로 한 번 더 격리해 번역 실패가 삽입을 막지
    # 않게 한다.
    title_ko = None
    summary_ko = None
    try:
        from .translate import translate_to_korean

        title_ko, summary_ko = translate_to_korean(title, item.content)
    except Exception as e:
        logger.warning("번역 단계 예외(원문만 저장): %s", e)

    cursor.execute(
        "INSERT INTO news (tool_id, title, content, news_date, source_url, "
        "title_ko, summary_ko) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (tool_id, title, item.content, item.news_date, source_url, title_ko, summary_ko),
    )
    return True


def upsert_news_batch(conn, items: list, source_label: str) -> int:
    """NewsItem 리스트를 멱등 upsert 하고 신규 삽입 행수를 반환한다.

    항목별로 try/except 로 격리해 한 건 실패가 배치 전체를 죽이지 않게 한다.
    배치 전체를 한 트랜잭션으로 commit(부분 항목 실패는 savepoint 로 롤백).
    """
    cursor = conn.cursor()
    inserted = 0
    skipped = 0
    failed = 0
    try:
        tool_index = _build_tool_index(cursor)
        for item in items:
            # 항목별 savepoint 로 격리: 한 건 실패해도 나머지는 진행.
            cursor.execute("SAVEPOINT item_sp")
            try:
                if upsert_news_item(cursor, item, tool_index):
                    inserted += 1
                else:
                    skipped += 1
                cursor.execute("RELEASE SAVEPOINT item_sp")
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT item_sp")
                failed += 1
                logger.warning("[%s] 항목 삽입 실패(skip): %s", source_label, e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[%s] 배치 upsert 실패, 롤백", source_label)
        raise
    finally:
        cursor.close()
    logger.info(
        "[%s] 신규 %d / 스킵 %d / 실패 %d", source_label, inserted, skipped, failed
    )
    return inserted


# ==================== HTTP ====================
def http_get(url: str, headers: dict = None, params: dict = None):
    """GET 요청(타임아웃 + 단순 지수백오프 재시도). 실패 시 None 반환.

    requests 가 없거나 모든 재시도가 실패하면 None 을 돌려준다
    (호출측이 소스 단위로 skip 하도록).
    """
    try:
        import requests
    except Exception:
        logger.error("requests 미설치 — HTTP 수집을 건너뜁니다.")
        return None

    base_headers = {"User-Agent": USER_AGENT}
    if headers:
        base_headers.update(headers)

    for attempt in range(1, HTTP_RETRIES + 1):
        try:
            resp = requests.get(
                url, headers=base_headers, params=params, timeout=HTTP_TIMEOUT_SECONDS
            )
            resp.raise_for_status()
            return resp
        except Exception as e:
            wait = HTTP_RETRY_BACKOFF * attempt
            logger.warning(
                "GET 실패(%d/%d) %s: %s — %ds 후 재시도",
                attempt,
                HTTP_RETRIES,
                url,
                e,
                wait,
            )
            if attempt < HTTP_RETRIES:
                time.sleep(wait)
    logger.error("GET 최종 실패(재시도 소진): %s", url)
    return None


def http_post(url: str, json_body: dict, headers: dict = None):
    """POST 요청(타임아웃 + 재시도). 실패 시 None."""
    try:
        import requests
    except Exception:
        logger.error("requests 미설치 — HTTP 수집을 건너뜁니다.")
        return None

    base_headers = {"User-Agent": USER_AGENT}
    if headers:
        base_headers.update(headers)

    for attempt in range(1, HTTP_RETRIES + 1):
        try:
            resp = requests.post(
                url, json=json_body, headers=base_headers, timeout=HTTP_TIMEOUT_SECONDS
            )
            resp.raise_for_status()
            return resp
        except Exception as e:
            wait = HTTP_RETRY_BACKOFF * attempt
            logger.warning("POST 실패(%d/%d) %s: %s", attempt, HTTP_RETRIES, url, e)
            if attempt < HTTP_RETRIES:
                time.sleep(wait)
    logger.error("POST 최종 실패: %s", url)
    return None


# ==================== 오케스트레이션 ====================
def _load_collectors() -> list:
    """활성/구성된 collector 모듈을 (이름, collect함수) 로 모은다.

    각 collector 의 collect(conn) 는 신규 삽입 행수를 반환한다.
    토큰 미설정 소스는 collect 내부에서 0 을 반환하며 조용히 skip 한다.
    """
    from . import rss, github, producthunt, github_trending

    return [
        ("rss", rss.collect),
        ("github", github.collect),
        ("producthunt", producthunt.collect),
        # github_trending 은 news 가 아니라 독립 github_trending 테이블을 멱등 교체한다.
        ("github_trending", github_trending.collect),
    ]


# 관측용: 구성된 소스 이름(스케줄러 로깅에 사용). lazy 하게 채워진다.
ACTIVE_COLLECTORS = ["rss", "github", "producthunt", "github_trending"]


def collect_all(conn=None) -> int:
    """모든 구성된 소스를 순회 수집한다. 소스 단위 에러 격리. 총 신규 행수 반환.

    Args:
        conn: 재사용할 psycopg2 연결. None 이면 내부에서 열고 닫는다.
    """
    own_conn = conn is None
    if own_conn:
        conn = get_connection()

    total = 0
    try:
        for name, collect_fn in _load_collectors():
            try:
                logger.info("수집 시작: 소스=%s", name)
                n = collect_fn(conn)
                total += n or 0
                logger.info("수집 완료: 소스=%s, 신규=%d", name, n or 0)
            except Exception:
                # 한 소스 실패가 전체 잡을 죽이지 않게 격리.
                logger.exception("소스 수집 실패(다음 소스로 진행): %s", name)
                # 소스가 트랜잭션을 깨고 나간 경우를 대비해 rollback.
                try:
                    conn.rollback()
                except Exception:
                    pass
    finally:
        if own_conn:
            conn.close()

    logger.info("전체 수집 종료: 총 신규 %d 건", total)
    return total


# ==================== 번역 백필 ====================
def backfill_translations(conn=None, limit: int = 50) -> int:
    """title_ko 가 NULL 인 기존 뉴스를 번역해 UPDATE 한다. 번역한 행수 반환.

    멱등: title_ko IS NULL 행만 대상으로 하므로 이미 번역된 건은 skip.
    재실행하면 아직 미번역인 다음 limit 건을 이어서 처리한다.

    번역은 무료 MyMemory API(키 불필요)를 쓴다. 네트워크/쿼터 실패 행은 번역되지
    않은 채(title_ko NULL) 남아 다음 실행에서 재시도된다(원문은 항상 유지).
    requests 미설치 시 0 을 반환하고 조용히 종료(에러 아님).
    항목별 try/except 로 격리 — 한 건 실패가 전체 백필을 막지 않는다.

    MyMemory 무료 한도(익명 ~5,000 단어/일)를 한 번에 초과하지 않게 limit 로
    처리량을 제한하고, 항목 사이에 짧은 sleep 으로 호출 폭주를 완화한다
    (MYMEMORY_EMAIL 설정 시 ~50,000 단어/일로 한도 확대).

    Args:
        conn: 재사용할 psycopg2 연결. None 이면 내부에서 열고 닫는다.
        limit: 한 번에 처리할 최대 행수(호출 폭주 방지).
    """
    from .translate import is_enabled, translate_to_korean

    if not is_enabled():
        logger.info("requests 미설치 — 번역 백필 건너뜀(원문 유지).")
        return 0

    # 항목 사이 가벼운 간격(초). 무료 API 레이트 완화용(과설계 금지, 단순하게).
    item_sleep = 0.5

    own_conn = conn is None
    if own_conn:
        conn = get_connection()

    updated = 0
    try:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, title, content FROM news "
                "WHERE title_ko IS NULL "
                "ORDER BY collected_date DESC LIMIT %s",
                (limit,),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()

        logger.info("번역 백필 대상: %d 건(limit=%d)", len(rows), limit)

        for news_id, title, content in rows:
            cursor = conn.cursor()
            try:
                title_ko, summary_ko = translate_to_korean(title, content)
                if title_ko is None and summary_ko is None:
                    # 번역 실패(네트워크/쿼터 일시오류 등) — 이 행은 다음 실행에서 재시도.
                    conn.rollback()
                    continue
                cursor.execute(
                    "UPDATE news SET title_ko = %s, summary_ko = %s WHERE id = %s",
                    (title_ko, summary_ko, news_id),
                )
                conn.commit()
                updated += 1
            except Exception as e:
                conn.rollback()
                logger.warning("번역 백필 항목 실패(skip) id=%s: %s", news_id, e)
            finally:
                cursor.close()
            # 무료 API 레이트 완화: 항목 사이 짧은 간격.
            time.sleep(item_sleep)
    finally:
        if own_conn:
            conn.close()

    logger.info("번역 백필 완료: %d 건 업데이트", updated)
    return updated
