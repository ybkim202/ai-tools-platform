"""GitHub 트렌딩 레포 수집기 — github_trending 테이블을 period 별로 멱등 교체한다.

이 수집기는 news 와 무관한 독립 테이블(github_trending)을 채운다. 따라서 base.py 의
news upsert 헬퍼가 아니라 자체 SQL 로 적재하되, HTTP(http_get)·번역(translate)은 재사용한다.

트렌딩 정의(v1)
----------------
"최근 생성(weekly=7일 / monthly=30일 내 created) + 별점순". GitHub Search API 로
여러 AI 토픽을 질의·병합·중복제거(repo_full_name 기준)한 뒤 별점 내림차순 상위 N개를 적재한다.
velocity(별점 증가율)는 v2 로 미루고 미구현.

토큰(선택)
----------
GITHUB_TOKEN 이 있으면 Authorization 헤더로 인증해 Search 레이트가 10→30/min 으로 오른다.
없어도 동작한다(무인증 공개 호출). 토큰 값은 로그에 남기지 않는다(헌법 G9).

별점 임계값(env 오버라이드 가능)
--------------------------------
- weekly:  GITHUB_TRENDING_MIN_STARS_WEEKLY  (기본 10)
- monthly: GITHUB_TRENDING_MIN_STARS_MONTHLY (기본 50)

멱등 교체
---------
수집 성공 시 해당 period 의 기존 행을 모두 DELETE 한 뒤 새 결과를 INSERT 한다
(단일 트랜잭션). 부분 실패(번역 등)는 항목 단위로 격리한다. 한 period 실패가 다른
period 를 막지 않는다.

오프라인 단위검증
-----------------
parse_search_items(raw, period) 는 GitHub Search 응답의 items 리스트만 받아
직렬화 가능한 dict 리스트로 변환한다(네트워크/DB 불필요).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from .base import http_get

logger = logging.getLogger(__name__)

GITHUB_SEARCH_API = "https://api.github.com/search/repositories"

# 질의할 AI 관련 토픽들. 각 토픽으로 검색 후 repo_full_name 기준 병합/중복제거.
AI_TOPICS = [
    "ai",
    "llm",
    "machine-learning",
    "generative-ai",
    "agents",
    "rag",
    "stable-diffusion",
    "deep-learning",
]

# period 별 created 윈도우(일).
PERIOD_DAYS = {"weekly": 7, "monthly": 30}

# period 별 적재 상위 개수.
TOP_N = 60

# Search API per_page 상한(GitHub 최대 100). 토픽별로 충분히 모아 병합.
PER_PAGE = 50

# 문자열 컬럼 길이 방어(스키마 제한).
_REPO_FULL_NAME_MAX = 255
_VARCHAR_MAX = 255
_URL_MAX = 500
_LANG_MAX = 100


def _auth_headers() -> dict:
    """GITHUB_TOKEN 이 있으면 인증 헤더를 만든다(없으면 Accept 만).

    토큰 값 자체는 어디에도 로깅하지 않는다(헌법 G9).
    """
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _min_stars(period: str) -> int:
    """period 별 별점 임계값(env 오버라이드 가능). 잘못된 값이면 기본값."""
    if period == "weekly":
        raw = os.getenv("GITHUB_TRENDING_MIN_STARS_WEEKLY", "").strip()
        default = 10
    else:
        raw = os.getenv("GITHUB_TRENDING_MIN_STARS_MONTHLY", "").strip()
        default = 50
    if not raw:
        return default
    try:
        v = int(raw)
        return v if v >= 0 else default
    except ValueError:
        logger.warning("별점 임계값 파싱 실패(%r) — 기본 %d 사용", raw, default)
        return default


def _created_since(period: str) -> str:
    """period 윈도우의 created 하한 날짜(YYYY-MM-DD, UTC)."""
    days = PERIOD_DAYS.get(period, 7)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return since.strftime("%Y-%m-%d")


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """ISO8601(예: 2024-01-02T03:04:05Z) → datetime. 실패 시 None."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_search_items(items, period: str) -> List[Dict]:
    """GitHub Search 응답 items 리스트를 직렬화 dict 리스트로 변환한다.

    네트워크/DB 와 무관(단위검증 가능). 별점 순위/번역은 여기서 하지 않는다.

    Args:
        items: search items(dict 리스트). 비리스트면 빈 결과.
        period: 'weekly' | 'monthly'(반환 dict 에 포함).

    Returns:
        repo dict 리스트(repo_full_name 으로 호출측이 병합/중복제거).
    """
    parsed: List[Dict] = []
    if not isinstance(items, list):
        return parsed
    for it in items:
        if not isinstance(it, dict):
            continue
        full_name = (it.get("full_name") or "").strip()
        if not full_name:
            continue
        owner_obj = it.get("owner") or {}
        topics = it.get("topics")
        if not isinstance(topics, list):
            topics = []
        parsed.append(
            {
                "repo_full_name": full_name[:_REPO_FULL_NAME_MAX],
                "owner": (owner_obj.get("login") or "")[:_VARCHAR_MAX] or None,
                "repo": (it.get("name") or "")[:_VARCHAR_MAX] or None,
                "name": (it.get("name") or "")[:_VARCHAR_MAX] or None,
                "description": it.get("description") or None,
                "html_url": (it.get("html_url") or "")[:_URL_MAX] or None,
                "avatar_url": (owner_obj.get("avatar_url") or "")[:_URL_MAX] or None,
                "stars": int(it.get("stargazers_count") or 0),
                "forks": int(it.get("forks_count") or 0),
                "language": (it.get("language") or "")[:_LANG_MAX] or None,
                "topics": [str(t) for t in topics],
                "repo_created_at": _parse_dt(it.get("created_at")),
                "period": period,
            }
        )
    return parsed


