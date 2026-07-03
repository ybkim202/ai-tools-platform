"""OpenRouter Models 수집 — 도구의 세부 모델 라인업(tool_models)을 자동 갱신한다.

무료 공개 API(키 불필요): GET https://openrouter.ai/api/v1/models
tools.provider_slug(=OpenRouter author, 예 'anthropic'·'openai'·'google') 매칭 도구에
대해 해당 author 의 모델을 family 단위로 정리(버전/‑fast 변형 dedupe)해 tool_models 를
멱등 교체한다. 비LLM 도구(provider_slug NULL)는 대상 아님(모델 라인업 없음 → 섹션 숨김).

멱등성: (tool_id, model_slug) 유니크 + 도구별 DELETE→INSERT(항상 현재 라인업으로 교체).
에러 격리: 도구 단위 SAVEPOINT — 한 도구 실패가 배치를 죽이지 않는다.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from .base import http_get

logger = logging.getLogger(__name__)

MODELS_URL = "https://openrouter.ai/api/v1/models"
SOURCE = "openrouter"
SOURCE_URL = "https://openrouter.ai/models"
MAX_PER_TOOL = 6  # 도구당 노출 모델 상한(현재 라인업만 간결하게).

# 티어 분류 키워드(표시 배지 + is_flagship 근거).
FAST_KW = ("haiku", "mini", "flash", "nano", "lite", "-fast", "small", "fable", "tiny", "-air")
FLAGSHIP_KW = ("opus", "ultra", "-max", "-pro", "grok-4", "405b", "o1", "o3", "gpt-5")

# provider_slug 가 비어 있어도 이름으로 OpenRouter author 를 매칭하는 폴백 맵.
# (도구명 소문자 → author) — 수집기를 pre-seed 없이 self-sufficient 하게 만든다.
NAME_PROVIDER = {
    "chatgpt": "openai",
    "openai api": "openai",
    "claude": "anthropic",
    "anthropic (claude api)": "anthropic",
    "gemini": "google",
    "llama 2": "meta-llama",
    "mistral ai": "mistralai",
    "cohere": "cohere",
    "perplexity ai": "perplexity",
    "grok": "x-ai",
    "deepseek": "deepseek",
}


def _tier(slug_after_author: str) -> str:
    """슬러그 키워드로 tier 추정: fast > flagship > balanced 순 판정."""
    s = slug_after_author.lower()
    if any(k in s for k in FAST_KW):
        return "fast"
    if any(k in s for k in FLAGSHIP_KW):
        return "flagship"
    return "balanced"


def _family_key(slug_after_author: str) -> str:
    """버전·변형 접미를 제거해 family 로 묶는다(claude-opus-4.8-fast → claude-opus)."""
    s = slug_after_author.lower()
    s = re.sub(r"[-:]?\d+(\.\d+)*", "", s)  # 버전 숫자 제거
    for suf in ("-fast", "-preview", "-thinking", "-latest", "-instruct", "-exp"):
        s = s.replace(suf, "")
    return s.strip("-") or slug_after_author.lower()


def _clean_name(name: str) -> str:
    """"Anthropic: Claude Sonnet 5" → "Claude Sonnet 5"(공급사 접두 제거)."""
    if not name:
        return name
    return name.split(": ", 1)[-1].strip()


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _is_variant(slug_after_author: str) -> bool:
    s = slug_after_author.lower()
    return "-fast" in s or "preview" in s


def _select_models(author_models: list) -> list:
    """created desc 정렬 → family 단위 dedupe(정식(비-fast) 우선) → 최신 상위 N."""
    by_created = sorted(author_models, key=lambda m: m.get("created") or 0, reverse=True)
    picked = {}
    for m in by_created:
        after = m.get("id", "").split("/", 1)[-1]
        fam = _family_key(after)
        cur = picked.get(fam)
        if cur is None:
            picked[fam] = m
        else:
            # 같은 family: 이미 담긴 것이 변형(-fast/preview)이고 이번이 정식이면 교체.
            cur_after = cur.get("id", "").split("/", 1)[-1]
            if _is_variant(cur_after) and not _is_variant(after):
                picked[fam] = m
    result = sorted(picked.values(), key=lambda m: m.get("created") or 0, reverse=True)
    return result[:MAX_PER_TOOL]


def collect(conn) -> int:
    """provider_slug 매칭 도구의 모델 라인업을 OpenRouter 로 갱신. 총 upsert 행수 반환."""
    resp = http_get(MODELS_URL)
    if resp is None:
        logger.warning("[openrouter_models] 응답 없음 — skip")
        return 0
    try:
        data = resp.json().get("data", [])
    except Exception as e:
        logger.warning("[openrouter_models] JSON 파싱 실패: %s", e)
        return 0

    # author(소문자) → 모델 리스트
    by_author: dict = {}
    for m in data:
        mid = m.get("id", "")
        if "/" not in mid:
            continue
        author = mid.split("/", 1)[0].lower()
        by_author.setdefault(author, []).append(m)

    cursor = conn.cursor()
    total = 0
    try:
        # provider_slug 명시분 + 이름 폴백 매칭분 모두 대상(pre-seed 불필요).
        cursor.execute("SELECT id, name, provider_slug FROM tools")
        tools = cursor.fetchall()
        now = datetime.now(timezone.utc)
        for tool_id, name, slug in tools:
            provider = (slug or "").lower() or NAME_PROVIDER.get(
                (name or "").strip().lower()
            )
            if not provider:
                continue
            author_models = by_author.get(provider, [])
            if not author_models:
                logger.info(
                    "[openrouter_models] provider '%s' 모델 없음(도구 %s) — skip",
                    provider,
                    tool_id,
                )
                continue
            selected = _select_models(author_models)
            cursor.execute("SAVEPOINT tool_sp")
            try:
                # replace 전략: 이 도구의 openrouter 라인업을 통째 교체(항상 현재 라인업).
                cursor.execute(
                    "DELETE FROM tool_models WHERE tool_id = %s AND source = %s",
                    (tool_id, SOURCE),
                )
                for m in selected:
                    mid = m["id"]
                    after = mid.split("/", 1)[-1]
                    arch = m.get("architecture") or {}
                    pricing = m.get("pricing") or {}
                    tier = _tier(after)
                    cursor.execute(
                        """
                        INSERT INTO tool_models
                          (tool_id, model_name, model_slug, tier, context_length,
                           input_modalities, output_modalities, price_input, price_output,
                           is_flagship, source, source_url, collected_date)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (tool_id, model_slug) DO UPDATE SET
                          model_name=EXCLUDED.model_name, tier=EXCLUDED.tier,
                          context_length=EXCLUDED.context_length,
                          input_modalities=EXCLUDED.input_modalities,
                          output_modalities=EXCLUDED.output_modalities,
                          price_input=EXCLUDED.price_input, price_output=EXCLUDED.price_output,
                          is_flagship=EXCLUDED.is_flagship, source=EXCLUDED.source,
                          source_url=EXCLUDED.source_url, collected_date=EXCLUDED.collected_date
                        """,
                        (
                            tool_id,
                            _clean_name(m.get("name")),
                            mid,
                            tier,
                            m.get("context_length"),
                            ",".join(arch.get("input_modalities") or []),
                            ",".join(arch.get("output_modalities") or []),
                            _num(pricing.get("prompt")),
                            _num(pricing.get("completion")),
                            tier == "flagship",
                            SOURCE,
                            SOURCE_URL,
                            now,
                        ),
                    )
                    total += 1
                cursor.execute("RELEASE SAVEPOINT tool_sp")
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT tool_sp")
                logger.warning("[openrouter_models] 도구 %s 실패(skip): %s", tool_id, e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[openrouter_models] 배치 실패, 롤백")
        raise
    finally:
        cursor.close()

    logger.info("[openrouter_models] 모델 %d 건 upsert", total)
    return total
