"""뉴스 한글 번역 모듈 — 무료·키 불필요한 MyMemory 번역 API 로 영어를 한국어로 옮긴다.

설계 원칙(헌법 + 작업 요구)
---------------------------
- 비밀정보 없음: MyMemory 는 API 키가 필요 없다. 코드/로그에 시크릿을 남기지 않는다(헌법 G9).
- 항상 시도: 키 게이팅 없음. requests 미설치/네트워크 실패/쿼터 초과는 모두 잡아서
  None 을 반환한다 → 번역 실패가 수집 전체를 막지 않는다(에러 격리).
- requests 는 함수 내부에서 lazy import. 미설치여도 모듈 import 단계가 깨지지 않게.
- 인터페이스 유지: translate_to_korean(title, content) -> (title_ko, summary_ko).
  drop-in 교체 — base.py / collect.py / news.py / DB 스키마는 변경 불필요.

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


def _translate(text: Optional[str]) -> Optional[str]:
    """영어 텍스트 한 조각을 MyMemory 로 한국어 번역한다. 실패/빈 입력 시 None.

    실패(미설치/네트워크/타임아웃/쿼터초과/파싱오류)는 모두 잡아 None 을 돌려준다
    → 호출측이 원문을 그대로 유지하도록(수집을 막지 않음).
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

    try:
        resp = requests.get(MYMEMORY_URL, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning("MyMemory 번역 호출 실패(원문 유지): %s", e)
        return None

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
