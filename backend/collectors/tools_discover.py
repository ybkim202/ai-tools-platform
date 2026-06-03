"""신규 AI 도구 발견기 — Hacker News "Show HN" 에서 AI 도구를 찾아 tools 에 추가한다.

키가 필요 없는 Hacker News Algolia Search API 로 "Show HN"(창업자가 직접 런칭한 신규
도구·제품) 글을 가져와, AI 관련성·품질 필터를 통과한 것만 tools 테이블에 INSERT 한다.
신규 도구는 품질 필터 통과 시 자동 공개된다(검토 큐 없음 — 사용자 결정).

자동 공개의 안전장치(필수)
--------------------------
1. AI 관련성: 제목/URL 에 AI 키워드가 없으면 드롭(HN 은 토픽을 주지 않으므로 자체 판정).
2. 키워드 반복 스팸 제거: github_trending.is_keyword_spam 재사용.
3. points 임계값: HN_DISCOVER_MIN_POINTS(기본 15) 미만 드롭.
4. 카테고리 화이트리스트 정규화: 기존 20종 한글 카테고리로만 매핑(매핑 실패 시 '특수목적').
   새 카테고리 문자열은 절대 INSERT 하지 않는다 → 프론트 필터 오염 방지(헌법 G5/G6).
5. 이름 유효성: 추출 이름 길이/형식 검증, 기존 도구명(대소문자 무시) 중복 skip.
6. 멱등: hn_object_id 부분 UNIQUE 인덱스 + INSERT 전 중복 확인. source='auto_hn' 로
   추적·롤백 가능(DELETE FROM tools WHERE source='auto_hn' ...).

토큰
----
필요 없음(HN Algolia 공개 API). base.http_get 의 타임아웃/재시도를 그대로 쓴다.

에러 격리
---------
항목별 savepoint 로 격리(한 건 실패가 배치 전체를 막지 않음). collect(conn) -> int.

오프라인 단위검증
-----------------
extract_tool_name / is_ai_related / normalize_category / parse_hit 는 네트워크/DB
불필요한 순수 함수다.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from .base import http_get
from .github_trending import is_keyword_spam

logger = logging.getLogger(__name__)

HN_SEARCH_API = "https://hn.algolia.com/api/v1/search"

# 발견 질의에 쓸 AI 키워드(각 키워드로 검색 후 objectID 기준 병합/중복제거).
_QUERY_KEYWORDS = ["AI", "LLM", "GPT", "agent", "machine learning"]

# AI 관련성 판정 키워드. 짧고 모호한 토큰(ai/ml/gpt 등)은 부분일치하면 "airmash·email·
# domain" 같은 오탐이 나므로 단어 경계(\b)로만 매칭한다. 다단어/명확한 구는 부분일치.
#
# _AI_WORDS: 단어 경계로 매칭(소문자). "ai" 는 "airmash" 에 매칭되지 않는다.
_AI_WORDS = {
    "ai", "llm", "llms", "gpt", "ml", "nlp", "rag", "genai", "agentic",
    "chatbot", "chatgpt", "openai", "anthropic", "claude", "gemini", "copilot",
    "neural", "embedding", "embeddings", "transformer", "transformers",
    "inference", "diffusion", "generative", "ollama", "llama", "mistral",
}
# _AI_PHRASES: 부분일치(다단어이거나 충분히 길어 오탐 위험이 낮음).
_AI_PHRASES = (
    "a.i.", "artificial intelligence", "machine learning", "deep learning",
    "stable diffusion", "text-to-", "computer vision", "hugging face",
    "fine-tun", "speech recognition", "voice ai", "language model",
    "prompt engineering", "vector database", "vector search",
)
# 단어 경계 매칭용 정규식(소문자 토큰 집합으로 1회 컴파일).
_AI_WORD_RE = re.compile(
    r"\b(" + "|".join(sorted(_AI_WORDS, key=len, reverse=True)) + r")\b"
)

# 카테고리 정규화: (키워드 튜플 → 기존 한글 카테고리). 위에서부터 먼저 매칭되는 것 채택.
# 카테고리 값은 tools_data.json 의 20종 화이트리스트 안에서만 고른다(새 값 금지).
_CATEGORY_RULES = [
    (("text-to-image", "image gen", "text to image", "art generat", "illustration", "avatar"), "이미지생성"),
    (("text-to-video", "video gen", "video generat", "ai video"), "비디오생성"),
    (("text-to-speech", "tts", "voice gen", "voice clon", "speech synth", "audio generat"), "음성생성"),
    (("speech-to-text", "transcri", "voice recogn", "speech recogn"), "음성처리"),
    (("image edit", "photo edit", "background remov", "upscal", "inpaint"), "이미지편집"),
    (("audio edit", "music", "podcast"), "오디오편집"),
    (("ocr", "object detect", "vision", "image recogn", "face "), "컴퓨터비전"),
    (("code", "coding", "developer", "devtool", "dev tool", "programming",
      "debug", "ide", "compiler", "sdk", "cli ", "terminal", "git "), "개발도구"),
    (("api", "endpoint", "rest "), "API"),
    (("writing", "copywrit", "essay", "blog post", "grammar", "paraphras"), "쓰기보조"),
    (("content", "marketing", "seo", "social media", "newsletter"), "콘텐츠생성"),
    (("design", "ui ", "ux ", "figma", "logo ", "presentation", "slide"), "디자인"),
    (("search engine", "search ai", "semantic search", "ai search"), "검색AI"),
    (("data analy", "analytics", "dashboard", "spreadsheet", "chart", "bi "), "데이터분석"),
    (("dataset", "data label", "annotation", "scrap"), "데이터서비스"),
    (("productivity", "workflow", "automat", "assistant", "agent", "note", "task "), "생산성"),
    (("game", "entertain", "story", "companion", "roleplay"), "엔터테인먼트"),
    (("platform", "infrastructure", "deploy", "host", "fine-tun", "training"), "AI플랫폼"),
    (("chatbot", "chat ", "conversational", "generative", "genai", "llm", "gpt"), "생성형AI"),
]

# 화이트리스트 폴백(매핑 실패 시). tools_data.json 카테고리 20종 중 하나.
_CATEGORY_FALLBACK = "특수목적"

# 이름 추출 분리자(앞 세그먼트만 도구명으로 채택).
_NAME_SPLIT_RE = re.compile(r"\s*[–—\-:,(]\s*")
# "Show HN:" 접두사 제거(대소문자 무시).
_SHOW_HN_RE = re.compile(r"^\s*show\s+hn\s*:?\s*", re.IGNORECASE)
# 이름 앞 흔한 1인칭 도입구 제거.
_LEADIN_RE = re.compile(
    r"^(i\s+(built|made|created|wrote|developed|launched|open[- ]?sourced)|"
    r"we\s+(built|made|created|launched)|my|introducing|meet)\s+",
    re.IGNORECASE,
)

_NAME_MIN = 2
_NAME_MAX = 60
_NAME_MAX_WORDS = 6  # 이보다 많으면 제품명이 아니라 문장/글 제목으로 보고 드롭.
_DESC_MAX = 500
_URL_MAX = 500
_DEFAULT_MIN_POINTS = 15
_DISCOVER_DAYS = 30  # created 윈도우(일). 주 1회 cron + 중복 skip 이라 넉넉히 잡는다.
_PER_PAGE = 50


def _min_points() -> int:
    """points 임계값(env HN_DISCOVER_MIN_POINTS 오버라이드). 잘못된 값이면 기본값."""
    raw = os.getenv("HN_DISCOVER_MIN_POINTS", "").strip()
    if not raw:
        return _DEFAULT_MIN_POINTS
    try:
        v = int(raw)
        return v if v >= 0 else _DEFAULT_MIN_POINTS
    except ValueError:
        return _DEFAULT_MIN_POINTS


def is_ai_related(text: str) -> bool:
    """제목+URL 텍스트에 AI 관련 키워드가 있는지(순수 함수).

    짧은 토큰(ai/ml/gpt 등)은 단어 경계로만 매칭해 'airmash·email·domain' 류 오탐을
    막고, 다단어/명확한 구는 부분일치로 본다. 하나라도 걸리면 True.
    """
    if not text:
        return False
    low = text.lower()
    if _AI_WORD_RE.search(low):
        return True
    return any(phrase in low for phrase in _AI_PHRASES)


def extract_tool_name(title: str) -> Optional[str]:
    """HN "Show HN" 제목에서 도구명을 추출한다(순수 함수). 추출 실패 시 None.

    예) "Show HN: Cleorra – an AI tool for X" → "Cleorra"
        "Show HN: I built Foozle, a GPT wrapper" → "Foozle"
    분리자(–, —, -, :, ,, ()) 앞 첫 세그먼트를 이름으로 보고, 1인칭 도입구를 제거한다.
    길이(_NAME_MIN.._NAME_MAX) 밖이거나 비면 None.
    """
    if not title:
        return None
    s = _SHOW_HN_RE.sub("", title).strip()
    s = _LEADIN_RE.sub("", s).strip()
    # 첫 분리자 앞 세그먼트.
    first = _NAME_SPLIT_RE.split(s, maxsplit=1)[0].strip()
    # 양끝 따옴표/마침표 정리.
    first = first.strip(" \"'.")
    first = re.sub(r"\s+", " ", first)
    if not first or not (_NAME_MIN <= len(first) <= _NAME_MAX):
        return None
    # 단어 수가 많으면 제품명이 아니라 문장/글 제목일 가능성이 높다
    # (예: "Build Your Own AI Agent CLI in 150 Lines"). 도구명은 보통 1~4 단어.
    if len(first.split()) > _NAME_MAX_WORDS:
        return None
    return first


def normalize_category(text: str) -> str:
    """제목+설명+URL 텍스트를 기존 한글 카테고리 20종 중 하나로 정규화(순수 함수).

    _CATEGORY_RULES 를 위에서부터 검사해 첫 매칭 카테고리를 반환. 매칭 실패 시
    화이트리스트 폴백('특수목적'). 새 카테고리 문자열은 절대 만들지 않는다.
    """
    low = (text or "").lower()
    for keywords, category in _CATEGORY_RULES:
        if any(k in low for k in keywords):
            return category
    return _CATEGORY_FALLBACK


def parse_hit(hit) -> Optional[Dict]:
    """HN Algolia search hit 한 건을 도구 후보 dict 로 변환한다(순수 함수). 부적합 시 None.

    필터: url 존재, 이름 추출 성공, AI 관련성(제목+URL), 키워드 스팸 아님.
    points 임계값은 호출측(_fetch)에서 질의로 거르므로 여기선 방어적 보존만.
    """
    if not isinstance(hit, dict):
        return None
    title = (hit.get("title") or "").strip()
    url = (hit.get("url") or "").strip()
    object_id = str(hit.get("objectID") or "").strip()
    if not title or not url or not object_id:
        return None

    name = extract_tool_name(title)
    if not name:
        return None

    # AI 관련성: 제목 + URL 기준.
    if not is_ai_related(f"{title} {url}"):
        return None

    # 설명은 제목에서 이름 뒤 부분(없으면 제목 전체). 스팸이면 드롭.
    desc = title
    if is_keyword_spam(desc):
        return None

    points = hit.get("points")
    try:
        points = int(points) if points is not None else None
    except (TypeError, ValueError):
        points = None

    return {
        "name": name,
        "official_url": url[:_URL_MAX],
        "description": desc[:_DESC_MAX],
        "category": normalize_category(f"{title} {url}"),
        "hn_object_id": object_id[:20],
        "hn_points": points,
    }


def _created_since_ts() -> int:
    """발견 윈도우 하한의 unix timestamp(초). HN numericFilters 용."""
    since = datetime.now(timezone.utc) - timedelta(days=_DISCOVER_DAYS)
    return int(since.timestamp())


def _fetch_candidates() -> List[Dict]:
    """AI 키워드별로 Show HN 을 질의·병합·중복제거해 후보 dict 리스트를 만든다.

    한 키워드 검색 실패가 다른 키워드를 막지 않는다(에러 격리). objectID 로 중복 제거.
    """
    since_ts = _created_since_ts()
    min_points = _min_points()
    merged: Dict[str, Dict] = {}

    for keyword in _QUERY_KEYWORDS:
        params = {
            "tags": "show_hn",
            "query": keyword,
            "numericFilters": f"created_at_i>{since_ts},points>={min_points}",
            "hitsPerPage": _PER_PAGE,
        }
        resp = http_get(HN_SEARCH_API, params=params)
        if resp is None:
            logger.warning("[tools_discover] HN 검색 실패(skip): keyword=%s", keyword)
            continue
        try:
            hits = resp.json().get("hits", [])
        except Exception:
            logger.warning("[tools_discover] HN 응답 파싱 실패(skip): keyword=%s", keyword)
            continue
        for hit in hits:
            parsed = parse_hit(hit)
            if parsed is None:
                continue
            # 같은 글은 1건만(이미 있으면 유지).
            merged.setdefault(parsed["hn_object_id"], parsed)

    candidates = list(merged.values())
    logger.info(
        "[tools_discover] 후보 %d 건(키워드 %d개, points>=%d, 최근 %d일)",
        len(candidates), len(_QUERY_KEYWORDS), min_points, _DISCOVER_DAYS,
    )
    return candidates


def _insert_candidates(conn, candidates: List[Dict]) -> int:
    """후보를 tools 에 멱등 INSERT 한다(source='auto_hn'). 신규 삽입 행수 반환.

    중복 skip 규칙:
      - hn_object_id 가 이미 존재하면 skip(같은 글 재발견).
      - 도구명(대소문자 무시)이 이미 존재하면 skip(이름 충돌 — 기존 큐레이션 보호).
    항목별 savepoint 격리. 모든 SQL 은 psycopg2 %s 바인딩만(헌법 G7).
    """
    cursor = conn.cursor()
    inserted = 0
    skipped = 0
    failed = 0
    try:
        for cand in candidates:
            cursor.execute("SAVEPOINT cand_sp")
            try:
                cursor.execute(
                    "SELECT 1 FROM tools WHERE hn_object_id = %s "
                    "OR lower(name) = lower(%s) LIMIT 1",
                    (cand["hn_object_id"], cand["name"]),
                )
                if cursor.fetchone() is not None:
                    skipped += 1
                    cursor.execute("RELEASE SAVEPOINT cand_sp")
                    continue
                cursor.execute(
                    "INSERT INTO tools "
                    "(name, official_url, description, category, "
                    " hn_object_id, hn_points, source, metrics_synced_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, 'auto_hn', now())",
                    (
                        cand["name"],
                        cand["official_url"],
                        cand["description"],
                        cand["category"],
                        cand["hn_object_id"],
                        cand["hn_points"],
                    ),
                )
                cursor.execute("RELEASE SAVEPOINT cand_sp")
                inserted += 1
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT cand_sp")
                failed += 1
                logger.warning("[tools_discover] INSERT 실패(skip) %s: %s", cand.get("name"), e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[tools_discover] 후보 적재 실패, 롤백")
        raise
    finally:
        cursor.close()
    logger.info(
        "[tools_discover] 신규 %d / 스킵(중복) %d / 실패 %d", inserted, skipped, failed
    )
    return inserted


def collect(conn) -> int:
    """Hacker News 에서 신규 AI 도구를 발견해 tools 에 자동 추가. 신규 행수 반환.

    base.collect_all 의 collector 시그니처(collect(conn) -> int)를 따른다. 단 일일
    collect_all 에는 등록하지 않고, collect.py --discover-tools 로 주 1회 호출한다.
    """
    logger.info("[tools_discover] 수집 시작(Hacker News, 키 불필요)")
    candidates = _fetch_candidates()
    if not candidates:
        logger.info("[tools_discover] 후보 없음(적재 생략)")
        return 0
    n = _insert_candidates(conn, candidates)
    logger.info("[tools_discover] 수집 종료: 신규 %d 건", n)
    return n
