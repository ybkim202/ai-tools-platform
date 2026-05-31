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
- weekly:  GITHUB_TRENDING_MIN_STARS_WEEKLY  (기본 25)
- monthly: GITHUB_TRENDING_MIN_STARS_MONTHLY (기본 100)

품질 필터(중간 강도 — 적재 전, parse 후 적용)
---------------------------------------------
1) 별점 임계값 상향(위 기본값).
2) 키워드 반복 스팸 제거(is_keyword_spam): 고유 토큰 비율이 매우 낮거나 단일 토큰
   과다 반복인 description 드롭.
3) 신호 없음 제거: description 과 topics 가 둘 다 비어있는 레포 드롭.
4) AI 관련성 요구(has_ai_relevance): topics 가 AI_TOPICS 또는 큐레이션 테마와 교집합
   0이면 드롭.
드롭한 개수·사유는 INFO 로 로깅한다(무음 절단 금지). 필터 후 별점순 rank 재부여.

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
import re
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

# AI 관련성 판정용 토픽 집합(소문자). AI_TOPICS 와 동일 출처.
_AI_TOPIC_SET = {t.lower() for t in AI_TOPICS}

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

# ==================== 품질 필터(중간 강도) 상수 ====================
# 사용자 확정 '중간 강도': 잡음(키워드 반복 스팸·무신호·비AI)을 확실히 줄이되
# 대부분의 의미 있는 레포는 유지한다. 기준은 상수로 빼서 조정 가능하게 한다.

# 별점 기본 임계값(상향). env(GITHUB_TRENDING_MIN_STARS_*) 오버라이드는 그대로 유지.
_DEFAULT_MIN_STARS_WEEKLY = 25
_DEFAULT_MIN_STARS_MONTHLY = 100

# 키워드 반복 스팸 판정 기준.
# - 토큰이 SPAM_MIN_TOKENS 개 이상일 때만 비율 검사를 적용(짧은 정상 설명 오판 방지).
# - 고유 토큰 비율(고유/전체)이 이 값 미만이면 스팸으로 본다.
# - 또는 단일 토큰이 SPAM_MAX_TOKEN_REPEAT 회 이상 반복되면 스팸.
_SPAM_MIN_TOKENS = 6
_SPAM_MIN_UNIQUE_RATIO = 0.45
_SPAM_MAX_TOKEN_REPEAT = 5

# 토큰화: 영문/숫자 연속을 한 토큰으로(소문자). 단위검증 가능한 순수 함수.
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    """설명 문자열을 소문자 영숫자 토큰 리스트로 쪼갠다(스팸 판정용, 순수 함수)."""
    if not text:
        return []
    return _TOKEN_RE.findall(text.lower())


def is_keyword_spam(description: Optional[str]) -> bool:
    """description 이 같은 토큰/구를 과도하게 반복하는 스팸인지 판정한다(순수 함수).

    네트워크/DB 불필요(오프라인 단위검증 가능). 판정 기준(중간 강도):
      - 토큰이 충분히 많을 때(>= _SPAM_MIN_TOKENS) 고유 토큰 비율이
        _SPAM_MIN_UNIQUE_RATIO 미만이면 스팸(예: 'polymarket bot' ×20).
      - 또는 단일 토큰이 _SPAM_MAX_TOKEN_REPEAT 회 이상 반복되면 스팸.

    Returns:
        스팸이면 True(드롭 대상). 빈/짧은 정상 설명은 False.
    """
    tokens = _tokenize(description or "")
    if len(tokens) < _SPAM_MIN_TOKENS:
        return False

    unique_ratio = len(set(tokens)) / len(tokens)
    if unique_ratio < _SPAM_MIN_UNIQUE_RATIO:
        return True

    # 단일 토큰 과다 반복(불용어 제외 없이 단순 카운트 — 중간 강도).
    counts: Dict[str, int] = {}
    for tok in tokens:
        counts[tok] = counts.get(tok, 0) + 1
        if counts[tok] >= _SPAM_MAX_TOKEN_REPEAT:
            return True
    return False


def has_ai_relevance(topics) -> bool:
    """레포 topics 가 AI_TOPICS 또는 큐레이션 테마(trends_themes)와 교집합이 있는지.

    topic: 으로 검색하므로 대개 충족하나, 교집합 0인 잡음 레포는 드롭한다.
    소문자 비교. topics 가 비었거나 비리스트면 False(신호 없음으로 별도 처리됨).
    """
    if not isinstance(topics, (list, tuple)) or not topics:
        return False
    lowered = {str(t).strip().lower() for t in topics if t}
    if lowered & _AI_TOPIC_SET:
        return True
    # 큐레이션 테마와의 교집합도 AI 관련성으로 인정(lazy import 로 순환참조 회피).
    try:
        from app.trends_themes import match_themes

        return bool(match_themes(list(lowered)))
    except Exception:
        # 테마 모듈 import 실패 시 AI_TOPICS 교집합 결과만으로 판단(보수적: False).
        return False


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
        default = _DEFAULT_MIN_STARS_WEEKLY
    else:
        raw = os.getenv("GITHUB_TRENDING_MIN_STARS_MONTHLY", "").strip()
        default = _DEFAULT_MIN_STARS_MONTHLY
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


