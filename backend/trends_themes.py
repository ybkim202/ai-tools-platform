"""깃헙 트렌드 주제(테마) 매핑 — 단일 정본.

`GET /api/trends/github` 라우터(app/routers/trends.py)와 수집기
(collectors/github_trending.py)가 함께 import 하는 테마 매핑 모듈이다.
중복 정의를 막기 위해 테마 키/라벨/토픽 매핑을 이 한 곳에만 둔다.

설계
----
- 각 테마는 GitHub 가 제공하는 topic 문자열 목록과 매칭된다(소문자 비교).
- 한 레포가 여러 테마에 매칭될 수 있다(예: rag + agent).
- 라우터는 themes[] 응답에 항상 'all'(label='전체')을 포함한다.
- 이 모듈은 순수 파이썬(외부 의존 없음)이라 import 단계가 깨지지 않는다.

확정 계약(프론트 GithubTrends.jsx): themes 항목은 { key, label, count } 형태이며
'all' 은 총합, count 0 테마는 라우터가 응답에서 제외(프론트도 미표시).
"""

from __future__ import annotations

from typing import Dict, List

# 'all' 의 라벨(전체). 키는 프론트가 'all' 로 고정 사용한다.
ALL_THEME_KEY = "all"
ALL_THEME_LABEL = "전체"

# 큐레이션 테마: key → (label, [매칭 topic 들]).
# 순서는 응답 themes[] 의 노출 순서(프론트 칩 순서)를 따른다.
# topic 은 소문자로만 작성한다(매칭 시 양쪽을 소문자화해 비교).
THEME_TOPICS: Dict[str, Dict[str, object]] = {
    "agent": {
        "label": "AI 에이전트",
        "topics": ["agent", "agents", "autonomous-agents", "ai-agent", "ai-agents", "multi-agent"],
    },
    "rag": {
        "label": "RAG",
        "topics": ["rag", "retrieval-augmented-generation", "vector-database", "vector-search", "embeddings"],
    },
    "local-llm": {
        "label": "로컬 LLM",
        "topics": ["llama", "ollama", "local-llm", "gguf", "llama-cpp", "llamacpp"],
    },
    "image": {
        "label": "이미지 생성",
        "topics": ["stable-diffusion", "text-to-image", "diffusion", "image-generation", "diffusion-models"],
    },
    "voice": {
        "label": "음성",
        "topics": ["tts", "speech-to-text", "whisper", "voice", "text-to-speech", "speech-recognition"],
    },
    "finetune": {
        "label": "파인튜닝",
        "topics": ["fine-tuning", "lora", "peft", "finetuning", "fine-tune", "qlora"],
    },
    "mlops": {
        "label": "MLOps",
        "topics": ["mlops", "llmops", "model-serving", "inference", "model-deployment"],
    },
}

# topic(소문자) → 매칭되는 테마 key 들. 빠른 역방향 조회용으로 미리 구성한다.
_TOPIC_TO_THEMES: Dict[str, List[str]] = {}
for _key, _spec in THEME_TOPICS.items():
    for _topic in _spec["topics"]:  # type: ignore[index]
        _TOPIC_TO_THEMES.setdefault(_topic.lower(), []).append(_key)


def valid_theme_keys() -> List[str]:
    """검증용 허용 테마 key 목록('all' 포함)."""
    return [ALL_THEME_KEY, *THEME_TOPICS.keys()]


def is_valid_theme(key: str) -> bool:
    """주어진 key 가 허용 테마인지 여부('all' 포함). None/빈값도 False."""
    if not key:
        return False
    return key in valid_theme_keys()


def theme_label(key: str) -> str:
    """테마 key 의 한글 라벨. 'all' 은 '전체', 미지정 키는 key 그대로."""
    if key == ALL_THEME_KEY:
        return ALL_THEME_LABEL
    spec = THEME_TOPICS.get(key)
    return str(spec["label"]) if spec else key  # type: ignore[index]


def match_themes(topics) -> List[str]:
    """레포의 topics 리스트를 큐레이션 테마 key 리스트로 매핑한다.

    Args:
        topics: GitHub topics 문자열 리스트(None/비리스트 허용 — 빈 결과).

    Returns:
        매칭된 테마 key 리스트(중복 제거, THEME_TOPICS 정의 순서 유지). 'all' 은 포함하지 않는다.
    """
    if not isinstance(topics, (list, tuple)):
        return []
    matched: List[str] = []
    seen = set()
    lowered = {str(t).strip().lower() for t in topics if t}
    for topic in lowered:
        for key in _TOPIC_TO_THEMES.get(topic, []):
            if key not in seen:
                seen.add(key)
                matched.append(key)
    # THEME_TOPICS 정의 순서로 정렬해 응답 일관성 유지.
    order = {k: i for i, k in enumerate(THEME_TOPICS)}
    matched.sort(key=lambda k: order.get(k, 999))
    return matched