def _fetch_period(period: str, headers: dict) -> List[Dict]:
    """한 period 의 트렌딩 레포를 토픽별로 질의·병합·중복제거·정렬해 상위 N 반환.

    토픽 하나가 실패해도 다른 토픽으로 진행한다(에러 격리).
    """
    since = _created_since(period)
    min_stars = _min_stars(period)
    merged: Dict[str, Dict] = {}

    for topic in AI_TOPICS:
        # 문자열 포매팅이지만 q 는 SQL 이 아니라 GitHub Search 질의다.
        # topic 은 고정 화이트리스트(AI_TOPICS)라 외부 입력이 아니다.
        q = f"topic:{topic} created:>={since} stars:>={min_stars}"
        params = {"q": q, "sort": "stars", "order": "desc", "per_page": PER_PAGE}
        resp = http_get(GITHUB_SEARCH_API, headers=headers, params=params)
        if resp is None:
            logger.warning("[github_trending] %s topic=%s 검색 실패(skip)", period, topic)
            continue
        try:
            items = resp.json().get("items", [])
        except Exception:
            logger.warning("[github_trending] %s topic=%s 응답 파싱 실패(skip)", period, topic)
            continue
        for repo in parse_search_items(items, period):
            # 중복 제거: 같은 레포는 별점이 더 큰(=최신 집계) 쪽을 유지.
            existing = merged.get(repo["repo_full_name"])
            if existing is None or repo["stars"] > existing["stars"]:
                merged[repo["repo_full_name"]] = repo

    # 별점 내림차순 정렬 후 상위 N + rank 부여(1=최고).
    ranked = sorted(merged.values(), key=lambda r: r["stars"], reverse=True)[:TOP_N]
    for idx, repo in enumerate(ranked, start=1):
        repo["rank"] = idx
    return ranked


def _translate_repo(repo: Dict) -> None:
    """repo['description'] → description_ko 를 채운다(실패 시 None 유지).

    무료 MyMemory(키 불필요). 번역 실패가 적재를 막지 않도록 예외를 흡수한다.
    """
    repo["description_ko"] = None
    desc = repo.get("description")
    if not desc:
        return
    try:
        from .translate import translate_to_korean

        title_ko, _ = translate_to_korean(desc, None)
        repo["description_ko"] = title_ko
    except Exception as e:
        logger.warning("[github_trending] 번역 실패(원문 유지): %s", e)


def _replace_period(conn, period: str, repos: List[Dict]) -> int:
    """해당 period 의 기존 행을 새 repos 로 멱등 교체한다(단일 트랜잭션). 적재 행수 반환.

    모든 SQL 은 %s 파라미터 바인딩만 사용한다(f-string 값 삽입 금지, 헌법 G7).
    topics 는 JSONB 로 저장하기 위해 json.dumps 후 ::jsonb 캐스트한다.
    """
    import json

    cursor = conn.cursor()
    try:
        # period 단위 멱등 교체: 기존 행 제거 후 새 결과 삽입.
        cursor.execute("DELETE FROM github_trending WHERE period = %s", (period,))
        for repo in repos:
            cursor.execute(
                "INSERT INTO github_trending "
                "(repo_full_name, owner, repo, name, description, description_ko, "
                " html_url, avatar_url, stars, forks, language, topics, "
                " repo_created_at, period, rank) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)",
                (
                    repo["repo_full_name"],
                    repo.get("owner"),
                    repo.get("repo"),
                    repo.get("name"),
                    repo.get("description"),
                    repo.get("description_ko"),
                    repo.get("html_url"),
                    repo.get("avatar_url"),
                    repo.get("stars"),
                    repo.get("forks"),
                    repo.get("language"),
                    json.dumps(repo.get("topics") or []),
                    repo.get("repo_created_at"),
                    repo["period"],
                    repo.get("rank"),
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[github_trending] %s 교체 실패, 롤백", period)
        raise
    finally:
        cursor.close()
    return len(repos)


def collect(conn) -> int:
    """weekly/monthly 트렌딩을 수집해 github_trending 을 멱등 교체. 적재 총 행수 반환.

    period 단위 에러 격리: 한 period 실패가 다른 period 를 막지 않는다.
    base.collect_all 의 collector 시그니처(collect(conn) -> int)를 따른다.
    """
    headers = _auth_headers()
    authed = "Authorization" in headers
    logger.info("[github_trending] 수집 시작(인증=%s)", authed)

    total = 0
    for period in ("weekly", "monthly"):
        try:
            repos = _fetch_period(period, headers)
            if not repos:
                logger.info("[github_trending] %s: 결과 없음(교체 생략)", period)
                continue
            # 번역은 항목별로(실패 격리). 적재 직전에 description_ko 채움.
            for repo in repos:
                _translate_repo(repo)
            n = _replace_period(conn, period, repos)
            logger.info("[github_trending] %s: %d 행 교체 적재", period, n)
            total += n
        except Exception:
            logger.exception("[github_trending] %s 수집 실패(다음 period 진행)", period)
            try:
                conn.rollback()
            except Exception:
                pass

    logger.info("[github_trending] 수집 종료: 총 %d 행", total)
    return total
