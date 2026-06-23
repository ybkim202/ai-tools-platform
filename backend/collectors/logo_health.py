"""도구 로고 헬스체크 — tools.logo_url 이 실제로 이미지로 로드되는지 주기 점검한다.

배경
----
logo_url 은 수동 큐레이션된 외부 URL 이다(tools_data.json). 사이트 개편·자산 경로
변경·favicon.ico 제거로 시간이 지나면 부패한다(404/403/타임아웃). 프론트엔드는
official_url 도메인의 파비콘 → 레터-아바타로 자가치유하므로(resolveLogoSrc/
handleLogoError) 화면이 깨지진 않지만, "어떤 도구의 큐레이션 로고가 죽었는지"를
운영자가 알 길이 없다.

이 잡은 표시를 바꾸지 않는다(자가치유는 프론트 담당). logo_url 의 생사만 점검해
tools.logo_status('ok'|'broken') 와 logo_checked_at 에 기록한다. 운영자는
    SELECT name, logo_url FROM tools WHERE logo_status='broken' ORDER BY name;
로 수동 교체 대상(특히 대표 도구 — 파비콘보다 진짜 로고가 나은 경우)을 한눈에 본다.

구조적 보호(헌법 데이터 정합성)
-------------------------------
logo_url 자체는 절대 자동 수정하지 않는다(수동 큐레이션 존중 — tools_metrics 와 동일
원칙). UPDATE SET 절에 logo_status / logo_checked_at 만 등장한다.

에러 격리·멱등
--------------
항목별 savepoint 로 격리(한 URL 점검 실패가 나머지를 막지 않음). 매 실행이 전체를
재점검하는 스냅샷이라 멱등(누적 상태 아님). 모든 SQL 은 psycopg2 %s 바인딩만 사용한다
(헌법 G7).

오프라인 단위검증
-----------------
classify_logo(status_code, content_type) 는 HTTP 응답값만 받아 'ok'|'broken' 을
돌려주는 순수 함수다(네트워크/DB 불필요).
"""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# 점검은 실제 브라우저가 <img> 로 가져갈 때와 같은 시야를 원한다. 봇 UA 로 403 을 받는
# 사이트(MS/AWS/Gamma 등)를 '깨짐'으로 오판하지 않도록 일반 브라우저 UA 로 probe 한다.
PROBE_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
# 재시도 없음: 깨진 URL 이 기대값(전체의 절반 가량)이라 retry-storm 을 피한다.
PROBE_TIMEOUT = 8  # 초

# SSRF 심층방어: probe 대상은 수동 큐레이션된 logo_url(신뢰 경계 안)뿐이지만,
# 잘못된/악의적 값이 섞여도 내부망·메타데이터 엔드포인트로 새지 않도록 가드를 둔다.
#  - http/https 만 허용(file:// 등 차단. data:/javascript: 은 requests 가 어차피 거부).
#  - 리다이렉트 추종은 짧게 제한(리다이렉트 체인으로 내부 주소 우회 표면 축소).
ALLOWED_SCHEMES = ("http", "https")
MAX_REDIRECTS = 3


def classify_logo(status_code: Optional[int], content_type: Optional[str]) -> str:
    """probe 결과를 'ok'|'broken' 으로 분류하는 순수 함수(단위검증용).

    ok 규칙: HTTP 200 이고 content-type 이 image/* 이거나 비어 있음. 일부 서버는
    content-type 을 생략하므로(예: 일부 favicon.ico) 그것만으로 깨짐 처리하면 오탐이다.
    그 외(4xx/5xx/None status, text/html 같은 비이미지 ct)는 broken 으로 본다.
    """
    if status_code != 200:
        return "broken"
    ct = (content_type or "").strip().lower()
    if ct == "" or ct.startswith("image/"):
        return "ok"
    return "broken"


def _probe(url: str) -> str:
    """logo_url 한 건을 가져와 'ok'|'broken' 으로 분류한다. 예외는 모두 broken.

    body 는 받지 않는다(stream=True 로 헤더만 확인 후 닫음 — 대역폭 절약).
    requests 미설치/네트워크 실패/타임아웃은 모두 broken 으로 분류한다.
    """
    try:
        import requests
    except Exception:
        logger.error("requests 미설치 — 로고 헬스체크 건너뜀")
        return "broken"

    # SSRF 심층방어: http/https 가 아닌 스킴은 fetch 자체를 하지 않고 broken 처리.
    scheme = (urlparse(url).scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        logger.debug("로고 probe 스킴 거부(broken): %s — scheme=%r", url, scheme)
        return "broken"

    try:
        # 세션 단위로 리다이렉트 추종 횟수를 제한한다(초과 시 TooManyRedirects → broken).
        session = requests.Session()
        session.max_redirects = MAX_REDIRECTS
        resp = session.get(
            url,
            headers={"User-Agent": PROBE_UA},
            timeout=PROBE_TIMEOUT,
            stream=True,
            allow_redirects=True,
        )
        try:
            return classify_logo(resp.status_code, resp.headers.get("Content-Type"))
        finally:
            resp.close()
            session.close()
    except Exception as e:
        logger.debug("로고 probe 실패(broken): %s — %s", url, e)
        return "broken"


def collect(conn) -> int:
    """logo_url 이 있는 도구를 모두 점검해 logo_status/logo_checked_at 를 갱신한다.

    반환값은 'broken' 으로 판정된 도구 수(운영 관측용). 이 의미는 base.collect_all 의
    '신규 삽입 행수' 와 다르므로 collect_all 에 넣지 않고 collect.py --check-logos 로
    주 1회 별도 호출한다(일일 잡을 가볍게 유지 — discover_tools 와 동일 패턴).
    """
    cursor = conn.cursor()
    broken = 0
    ok = 0
    try:
        cursor.execute(
            "SELECT id, name, logo_url FROM tools "
            "WHERE logo_url IS NOT NULL AND logo_url <> ''"
        )
        rows = cursor.fetchall()
        logger.info("[logo_health] 점검 대상 %d 개", len(rows))

        for tool_id, name, url in rows:
            status = _probe(url)
            cursor.execute("SAVEPOINT lh_sp")
            try:
                # 화이트리스트 컬럼만 SET — logo_url/큐레이션 필드는 구조적으로 보호.
                cursor.execute(
                    "UPDATE tools SET logo_status = %s, logo_checked_at = now() "
                    "WHERE id = %s",
                    (status, tool_id),
                )
                cursor.execute("RELEASE SAVEPOINT lh_sp")
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT lh_sp")
                logger.warning("[logo_health] 기록 실패(skip) %s: %s", name, e)
                continue

            if status == "broken":
                broken += 1
                logger.info("[logo_health] BROKEN: %s — %s", name, url)
            else:
                ok += 1
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[logo_health] 점검 실패, 롤백")
        raise
    finally:
        cursor.close()

    logger.info("[logo_health] 완료: ok %d / broken %d", ok, broken)
    return broken
