"""Wikipedia 요약 수집 — 도구의 신뢰할 상세 설명(long_description)을 채운다.

무료 REST(키 불필요): GET https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}
정확도를 위해 (도구명 → 위키 문서 제목) 큐레이션 매핑만 대상으로 한다 — 모호한 자동
매칭으로 엉뚱한 문서를 붙이지 않는다(허구 금지). ko 우선, 없으면 en 폴백. 문서가
disambiguation 이거나 extract 가 비면 skip(기존 short description 유지).

출처 명시: description_source='wikipedia', description_source_url=문서 URL(신뢰 근거).
에러 격리: 도구 단위 SAVEPOINT.
"""

from __future__ import annotations

import logging
import urllib.parse

from .base import http_get

logger = logging.getLogger(__name__)

# 도구명(소문자) → 위키 문서 제목. 정확성 위한 큐레이션 화이트리스트(모호 매칭 금지).
TITLE_MAP = {
    "chatgpt": "ChatGPT",
    "claude": "Claude (language model)",
    "gemini": "Gemini (chatbot)",
    "microsoft copilot": "Microsoft Copilot",
    "github copilot": "GitHub Copilot",
    "midjourney": "Midjourney",
    "stable diffusion": "Stable Diffusion",
    "dall-e 3": "DALL-E",
    "dall-e": "DALL-E",
    "perplexity ai": "Perplexity AI",
    "llama 2": "Llama (language model)",
    "mistral ai": "Mistral AI",
    "notion ai": "Notion (productivity software)",
    "canva ai": "Canva",
    "grammarly": "Grammarly",
    "runway": "Runway (company)",
    "synthesia": "Synthesia (company)",
    "hugging face": "Hugging Face",
    "huggingface": "Hugging Face",
    "elevenlabs": "ElevenLabs",
    "character.ai": "Character.ai",
    "quillbot": "QuillBot",
    "tensorflow": "TensorFlow",
    "opencv": "OpenCV",
    "jupyter": "Project Jupyter",
}
MAX_LEN = 1200
LANGS = ("ko", "en")


def _fetch_summary(title: str):
    """(extract, page_url) 반환. ko→en 폴백, disambiguation·빈 extract 는 skip."""
    for lang in LANGS:
        url = (
            f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/"
            + urllib.parse.quote(title, safe="")
        )
        resp = http_get(url)
        if resp is None:
            continue
        try:
            j = resp.json()
        except Exception:
            continue
        if j.get("type") == "disambiguation":
            continue
        extract = (j.get("extract") or "").strip()
        if not extract:
            continue
        page_url = (
            ((j.get("content_urls") or {}).get("desktop") or {}).get("page")
        ) or ""
        return extract[:MAX_LEN], page_url
    return None, None


def collect(conn) -> int:
    """큐레이션 매핑 도구의 long_description 을 위키백과 요약으로 갱신. 갱신 행수 반환."""
    cursor = conn.cursor()
    updated = 0
    try:
        cursor.execute("SELECT id, name FROM tools")
        rows = cursor.fetchall()
        for tool_id, name in rows:
            title = TITLE_MAP.get((name or "").strip().lower())
            if not title:
                continue
            cursor.execute("SAVEPOINT wiki_sp")
            try:
                extract, page_url = _fetch_summary(title)
                if not extract:
                    cursor.execute("RELEASE SAVEPOINT wiki_sp")
                    continue
                cursor.execute(
                    "UPDATE tools SET long_description=%s, description_source=%s, "
                    "description_source_url=%s WHERE id=%s",
                    (extract, "wikipedia", page_url or None, tool_id),
                )
                updated += 1
                cursor.execute("RELEASE SAVEPOINT wiki_sp")
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT wiki_sp")
                logger.warning("[wikipedia_desc] 도구 %s 실패(skip): %s", tool_id, e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[wikipedia_desc] 배치 실패, 롤백")
        raise
    finally:
        cursor.close()

    logger.info("[wikipedia_desc] %d 건 설명 갱신", updated)
    return updated
