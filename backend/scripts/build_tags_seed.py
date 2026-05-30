"""tags_seed.json 생성 및 자기검증 스크립트.

tools_data.json(78개)을 읽어 task/profession 태그 택소노미를 적용하고
backend/tags_seed.json 을 생성한다. DB 적재는 하지 않는다(검토용 산출물).
"""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_PATH = os.path.join(BASE, "tools_data.json")
OUT_PATH = os.path.join(BASE, "tags_seed.json")

# ---- 택소노미 정의 (UI 드롭다운 옵션이 됨) ----
TASK_TAGS = [
    "콘텐츠작성", "이미지생성", "비디오생성", "음성·오디오", "코딩개발",
    "데이터분석", "디자인", "검색·리서치", "생산성", "챗봇·대화", "모델·API연동",
]
PROFESSION_TAGS = [
    "개발자", "디자이너", "마케터", "콘텐츠크리에이터", "데이터과학자",
    "기획자·PM", "학생·연구자", "일반사무",
]

# ---- 78개 도구 전수 매핑 (tool_name -> [태그...]) ----
# 각 항목: task 1~3개 + profession 1~3개
MAPPING = {
    "ChatGPT": ["챗봇·대화", "콘텐츠작성", "코딩개발", "일반사무", "학생·연구자", "개발자"],
    "Claude": ["챗봇·대화", "콘텐츠작성", "코딩개발", "개발자", "학생·연구자", "일반사무"],
    "DALL-E 3": ["이미지생성", "디자인", "디자이너", "콘텐츠크리에이터", "마케터"],
    "Midjourney": ["이미지생성", "디자인", "디자이너", "콘텐츠크리에이터", "마케터"],
    "GitHub Copilot": ["코딩개발", "개발자"],
    "Runway": ["비디오생성", "콘텐츠크리에이터", "디자이너"],
    "Gemini": ["챗봇·대화", "검색·리서치", "콘텐츠작성", "일반사무", "학생·연구자", "개발자"],
    "Perplexity AI": ["검색·리서치", "챗봇·대화", "학생·연구자", "일반사무", "기획자·PM"],
    "Stable Diffusion": ["이미지생성", "디자인", "디자이너", "개발자", "콘텐츠크리에이터"],
    "Jasper": ["콘텐츠작성", "마케터", "콘텐츠크리에이터"],
    "Copy.ai": ["콘텐츠작성", "마케터", "콘텐츠크리에이터"],
    "Synthesia": ["비디오생성", "콘텐츠크리에이터", "마케터"],
    "Descript": ["음성·오디오", "비디오생성", "콘텐츠크리에이터"],
    "Murf AI": ["음성·오디오", "콘텐츠크리에이터", "마케터"],
    "ElevenLabs": ["음성·오디오", "콘텐츠크리에이터", "개발자"],
    "Grammarly": ["콘텐츠작성", "일반사무", "학생·연구자"],
    "Notion AI": ["생산성", "콘텐츠작성", "일반사무", "기획자·PM", "학생·연구자"],
    "Codeium": ["코딩개발", "개발자"],
    "Tabnine": ["코딩개발", "개발자"],
    "Beautiful.ai": ["생산성", "디자인", "일반사무", "기획자·PM"],
    "Canva AI": ["디자인", "이미지생성", "디자이너", "마케터", "콘텐츠크리에이터"],
    "Character.AI": ["챗봇·대화", "콘텐츠크리에이터", "일반사무"],
    "Replika": ["챗봇·대화", "일반사무", "콘텐츠크리에이터"],
    "Otter.ai": ["음성·오디오", "생산성", "일반사무", "기획자·PM"],
    "Microsoft Copilot": ["챗봇·대화", "생산성", "검색·리서치", "일반사무", "기획자·PM", "개발자"],
    "Writesonic": ["콘텐츠작성", "마케터", "콘텐츠크리에이터"],
    "QuillBot": ["콘텐츠작성", "학생·연구자", "일반사무"],
    "Tome": ["생산성", "디자인", "기획자·PM", "일반사무"],
    "Gamma": ["생산성", "디자인", "기획자·PM", "일반사무"],
    "Remove.bg": ["이미지생성", "디자인", "디자이너", "마케터", "콘텐츠크리에이터"],
    "HuggingFace": ["모델·API연동", "코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "OpenRouter": ["모델·API연동", "코딩개발", "개발자"],
    "Replicate": ["모델·API연동", "코딩개발", "개발자", "데이터과학자"],
    "Anthropic (Claude API)": ["모델·API연동", "코딩개발", "개발자"],
    "OpenAI API": ["모델·API연동", "코딩개발", "개발자"],
    "Google Cloud AI": ["모델·API연동", "데이터분석", "개발자", "데이터과학자"],
    "AWS AI Services": ["모델·API연동", "데이터분석", "개발자", "데이터과학자"],
    "Azure AI Services": ["모델·API연동", "데이터분석", "개발자", "데이터과학자"],
    "Aleph Alpha": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "Cohere": ["모델·API연동", "코딩개발", "개발자", "데이터과학자"],
    "Together AI": ["모델·API연동", "코딩개발", "개발자", "데이터과학자"],
    "LangChain": ["코딩개발", "모델·API연동", "개발자", "데이터과학자"],
    "Llama 2": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "Mistral AI": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "GPT4All": ["챗봇·대화", "모델·API연동", "개발자", "학생·연구자"],
    "Orca": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "Vicuna": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "Alpaca": ["챗봇·대화", "모델·API연동", "개발자", "학생·연구자"],
    "Falcon": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "MPT (Mosaic)": ["챗봇·대화", "모델·API연동", "개발자", "데이터과학자"],
    "Cerebras": ["모델·API연동", "데이터분석", "개발자", "데이터과학자"],
    "Scale AI": ["데이터분석", "모델·API연동", "데이터과학자", "개발자"],
    "Labelbox": ["데이터분석", "모델·API연동", "데이터과학자", "개발자"],
    "Hugging Face Spaces": ["모델·API연동", "코딩개발", "개발자", "데이터과학자"],
    "Gradio": ["코딩개발", "모델·API연동", "개발자", "데이터과학자"],
    "Streamlit": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "TensorFlow": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "PyTorch": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "Keras": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "Scikit-learn": ["데이터분석", "코딩개발", "데이터과학자", "개발자"],
    "XGBoost": ["데이터분석", "코딩개발", "데이터과학자", "개발자"],
    "LightGBM": ["데이터분석", "코딩개발", "데이터과학자", "개발자"],
    "Pandas": ["데이터분석", "코딩개발", "데이터과학자", "개발자", "학생·연구자"],
    "NumPy": ["데이터분석", "코딩개발", "데이터과학자", "개발자", "학생·연구자"],
    "Matplotlib": ["데이터분석", "코딩개발", "데이터과학자", "개발자", "학생·연구자"],
    "Jupyter": ["데이터분석", "코딩개발", "데이터과학자", "개발자", "학생·연구자"],
    "JupyterLab": ["데이터분석", "코딩개발", "데이터과학자", "개발자", "학생·연구자"],
    "MONAI": ["데이터분석", "코딩개발", "데이터과학자", "개발자", "학생·연구자"],
    "MediaPipe": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "OpenCV": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "Transformers (Hugging Face)": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "spaCy": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "NLTK": ["코딩개발", "데이터분석", "개발자", "데이터과학자", "학생·연구자"],
    "FastText": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "Rasa": ["코딩개발", "챗봇·대화", "개발자", "데이터과학자"],
    "Ray": ["코딩개발", "데이터분석", "개발자", "데이터과학자"],
    "Dask": ["데이터분석", "코딩개발", "데이터과학자", "개발자"],
    "Celery": ["코딩개발", "개발자"],
}


def main():
    with open(TOOLS_PATH, encoding="utf-8") as f:
        tools = json.load(f)
    tool_names = [t["name"] for t in tools]

    all_task = set(TASK_TAGS)
    all_prof = set(PROFESSION_TAGS)

    tags = [{"name": n, "type": "task"} for n in TASK_TAGS]
    tags += [{"name": n, "type": "profession"} for n in PROFESSION_TAGS]

    tool_tags = []
    used = set()
    errors = []

    for name in tool_names:
        if name not in MAPPING:
            errors.append(f"매핑 누락: {name}")
            continue
        tlist = MAPPING[name]
        task_part = [t for t in tlist if t in all_task]
        prof_part = [t for t in tlist if t in all_prof]
        unknown = [t for t in tlist if t not in all_task and t not in all_prof]
        if unknown:
            errors.append(f"{name}: 알 수 없는 태그 {unknown}")
        if not (1 <= len(task_part) <= 3):
            errors.append(f"{name}: task 개수 {len(task_part)} (1~3 위반)")
        if not (1 <= len(prof_part) <= 3):
            errors.append(f"{name}: profession 개수 {len(prof_part)} (1~3 위반)")
        used.update(tlist)
        tool_tags.append({"tool_name": name, "tags": tlist})

    # 매핑에 있으나 tools_data에 없는 이름(오타) 탐지
    for name in MAPPING:
        if name not in tool_names:
            errors.append(f"매핑에만 존재(도구 없음): {name}")

    seed = {"tags": tags, "tool_tags": tool_tags}
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(seed, f, ensure_ascii=False, indent=2)

    # ---- 검증 보고 ----
    tag_set = {t["name"] for t in tags}
    a = all(tg in tag_set for tt in tool_tags for tg in tt["tags"])
    b = len(tool_tags) == len(tool_names) == 78
    orphan_task = [t for t in TASK_TAGS if t not in used]
    orphan_prof = [t for t in PROFESSION_TAGS if t not in used]
    c = not orphan_task and not orphan_prof
    d = {tt["tool_name"] for tt in tool_tags} == set(tool_names)

    print("=== 검증 결과 ===")
    print(f"(a) tool_tags의 모든 태그가 tags에 존재: {a}")
    print(f"(b) 78개 도구 모두 포함: {b} (포함={len(tool_tags)})")
    print(f"(c) 고아 태그 없음: {c}  task고아={orphan_task} prof고아={orphan_prof}")
    print(f"(d) tool_name 100% 매칭: {d}")
    print(f"오류: {errors if errors else '없음'}")

    print("\n=== task별 도구 수 ===")
    for t in TASK_TAGS:
        cnt = sum(1 for tt in tool_tags if t in tt["tags"])
        print(f"  {t}: {cnt}")
    print("=== profession별 도구 수 ===")
    for p in PROFESSION_TAGS:
        cnt = sum(1 for tt in tool_tags if p in tt["tags"])
        print(f"  {p}: {cnt}")


if __name__ == "__main__":
    main()
