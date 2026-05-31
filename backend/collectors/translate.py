"""뉴스 한글 번역 모듈 — 무료·키 불필요한 MyMemory 번역 API 로 영어를 한국어로 옮긴다.

설계 원칙(헌법 + 작업 요구)
---------------------------
- 비밀정보 없음: MyMemory 는 API 키가 필요 없다. 코드/로그에 시크릿을 남기지 않는다(헌법 G9).
- 항상 시도: 키 게이팅 없음. requests 미설치/네트워크 실패/쿼터 초과는 모두 잡아서
  None 을 반환한다 → 번역 실패가 수집 전체를 막지 않는다(에러 격리).
- requests 는 함수 내부에서 lazy import. 미설치여도 모듈 import 단계가 깨지지 않게.
- 인터페이스 유지: translate_to_korean(title, content) -> (title_ko, summary_ko).
  drop-in 교체 — base.py / collect.py / news.py / DB 스키마는 변경 불필요.
- 레이트 강건화(TASK 3-1): MyMemory 는 '초당 요청수' 레이트(429)가 있다. 모듈 레벨
  throttle(MIN_INTERVAL_SECONDS)로 요청 간 최소 간격을 보장하고, 429/타임아웃/네트워크
  일시 실패는 RETRY_BACKOFFS 만큼 점증 대기 후 재시도한다. 최종 실패는 기존대로 None
  반환(원문 유지). 상수로 빼서 대량 잡(뉴스)이 과도하게 느려지지 않게 조정 가능하다.

MyMemory 무료 한도
------------------
- 익명 호출: 약 5,000 단어/일.
- 환경변수 MYMEMORY_EMAIL 설정 시 `de=<email>` 파라미터로 약 50,000 단어/일로 완화.
  이 값은 시크릿이 아니라 단순 식별용 이메일이다(로그/저장 가능, 키 아님).
- 요청당 q 길이 제한(약 500바이트)이 있어 content 는 앞 CONTENT_MAX_CHARS 자만 보낸다.
  따라서 summary_ko 는 "요약"이 아니라 본문 앞부분의 번역 스니펫이다.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# MyMemory 무료 번역 엔드포인트(키 불필요).
MYMEMORY_URL = "https://api.mymemory.translated.net/get"

# 영어 → 한국어.
LANG_PAIR = "en|ko"

# MyMemory 요청당 q 길이 제한(약 500바이트)을 고려해 본문은 앞부분만 보낸다.
CONTENT_MAX_CHARS = 400

# 단건 번역이 잡 전체를 오래 잡지 않게 하는 HTTP 타임아웃(초).
REQUEST_TIMEOUT = 10

# 요청 간 최소 간격(초). MyMemory 는 '초당 요청수' 레이트(429)가 있어, 1초 미만으로
# 연타하면 무더기 429 를 맞는다(과거 120개 레포 description 번역 시 발생). 모듈 레벨
# throttle 로 _translate 호출 사이 최소 이 간격을 보장한다(time.monotonic 기준).
# 대량 잡(뉴스)도 수십 분을 넘지 않도록 1.x 초 선에서 타협한다(상수로 조정 가능).
MIN_INTERVAL_SECONDS = 1.1

# 429/일시 실패 재시도 backoff(초). 시도 사이 점증 대기. 길이가 재시도 횟수.
# 최종 실패 시 기존대로 None 반환(원문 유지·에러 격리).
RETRY_BACKOFFS = (2.0, 4.0)

# 직전 _translate 가 실제 HTTP 호출을 한 monotonic 시각(모듈 전역 throttle 상태).
_last_request_monotonic: float = 0.0


def _throttle() -> None:
    """직전 요청 이후 MIN_INTERVAL_SECONDS 가 지나도록 대기한다(초당 레이트 방지).

    time.monotonic 기준이라 시스템 시계 변경에 영향받지 않는다. 모듈 전역 상태를
    공유하므로 같은 프로세스 내 모든 번역 호출이 직렬로 최소 간격을 지킨다.
    """
    global _last_request_monotonic
    now = time.monotonic()
    elapsed = now - _last_request_monotonic
    wait = MIN_INTERVAL_SECONDS - elapsed
    if wait > 0:
        time.sleep(wait)
    _last_request_monotonic = time.monotonic()


def is_enabled() -> bool:
    """번역 사용 가능 여부.

    MyMemory 는 키가 필요 없으므로 requests 가 설치돼 있으면 항상 True.
    (실제 성공 여부는 네트워크에 달려 있으나, 그 실패는 호출 시 None 으로 흡수된다.)
    """
    try:
        import requests  # noqa: F401
    except Exception:
        return False
    return True


def _is_rate_limited(exc) -> bool:
    """예외가 HTTP 429(Too Many Requests) 응답에서 비롯됐는지 판정한다.

    requests.HTTPError 는 .response 에 상태코드를 담는다. requests 미설치/다른 예외는
    False(레이트가 아닌 일반 실패로 취급) — 단, 호출측은 양쪽 모두 backoff 재시도한다.
    """
    resp = getattr(exc, "response", None)
    return resp is not None and getattr(resp, "status_code", None) == 429


def _request_once(requests_mod, params: dict):
    """MyMemory 에 단발 GET 을 보내 파싱한 JSON 을 반환한다(예외는 그대로 올림).

    재시도/throttle 은 호출측(_translate)이 담당한다. 여기서는 순수 1회 호출만 한다.
    """
    resp = requests_mod.get(MYMEMORY_URL, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _translate(text: Optional[str]) -> Optional[str]:
    """영어 텍스트 한 조각을 MyMemory 로 한국어 번역한다. 실패/빈 입력 시 None.

    강건화(작업 TASK 3-1):
      - 요청 간 최소 간격(throttle)으로 초당 요청수 레이트(429)를 예방한다.
      - 429/타임아웃/네트워크 등 일시 실패는 RETRY_BACKOFFS 만큼 점증 대기 후 재시도.
      - 모든 재시도 소진/항구적 실패는 None 반환 → 호출측이 원문 유지(에러 격리).

    이 함수의 외부 인터페이스(반환 None=실패)는 기존과 동일하다(drop-in 유지).
    """
    text = (text or "").strip()
    if not text:
        return None

    try:
        import requests
    except Exception:
        logger.warning("requests 미설치 — 번역 비활성(원문 유지).")
        return None

    # 요청당 길이 제한 대비: 앞부분만 전송.
    q = text[:CONTENT_MAX_CHARS]
    params = {"q": q, "langpair": LANG_PAIR}

    # 선택: 이메일을 주면 무료 일일 한도가 완화된다(키 아님, 시크릿 아님).
    email = os.getenv("MYMEMORY_EMAIL", "").strip()
    if email:
        params["de"] = email

    # 시도 횟수 = 최초 1회 + RETRY_BACKOFFS 길이만큼 재시도.
    backoffs = (0.0, *RETRY_BACKOFFS)
    last_data = None
    for attempt, backoff in enumerate(backoffs):
        if backoff > 0:
            time.sleep(backoff)
        _throttle()
        try:
            last_data = _request_once(requests, params)
            break  # HTTP 성공 — 본문 검증으로 진행.
        except Exception as e:
            rate = _is_rate_limited(e)
            is_last = attempt == len(backoffs) - 1
            if is_last:
                logger.warning(
                    "MyMemory 번역 호출 실패(재시도 소진, 원문 유지): %s%s",
                    "429 레이트 " if rate else "",
                    e,
                )
                return None
            logger.warning(
                "MyMemory 번역 호출 실패(%d/%d, %s재시도): %s",
                attempt + 1,
                len(backoffs),
                "429 레이트 " if rate else "",
                e,
            )

    data = last_data or {}

    # responseStatus 가 200 이 아니면 실패(쿼터 초과 등은 보통 403/429 코드).
    status = data.get("responseStatus")
    try:
        status_ok = int(status) == 200
    except (TypeError, ValueError):
        status_ok = str(status) == "200"
    if not status_ok:
        logger.warning(
            "MyMemory 번역 비정상 상태(원문 유지): responseStatus=%s details=%s",
            status,
            data.get("responseDetails"),
        )
        return None

    translated = (data.get("responseData") or {}).get("translatedText")
    if not isinstance(translated, str):
        return None
    translated = translated.strip()
    if not translated:
        return None

    # 쿼터 초과 시 MyMemory 는 200 처럼 보이는 응답에 경고 문구를 본문으로 돌려주기도 한다.
    if "MYMEMORY WARNING" in translated.upper() or "QUOTA" in translated.upper():
        logger.warning("MyMemory 쿼터 경고 응답(원문 유지): %s", translated[:120])
        return None

    return translated


def translate_to_korean(
    title: str, content: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """제목과 본문 앞부분을 각각 한국어로 번역한다(MyMemory, 무료·키 불필요).

    Args:
        title: 영어 제목(필수).
        content: 영어 본문(선택). 앞 CONTENT_MAX_CHARS 자만 번역한다(스니펫).

    Returns:
        (title_ko, summary_ko). 빈 입력/번역 실패 항목은 None.
        부분 성공도 허용(둘 중 하나만 채워질 수 있음).
    """
    title = (title or "").strip()
    if not title:
        return None, None

    title_ko = _translate(title)
    summary_ko = _translate(content)
    return title_ko, summary_ko
