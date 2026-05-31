"""GitHub 수집기(토큰 선택 — 없어도 공개 API 로 동작).

각 도구의 오픈소스 리포에서 최신 릴리스를 가져와 "업데이트 뉴스"로 적재한다.

토큰 규칙
---------
- GITHUB_TOKEN 이 있으면 Authorization 헤더로 인증(레이트 5,000/h).
- 없으면 무토큰 공개 호출(레이트 60/h) — 에러가 아니라 정상 동작.
토큰은 환경변수로만 읽고 로그에 남기지 않는다(헌법 G9).

엔드포인트
----------
GET https://api.github.com/repos/{owner}/{repo}/releases?per_page=N (공개)

멱등성
------
릴리스의 html_url 을 source_url 로 쓰므로 source_url 중복검사로 멱등.

오프라인 단위검증
-----------------
parse_releases(raw, tool_name, repo) 는 release dict 리스트만 받아 NewsItem 을 만든다.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import List

from .base import NewsItem, http_get, upsert_news_batch

logger = logging.getLogger(__name__)

# (tools.name 매칭용 이름, "owner/repo").
REPOS = [
    ("Hugging Face", "huggingface/transformers"),
    ("LangChain", "langchain-ai/langchain"),
    ("Ollama", "ollama/ollama"),
    ("Stable Diffusion", "Stability-AI/generative-models"),
    ("AutoGPT", "Significant-Gravitas/AutoGPT"),
]

MAX_RELEASES_PER_REPO = 3
GITHUB_API = "https://api.github.com"


def _auth_headers() -> dict:
    """GITHUB_TOKEN 이 있으면 인증 헤더를 만든다(없으면 빈 dict).

    토큰 값 자체는 어디에도 로깅하지 않는다.
    """
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_date(value: str):
    """ISO8601(예: 2024-01-02T03:04:05Z) → datetime. 실패 시 None."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_releases(raw_releases, tool_name: str, repo: str) -> List[NewsItem]:
    """GitHub releases JSON 리스트를 NewsItem 리스트로 변환한다."""
    items: List[NewsItem] = []
    if not isinstance(raw_releases, list):
        return items
    for rel in raw_releases[:MAX_RELEASES_PER_REPO]:
        if not isinstance(rel, dict):
            continue
        name = (rel.get("name") or rel.get("tag_name") or "").strip()
        if not name:
            continue
        title = f"{repo} 릴리스: {name}"
        body = rel.get("body") or None
        if body and len(body) > 2000:
            body = body[:2000]
        items.append(
            NewsItem(
                tool_name=tool_name,
                title=title,
                content=body,
                news_date=_parse_date(rel.get("published_at") or rel.get("created_at")),
                source_url=rel.get("html_url"),
            )
        )
    return items


def collect(conn) -> int:
    """모든 REPOS 의 최신 릴리스를 수집해 news 로 멱등 적재. 신규 행수 반환."""
    headers = _auth_headers()
    authed = "Authorization" in headers
    logger.info("[github] 수집 시작(인증=%s)", authed)

    all_items: List[NewsItem] = []
    for tool_name, repo in REPOS:
        try:
            url = f"{GITHUB_API}/repos/{repo}/releases"
            resp = http_get(url, headers=headers, params={"per_page": MAX_RELEASES_PER_REPO})
            if resp is None:
                continue
            items = parse_releases(resp.json(), tool_name, repo)
            logger.info("[github] %s: %d 릴리스", repo, len(items))
            all_items.extend(items)
        except Exception:
            logger.exception("[github] 리포 실패(skip): %s", repo)

    if not all_items:
        return 0
    return upsert_news_batch(conn, all_items, source_label="github")
