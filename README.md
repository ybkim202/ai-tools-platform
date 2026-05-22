# 🤖 AITools - 모든 AI 도구를 한곳에

> AI 도구들을 **벤치마크**로 비교하고, **트렌드**를 자동 수집하고, **맞춤 추천**받는 플랫폼

![Status](https://img.shields.io/badge/Status-Development-yellow)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📖 **목차**

1. [개요](#개요)
2. [핵심 기능](#핵심-기능)
3. [기술 스택](#기술-스택)
4. [프로젝트 구조](#프로젝트-구조)
5. [설치 방법](#설치-방법)
6. [사용 방법](#사용-방법)
7. [개발 로드맵](#개발-로드맵)
8. [기여하기](#기여하기)

---

## 🎯 **개요**

AITools는 **빠르게 변하는 AI 도구 세상을 추적하기 위한 플랫폼**입니다.

### **문제점**
- AI 도구들이 너무 많고 빨리 나옴
- 도구들을 객관적으로 비교하기 어려움
- 내 업무/직업에 맞는 도구를 찾기 힘듦
- 새로운 도구 출시를 놓치기 쉬움

### **우리의 솔루션**
- ✅ **자동 트렌드 수집**: 신규/업데이트 도구를 자동으로 감지
- ✅ **성능 기반 비교**: 벤치마크 데이터로 객관적 비교
- ✅ **맞춤 추천**: 업무별/직업별 맞춤 추천
- ✅ **포괄적 정보**: 가격, 사용자수, 성능, 기능을 한눈에

---

## ⭐ **핵심 기능**

### **1. 도구 탐색**
- 100개 이상의 인기 AI 도구
- 고급 필터링: 카테고리, 가격, 난이도, 사용자수, 국가
- 강력한 검색 기능

### **2. 성능 기반 비교**
- 2~5개 도구를 나란히 비교
- 비교 항목: 가격, 사용자수, 벤치마크 점수
- 비교 결과 다운로드/공유 가능

### **3. 트렌드 & 뉴스**
- 각 도구의 최신 업데이트 자동 수집
- AI 업계 뉴스 피드
- 주간/월간 트렌드 분석

### **4. 맞춤 추천**
- 업무별 추천: 콘텐츠작성, 이미지생성, 코딩, 분석 등
- 직업별 추천: 개발자, 디자이너, 마케터, 학생 등
- 로그인 없이도 가능

### **5. 상세 정보**
- 각 도구별 상세 페이지
- 공식 문서 및 링크
- 사용자수 데이터 (출처 & 수집일 포함)
- 벤치마크 점수 상세 (속도, 정확도, 비용효율, 사용성)

---

## 🛠️ **기술 스택**

### **Backend**
- **언어**: Python 3.9+
- **프레임워크**: FastAPI
- **DB**: PostgreSQL 15
- **자동화**: APScheduler (주 1회)
- **호스팅**: Render

### **Frontend** (개발 예정)
- **프레임워크**: React 18
- **스타일링**: Tailwind CSS
- **상태관리**: Zustand
- **호스팅**: Vercel

### **Data Collection**
- **Product Hunt API**: 도구 정보, 업보트 수
- **GitHub API**: 스타 수, 마지막 업데이트
- **Web Scraping**: BeautifulSoup, Puppeteer
- **RSS Feed**: 각 도구 블로그 추적

### **DevOps**
- **VCS**: GitHub
- **CI/CD**: GitHub Actions (예정)
- **문서**: Markdown

---

## 📂 **프로젝트 구조**

```
ai-tools-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 메인
│   │   ├── models/              # DB 모델
│   │   ├── schemas/             # Pydantic 스키마
│   │   ├── routers/             # API 엔드포인트
│   │   └── database.py          # DB 연결
│   ├── scripts/
│   │   ├── collect_ph.py        # Product Hunt 수집
│   │   ├── collect_github.py    # GitHub 수집
│   │   ├── scrape_tools.py      # 웹 크롤링
│   │   └── scheduler.py         # APScheduler
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── styles/
│   └── package.json
├── docs/
│   ├── API_SPECIFICATION.md
│   ├── DATA_COLLECTION_PLAN.md
│   └── ARCHITECTURE.md
├── .gitignore
├── README.md
└── docker-compose.yml (예정)
```

---

## 📥 **설치 방법**

### **요구사항**
- Python 3.9+
- PostgreSQL 15+
- Node.js 16+ (프론트엔드)
- Git

### **Step 1: 리포 클론**
```bash
git clone https://github.com/yourusername/ai-tools-platform.git
cd ai-tools-platform
```

### **Step 2: 백엔드 설정**

**2-1. 가상환경 생성**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
# 또는
venv\Scripts\activate  # Windows
```

**2-2. 의존성 설치**
```bash
pip install -r requirements.txt
```

**2-3. 환경변수 설정**
```bash
cp .env.example .env
# .env 파일에 DB 정보 입력
```

**2-4. DB 마이그레이션**
```bash
# Alembic (나중에 설정)
alembic upgrade head
```

**2-5. 서버 실행**
```bash
uvicorn app.main:app --reload
# http://localhost:8000
```

### **Step 3: 프론트엔드 설정** (예정)
```bash
cd ../frontend
npm install
npm start
```

---

## 🚀 **사용 방법**

### **API 사용**

**도구 목록 조회**
```bash
curl http://localhost:8000/api/tools?category=생성형AI&limit=10
```

**도구 상세 조회**
```bash
curl http://localhost:8000/api/tools/1
```

**비교하기**
```bash
curl http://localhost:8000/api/tools/compare?ids=1,2,3
```

자세한 API 명세는 [API_SPECIFICATION.md](./docs/API_SPECIFICATION.md) 참고

---

## 📊 **개발 로드맵**

### **Phase 1: MVP (1~2개월) - 진행 중** ✅
- [x] DB 설계 & 구축
- [ ] 백엔드 API 개발
- [ ] 데이터 자동화 스크립트
- [ ] 기본 프론트엔드
- [ ] 배포 및 테스트

### **Phase 2: 확장 (2~3개월)**
- [ ] 고급 맞춤 추천
- [ ] 커뮤니티 기능 (팁 공유)
- [ ] 다국어 지원
- [ ] 모바일 반응형
- [ ] 더 정교한 벤치마크

### **Phase 3: 고도화 (3개월 이후)**
- [ ] 워크플로우 시각화
- [ ] 사용자 분석 대시보드
- [ ] Chrome 확장
- [ ] 모바일 앱
- [ ] 공개 API

---

## 🤝 **기여하기**

### **버그 리포트**
GitHub Issues에서 새 issue 생성

### **기능 제안**
Discussion 탭에서 아이디어 공유

### **코드 기여**
1. Fork 하기
2. Feature branch 생성 (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

---

## 📞 **문의**

- 이메일: your-email@example.com
- GitHub Issues: [여기서 질문하기](../../issues)
- Discussions: [여기서 토론하기](../../discussions)

---

## 📄 **라이선스**

이 프로젝트는 MIT 라이선스 하에 배포됩니다. [LICENSE](./LICENSE) 파일 참고

---

## 🙏 **감사의 말**

- Product Hunt API
- GitHub API
- OpenAI, Anthropic 공식 벤치마크
- 커뮤니티 피드백

---

**Made with ❤️ by AITools Team**
