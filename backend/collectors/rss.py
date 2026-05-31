"""RSS 수집기(키리스 — 토큰 불필요, 항상 활성).

공개 RSS/Atom 피드를 파싱해 각 도구의 최신 글을 news 로 적재한다.
이 소스가 "키 없이도 도는 최소 1개 소스" 요구를 충족한다.

피드 매핑
---------
FEEDS 는 (tool_name, feed_url) 목록이다. tool_name 은 tools 테이블의 name 과
느슨하게 매칭된다(base._resolve_tool_id). 매칭 안 되는 피드는 조용히 스킵된다.

멱등성
------
entry 의 link(고유 URL)를 source_url 로 쓰므로, base.upsert_news_item 의
source_url 중복검사로 재실행 시 중복이 생기지 않는다.

오프라인 단위검증
-----------------
parse_entries(raw_entries, tool_name) 는 네트워크 없이 dict 리스트만 받아
NewsItem 리스트를 만든다 — 파싱 로직을 단독 테스트할 수 있다.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from .base import NewsItem, http_get, upsert_news_batch

logger = logging.getLogger(__name__)

# (tools.name 과 매칭될 이름, 공개 피드 URL).
# 공식 블로그/뉴스 피드 위주. 매칭 실패 피드는 조용히 skip 되므로 추가는 안전하다.
FEEDS = [
    ("OpenAI", "https://openai.com/blog/rss.xml"),
    ("ChatGPT", "https://openai.com/blog/rss.xml"),
    ("GitHub Copilot", "https://github.blog/feed/"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("Stability AI", "https://stability.ai/news?format=rss"),
]

# 피드당 가져올 최신 항목 수(레이트/노이즈 제한).
MAX_ENTRIES_PER_FEED = 5


def _parse_date(entry) -> datetime:
    """feedparser entry 에서 발행일(struct_time)을 datetime 으로 변환. 실패 시 None."""
    import time as _time

    for attr in ("published_parsed", "updated_parsed"):
        st = entry.get(attr) if isinstance(entry, dict) else getattr(entry, attr, None)
        if st:
            try:
                return datetime.fromtimestamp(_time.mktime(st))
            except Exception:
                continue
    return None


def parse_entries(raw_entries, tool_name: str) -> List[NewsItem]:
    """feedparser entries(또는 dict 리스트)를 NewsItem 리스트로 변환한다.

    네트워크/feedparser 의존 없이 호출 가능하도록 dict 기반 접근만 쓴다
    (feedparser entry 는 dict 처럼 .get 을 지원).
    """
    items: List[NewsItem] = []
    for entry in raw_entries[:MAX_ENTRIES_PER_FEED]:
        get = entry.get if isinstance(entry, dict) else (lambda k, d=None: getattr(entry, k, d))
        title = (get("title") or "").strip()
        if not title:
            continue
        link = get("link") or None
        summary = get("summary") or get("description") or None
        items.append(
            NewsItem(
                tool_name=tool_name,
                title=title,
                content=summary,
                news_date=_parse_date(entry),
                source_url=link,
            )
        )
    return items


def _fetch_feed(feed_url: str):
    """feed_url 을 가져와 feedparser 로 파싱. 실패 시 빈 리스트.

    feedparser 가 직접 URL 을 열 수도 있으나, 타임아웃/재시도/UA 제어를 위해
    base.http_get 으로 바이트를 받은 뒤 파싱한다.
    """
    try:
        import feedparser
    except Exception:
        logger.error("feedparser 미설치 — RSS 수집 skip.")
        return []

    resp = http_get(feed_url)
    if resp is None:
        return []
    try:
        parsed = feedparser.parse(resp.content)
        return parsed.entries or []
    except Exception as e:
        logger.warning("RSS 파싱 실패 %s: %s", feed_url, e)
        return []


def collect(conn) -> int:
    """모든 피드를 순회 수집해 news 로 멱등 적재. 신규 삽입 행수 반환.

    피드 단위로 try/except 격리 — 한 피드 실패가 나머지를 막지 않는다.
    """
    all_items: List[NewsItem] = []
    for tool_name, feed_url in FEEDS:
        try:
            entries = _fetch_feed(feed_url)
            items = parse_entries(entries, tool_name)
            logger.info("[rss] %s: %d 항목 파싱", tool_name, len(items))
            all_items.extend(items)
        except Exception:
            logger.exception("[rss] 피드 실패(skip): %s", feed_url)

    if not all_items:
        return 0
    return upsert_news_batch(conn, all_items, source_label="rss")
