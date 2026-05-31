"""Product Hunt 수집기(토큰 필요 — 없으면 조용히 skip).

Product Hunt GraphQL API 로 트렌딩 AI 도구 게시물을 가져와 news 로 적재한다.

토큰 규칙(핵심)
---------------
- PRODUCT_HUNT_TOKEN 이 없으면 collect 는 0 을 반환하고 조용히 종료한다(에러 아님).
  → 키 미설정 환경(머지/배포 직후, 로컬)에서도 잡이 깨지지 않는다.
- 토큰은 환경변수로만 읽고 로그에 남기지 않는다(헌법 G9).

엔드포인트
----------
POST https://api.producthunt.com/v2/api/graphql  (Bearer 토큰)

멱등성
------
게시물 url 을 source_url 로 쓰므로 source_url 중복검사로 멱등.

오프라인 단위검증
-----------------
parse_posts(edges) 는 GraphQL edges 리스트만 받아 NewsItem 을 만든다.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import List

from .base import NewsItem, http_post, upsert_news_batch

logger = logging.getLogger(__name__)

PH_ENDPOINT = "https://api.producthunt.com/v2/api/graphql"
MAX_POSTS = 20

# AI 토픽의 트렌딩 게시물. topic slug 'artificial-intelligence'.
_QUERY = """
{
  posts(first: %d, topic: "artificial-intelligence", order: VOTES) {
    edges {
      node {
        name
        tagline
        url
        createdAt
      }
    }
  }
}
""" % MAX_POSTS


def _parse_date(value: str):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_posts(edges) -> List[NewsItem]:
    """GraphQL posts.edges 를 NewsItem 리스트로 변환한다.

    tool_name 은 게시물 name 으로 두어, tools 에 같은 이름이 있을 때만 매칭된다
    (없으면 base 의 upsert 에서 조용히 skip).
    """
    items: List[NewsItem] = []
    if not isinstance(edges, list):
        return items
    for edge in edges:
        node = edge.get("node") if isinstance(edge, dict) else None
        if not isinstance(node, dict):
            continue
        name = (node.get("name") or "").strip()
        if not name:
            continue
        tagline = node.get("tagline") or ""
        items.append(
            NewsItem(
                tool_name=name,
                title=f"Product Hunt 트렌딩: {name}",
                content=tagline or None,
                news_date=_parse_date(node.get("createdAt")),
                source_url=node.get("url"),
            )
        )
    return items


def collect(conn) -> int:
    """Product Hunt 트렌딩 AI 게시물을 수집한다. 토큰 없으면 0 으로 조용히 skip."""
    token = os.getenv("PRODUCT_HUNT_TOKEN", "").strip()
    if not token:
        logger.info("[producthunt] PRODUCT_HUNT_TOKEN 미설정 — 소스 skip(정상).")
        return 0

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    resp = http_post(PH_ENDPOINT, json_body={"query": _QUERY}, headers=headers)
    if resp is None:
        logger.warning("[producthunt] API 호출 실패 — skip.")
        return 0

    try:
        payload = resp.json()
        edges = payload["data"]["posts"]["edges"]
    except Exception as e:
        logger.warning("[producthunt] 응답 파싱 실패: %s", e)
        return 0

    items = parse_posts(edges)
    logger.info("[producthunt] %d 게시물 파싱", len(items))
    if not items:
        return 0
    return upsert_news_batch(conn, items, source_label="producthunt")
