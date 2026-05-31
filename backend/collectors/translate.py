"""뉴스 한글 번역 모듈 — Claude(Anthropic)로 영어 제목/본문을 한국어로 번역·요약한다.

설계 원칙(헌법 + 작업 요구)
---------------------------
- 비밀정보: ANTHROPIC_API_KEY 는 환경변수로만 읽는다(하드코딩/로그 금지, 헌법 G9).
- 키 미설정이면 번역 비활성: (None, None) 반환. 에러 아님 — 키 없어도 수집/앱 정상.
- anthropic 패키지는 함수 내부에서 lazy import. 미설치여도 import 단계가 깨지지 않게.
- 호출 실패/타임아웃/응답 파싱 실패는 모두 잡아서 (None, None) 반환.
  → 번역 실패가 수집 전체를 막지 않는다(에러 격리).
- 토큰 절약: 본문은 앞 CONTENT_MAX_CHARS 자만 모델에 입력한다.

모델
----
저렴·빠른 claude-haiku-4-5 를 사용한다(대량 뉴스 번역에 적합).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# 저렴·빠른 모델(작업 요구). 필요 시 환경변수로 오버라이드.
MODEL = os.getenv("ANTHROPIC_TRANSLATE_MODEL", "claude-haiku-4-5")

# 토큰 절약: 본문은 앞부분만 모델에 입력(요약엔 충분).
CONTENT_MAX_CHARS = 1500

# 응답 길이 상한(제목 + 1~2문장 요약이면 충분).
MAX_TOKENS = 512

# Anthropic SDK 자체 타임아웃(초). 단건 번역이 잡 전체를 오래 잡지 않게.
REQUEST_TIMEOUT = 30

_SYSTEM_PROMPT = (
    "당신은 AI 도구 뉴스 번역가입니다. 영어 뉴스의 제목과 본문을 자연스러운 한국어로 "
    "번역·요약합니다. 규칙: (1) 제목은 자연스러운 한국어로 번역합니다. "
    "(2) 요약은 본문 핵심을 1~2문장의 한국어로 요약합니다. "
    "(3) 제품명·회사명·모델명 등 고유명사는 원문 그대로 유지합니다(예: OpenAI, GPT-4, "
    "Claude, ChatGPT). (4) 과장 없이 사실만 옮깁니다. "
    '반드시 JSON 객체만 출력합니다: {"title_ko": "...", "summary_ko": "..."}'
)


def is_enabled() -> bool:
    """번역 사용 가능 여부(ANTHROPIC_API_KEY 설정 시 True)."""
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


def _get_client():
    """Anthropic 클라이언트를 만든다. 키 미설정/패키지 미설치면 None.

    anthropic 은 lazy import — 미설치 환경에서 모듈 import 가 깨지지 않게.
    API 키는 SDK 가 환경변수 ANTHROPIC_API_KEY 에서 직접 읽는다(코드에 키 노출 없음).
    """
    if not is_enabled():
        return None
    try:
        import anthropic
    except Exception:
        logger.warning("anthropic 패키지 미설치 — 번역 비활성(원문만 저장).")
        return None
    try:
        return anthropic.Anthropic(timeout=REQUEST_TIMEOUT)
    except Exception:
        logger.exception("Anthropic 클라이언트 초기화 실패 — 번역 건너뜀.")
        return None


def _parse_response(text: str) -> Tuple[Optional[str], Optional[str]]:
    """모델 응답(JSON 문자열)에서 title_ko/summary_ko 를 추출한다.

    코드펜스나 잡설이 섞여도 첫 '{' ~ 마지막 '}' 구간을 JSON 으로 시도한다.
    파싱 실패 시 (None, None).
    """
    if not text:
        return None, None
    raw = text.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None, None
    try:
        obj = json.loads(raw[start : end + 1])
    except Exception:
        return None, None
    title_ko = obj.get("title_ko")
    summary_ko = obj.get("summary_ko")
    title_ko = title_ko.strip() if isinstance(title_ko, str) and title_ko.strip() else None
    summary_ko = (
        summary_ko.strip() if isinstance(summary_ko, str) and summary_ko.strip() else None
    )
    return title_ko, summary_ko


def translate_to_korean(
    title: str, content: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """제목을 한국어로 번역하고 본문을 1~2문장으로 한국어 요약한다.

    Args:
        title: 영어 제목(필수).
        content: 영어 본문(선택). 앞 CONTENT_MAX_CHARS 자만 사용.

    Returns:
        (title_ko, summary_ko). 키 미설정/실패/빈 입력 시 (None, None).
        부분 성공도 허용(둘 중 하나만 채워질 수 있음).
    """
    title = (title or "").strip()
    if not title:
        return None, None

    client = _get_client()
    if client is None:
        return None, None

    snippet = (content or "").strip()[:CONTENT_MAX_CHARS]
    user_msg = (
        f"제목(영문): {title}\n"
        f"본문(영문, 일부): {snippet if snippet else '(본문 없음)'}\n\n"
        "위 제목을 한국어로 번역하고, 본문을 한국어 1~2문장으로 요약해 "
        "JSON 으로만 답하세요."
    )

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )
        # content 블록들에서 텍스트만 이어붙인다.
        parts = []
        for block in getattr(resp, "content", []) or []:
            block_text = getattr(block, "text", None)
            if block_text:
                parts.append(block_text)
        return _parse_response("".join(parts))
    except Exception as e:
        # API 키/네트워크/타임아웃/레이트리밋 등 — 수집을 막지 않도록 흡수.
        logger.warning("뉴스 번역 실패(원문 유지): %s", e)
        return None, None
