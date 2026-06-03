"""도구 인기지표 갱신기 — tools 테이블의 검증 가능한 인기지표만 자동 갱신한다.

이 수집기는 news 가 아니라 tools 테이블을 UPDATE 한다(신규 발견은 tools_discover 가 담당).
"검증 가능한 공식 소스만 자동화"(헌법 데이터 정합성) 원칙에 따라, GitHub Repo API 의
stargazers_count 와 Hacker News 의 points 처럼 공식 API 로 확인되는 값만 갱신한다.

자동 갱신 대상(화이트리스트) — 이 컬럼만 SET 한다
---------------------------------------------------
- github_stars      : github_repo 가 있는 도구. GitHub Repo API stargazers_count.
- hn_points         : hn_object_id 가 있는 도구(자동 발견됨). HN Algolia items API points.
- metrics_synced_at : 갱신 시각.

절대 건드리지 않는 값(구조적 보호)
----------------------------------
user_count / user_count_source / user_count_date(출처 불명확 — 수동 유지),
category / logo_url / official_url / description(수동 큐레이션). UPDATE 문 SET 절에
아예 등장하지 않으므로 코드 구조상 덮어쓸 수 없다.

토큰(선택)
----------
GITHUB_TOKEN 이 있으면 Repo API 레이트가 60→5,000/h 로 오른다. 없어도 동작한다
(오픈소스 도구 수가 적어 무토큰 60/h 로도 충분). HN Algolia 는 키가 필요 없다.
토큰 값은 로그에 남기지 않는다(헌법 G9).

에러 격리
---------
도구 한 건의 API/DB 실패가 다른 도구 갱신을 막지 않도록 항목별 savepoint 로 격리한다.
base.collect_all 의 collector 시그니처(collect(conn) -> int)를 따른다(반환=갱신 행수).

오프라인 단위검증
-----------------
extract_stars(payload) / extract_hn_points(payload) 는 응답 dict 만 받아 정수를
뽑는 순수 함수다(네트워크/DB 불필요).
"""

from __future__ import annotations

import logging
from typing import Optional

from .base import http_get
from .github_trending import _auth_headers  # GITHUB_TOKEN 인증 헤더 재사용

logger = logging.getLogger(__name__)

GITHUB_REPO_API = "https://api.github.com/repos"
# HN Algolia items 엔드포인트(키 불필요). objectID 로 현재 points 를 재조회한다.
HN_ITEM_API = "https://hn.algolia.com/api/v1/items"


def extract_stars(payload) -> Optional[int]:
    """GitHub Repo API 응답에서 stargazers_count 를 정수로 뽑는다(순수 함수).

    payload 가 dict 가 아니거나 필드가 없으면 None.
    """
    if not isinstance(payload, dict):
        return None
    value = payload.get("stargazers_count")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def extract_hn_points(payload) -> Optional[int]:
    """HN Algolia items 응답에서 points 를 정수로 뽑는다(순수 함수).

    payload 가 dict 가 아니거나 필드가 없으면 None.
    """
    if not isinstance(payload, dict):
        return None
    value = payload.get("points")
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _update_github_stars(conn, headers: dict) -> int:
    """github_repo 가 있는 도구들의 github_stars 를 갱신한다. 갱신 행수 반환.

    항목별 savepoint 격리: 한 repo 의 API/DB 실패가 나머지를 막지 않는다.
    모든 SQL 은 psycopg2 %s 바인딩만 사용한다(헌법 G7).
    """
    cursor = conn.cursor()
    updated = 0
    failed = 0
    try:
        cursor.execute(
            "SELECT id, name, github_repo FROM tools "
            "WHERE github_repo IS NOT NULL AND github_repo <> ''"
        )
        rows = cursor.fetchall()
        logger.info("[tools_metrics] github_stars 대상 %d 개", len(rows))

        for tool_id, name, repo in rows:
            cursor.execute("SAVEPOINT gh_sp")
            try:
                resp = http_get(f"{GITHUB_REPO_API}/{repo}", headers=headers)
                stars = extract_stars(resp.json()) if resp is not None else None
                if stars is None:
                    logger.warning("[tools_metrics] stars 조회 실패(skip): %s (%s)", name, repo)
                    cursor.execute("RELEASE SAVEPOINT gh_sp")
                    continue
                # 화이트리스트 컬럼만 SET — user_count 등은 구조적으로 보호.
                cursor.execute(
                    "UPDATE tools SET github_stars = %s, metrics_synced_at = now() "
                    "WHERE id = %s",
                    (stars, tool_id),
                )
                cursor.execute("RELEASE SAVEPOINT gh_sp")
                updated += 1
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT gh_sp")
                failed += 1
                logger.warning("[tools_metrics] github_stars 항목 실패(skip) %s: %s", name, e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[tools_metrics] github_stars 갱신 실패, 롤백")
        raise
    finally:
        cursor.close()
    logger.info("[tools_metrics] github_stars 갱신 %d / 실패 %d", updated, failed)
    return updated


def _update_hn_points(conn) -> int:
    """hn_object_id 가 있는(자동 발견된) 도구들의 hn_points 를 갱신한다. 갱신 행수 반환.

    HN Algolia 는 키가 필요 없다. 항목별 savepoint 격리.
    """
    cursor = conn.cursor()
    updated = 0
    failed = 0
    try:
        cursor.execute(
            "SELECT id, name, hn_object_id FROM tools "
            "WHERE hn_object_id IS NOT NULL AND hn_object_id <> ''"
        )
        rows = cursor.fetchall()
        logger.info("[tools_metrics] hn_points 대상 %d 개", len(rows))

        for tool_id, name, object_id in rows:
            cursor.execute("SAVEPOINT hn_sp")
            try:
                resp = http_get(f"{HN_ITEM_API}/{object_id}")
                points = extract_hn_points(resp.json()) if resp is not None else None
                if points is None:
                    logger.warning("[tools_metrics] HN points 조회 실패(skip): %s (%s)", name, object_id)
                    cursor.execute("RELEASE SAVEPOINT hn_sp")
                    continue
                cursor.execute(
                    "UPDATE tools SET hn_points = %s, metrics_synced_at = now() "
                    "WHERE id = %s",
                    (points, tool_id),
                )
                cursor.execute("RELEASE SAVEPOINT hn_sp")
                updated += 1
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT hn_sp")
                failed += 1
                logger.warning("[tools_metrics] hn_points 항목 실패(skip) %s: %s", name, e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[tools_metrics] hn_points 갱신 실패, 롤백")
        raise
    finally:
        cursor.close()
    logger.info("[tools_metrics] hn_points 갱신 %d / 실패 %d", updated, failed)
    return updated


def collect(conn) -> int:
    """검증 가능한 인기지표(github_stars, hn_points)를 갱신한다. 총 갱신 행수 반환.

    소스 단위 에러 격리: github 갱신 실패가 hn 갱신을 막지 않는다.
    base.collect_all 의 collector 시그니처(collect(conn) -> int)를 따른다.
    """
    headers = _auth_headers()
    logger.info("[tools_metrics] 수집 시작(github 인증=%s)", "Authorization" in headers)

    total = 0
    for label, fn in (("github_stars", lambda: _update_github_stars(conn, headers)),
                      ("hn_points", lambda: _update_hn_points(conn))):
        try:
            total += fn()
        except Exception:
            logger.exception("[tools_metrics] %s 갱신 실패(다음 단계 진행)", label)
            try:
                conn.rollback()
            except Exception:
                pass

    logger.info("[tools_metrics] 수집 종료: 총 %d 행 갱신", total)
    return total