def filter_repos(repos: List[Dict], period: str) -> List[Dict]:
    """중간 강도 품질 필터를 적용해 잡음 레포를 드롭한다(드롭 사유 INFO 로깅).

    네트워크/DB 불필요(parse 결과 dict 리스트만 받음 — 오프라인 단위검증 가능).
    별점 임계값은 _fetch_period 의 검색 질의에서 이미 적용되므로 여기서는 신호/스팸/
    AI 관련성만 본다(별점은 방어적으로 한 번 더 검사하지 않는다 — 질의가 보장).

    적용 순서(드롭 사유 카운트):
      - no_signal : description 과 topics 가 둘 다 비어 있음.
      - spam      : description 이 키워드 반복 스팸.
      - not_ai    : topics 가 AI_TOPICS/큐레이션 테마와 교집합 0(설명만 있고 비AI).

    Args:
        repos: parse_search_items 가 만든 repo dict 리스트.
        period: 로깅용 period 라벨.

    Returns:
        통과한 repo dict 리스트(입력 순서 유지; rank 는 호출측이 부여).
    """
    kept: List[Dict] = []
    dropped = {"no_signal": 0, "spam": 0, "not_ai": 0}

    for repo in repos:
        desc = (repo.get("description") or "").strip()
        topics = repo.get("topics") or []

        if not desc and not topics:
            dropped["no_signal"] += 1
            continue
        if is_keyword_spam(desc):
            dropped["spam"] += 1
            continue
        if not has_ai_relevance(topics):
            dropped["not_ai"] += 1
            continue
        kept.append(repo)

    total_dropped = sum(dropped.values())
    if total_dropped:
        logger.info(
            "[github_trending] %s 품질 필터: %d→%d (드롭 %d = no_signal %d / spam %d / not_ai %d)",
            period,
            len(repos),
            len(kept),
            total_dropped,
            dropped["no_signal"],
            dropped["spam"],
            dropped["not_ai"],
        )
    else:
        logger.info(
            "[github_trending] %s 품질 필터: %d개 전부 통과", period, len(repos)
        )
    return kept


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

    # 적재 전 품질 필터(중간 강도) 적용 — 드롭 사유는 filter_repos 가 INFO 로깅.
    filtered = filter_repos(list(merged.values()), period)

    # 필터 후 별점 내림차순 정렬·상위 N + rank 재부여(1=최고). 필터로 60 미만이면 그대로.
    ranked = sorted(filtered, key=lambda r: r["stars"], reverse=True)[:TOP_N]
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


def backfill_translations(conn=None, limit: int = 200) -> int:
    """이미 적재된 github_trending 행 중 description_ko 가 NULL 인 것을 재수집 없이
    번역해 채운다. 번역해 UPDATE 한 행수 반환.

    멱등: description 이 있고 description_ko IS NULL 인 행만 대상 → 이미 번역된 건은
    skip. 재실행하면 남은 미번역 행을 이어서 처리한다(news 의 base.backfill_translations
    패턴과 동일). 번역은 translate 모듈의 throttle/429 재시도가 적용되며, 실패 행은
    원문(description)을 유지한 채 description_ko NULL 로 남아 다음 실행에서 재시도된다.

    운영자가 한 번에 120행을 채우려면 limit 를 충분히 크게 준다(기본 200).
    requests 미설치 시 0 반환·조용히 종료(에러 아님). 항목별 try/except 로 격리한다.

    모든 SQL 은 psycopg2 %s 파라미터 바인딩만 사용한다(헌법 G7).

    Args:
        conn: 재사용할 psycopg2 연결. None 이면 내부에서 열고 닫는다.
        limit: 한 번에 처리할 최대 행수(호출 폭주 방지, 기본 200).

    Returns:
        실제로 description_ko 를 채워 UPDATE 한 행수.
    """
    from .base import get_connection
    from .translate import is_enabled, translate_to_korean

    if not is_enabled():
        logger.info("[github_trending] requests 미설치 — 번역 백필 건너뜀(원문 유지).")
        return 0

    own_conn = conn is None
    if own_conn:
        conn = get_connection()

    updated = 0
    try:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT id, description FROM github_trending "
                "WHERE description_ko IS NULL AND description IS NOT NULL "
                "AND description <> '' "
                "ORDER BY stars DESC LIMIT %s",
                (limit,),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()

        logger.info("[github_trending] 번역 백필 대상: %d 행(limit=%d)", len(rows), limit)

        for row_id, description in rows:
            cursor = conn.cursor()
            try:
                # description 을 title 슬롯으로 넘겨 단일 텍스트만 번역(summary 미사용).
                desc_ko, _ = translate_to_korean(description, None)
                if desc_ko is None:
                    # 번역 일시 실패 — 이 행은 다음 실행에서 재시도(원문 유지).
                    conn.rollback()
                    continue
                cursor.execute(
                    "UPDATE github_trending SET description_ko = %s WHERE id = %s",
                    (desc_ko, row_id),
                )
                conn.commit()
                updated += 1
            except Exception as e:
                conn.rollback()
                logger.warning(
                    "[github_trending] 번역 백필 항목 실패(skip) id=%s: %s", row_id, e
                )
            finally:
                cursor.close()
    finally:
        if own_conn:
            conn.close()

    logger.info("[github_trending] 번역 백필 완료: %d 행 업데이트", updated)
    return updated
