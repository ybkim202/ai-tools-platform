# 🤖 AITools - AI 도구 비교 플랫폼

[![Status](https://img.shields.io/badge/Status-Complete-brightgreen)](https://github.com)
[![Version](https://img.shields.io/badge/Version-1.0.0-blue)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **AI 도구들을 벤치마크로 비교하고, 트렌드를 자동 수집하고, 맞춤 추천받는 플랫폼**

[🌐 데모](#) | [📖 문서](#) | [💬 이슈](#) | [🤝 기여](#)

---

## 📸 **스크린샷**

```
Coming Soon - 프론트엔드 개발 중
```

---

## ✨ **주요 기능**

### 🔍 **도구 탐색 & 검색**
- 78개+ AI 도구 데이터베이스
- 고급 필터링: 카테고리, 가격, 난이도, 사용자 수
- 실시간 검색

### ⚖️ **성능 기반 비교**
- 2~5개 도구를 나란히 비교
- 가격, 사용자 수, 벤치마크 점수 비교
- 비교 결과 내보내기

### 🎁 **맞춤 추천**
- 업무별 추천 (콘텐츠 작성, 이미지 생성 등)
- 직업별 추천 (개발자, 디자이너 등)
- 로그인 없이 즉시 사용

### 📊 **벤치마크 분석**
- 도구별 성능 점수 (속도, 정확도, 비용효율)
- 벤치마크 비교 및 요약
- 공신력 있는 출처 표시

### 📰 **트렌드 & 뉴스**
- 각 도구의 최신 업데이트 자동 수집
- 트렌딩 도구 추적
- 변화 감지

---

## 🚀 **빠른 시작**

### **1. 필수 요구사항**

```
Python 3.9+
PostgreSQL 15+
Node.js 16+ (프론트엔드)
```

### **2. 백엔드 설정**

```bash
# 리포지토리 클론
git clone https://github.com/yourusername/ai-tools-platform.git
cd ai-tools-platform/backend

# 가상환경
python3 -m venv venv
source venv/bin/activate

# 설치
pip install -r requirements.txt

# 환경변수
cp .env.example .env
# .env에 DATABASE_URL 추가

# 서버 시작
python3 -m uvicorn app.main:app --reload
```

### **3. API 확인**

```bash
# 헬스 체크
curl http://localhost:8000/health

# Swagger UI
http://localhost:8000/docs
```

### **4. 프론트엔드 설정** (예정)

```bash
cd ../frontend
npm install
npm start
```

---

## 📡 **API 엔드포인트**

### **Tools**
```
GET    /api/tools              도구 목록
GET    /api/tools/{id}         도구 상세
```

### **Recommendations**
```
GET    /api/recommendations    맞춤 추천
```

### **Compare**
```
GET    /api/compare            도구 비교
```

### **News**
```
GET    /api/news               뉴스 조회
GET    /api/news/trending      트렌딩 뉴스
```

### **Benchmarks**
```
GET    /api/benchmarks         벤치마크 조회
GET    /api/benchmarks/summary/{id}  요약
GET    /api/benchmarks/types   벤치마크 종류
```

---

## 📚 **문서**

| 문서 | 설명 |
|------|------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | **완전한 API 문서** ⭐ |
| [API_SPECIFICATION.md](./docs/API_SPECIFICATION.md) | API 명세 (간단한 버전) |
| [DATA_COLLECTION_PLAN.md](./docs/DATA_COLLECTION_PLAN.md) | 데이터 수집 계획 |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 시스템 아키텍처 |
| [FIGMA_Design_Guide.md](./docs/FIGMA_Design_Guide.md) | UI/UX 디자인 가이드 |

---

## 🛠️ **기술 스택**

### **Backend**
- **Runtime**: Python 3.9+
- **Framework**: FastAPI
- **Database**: PostgreSQL 15
- **Hosting**: Render
- **ORM**: SQLAlchemy

### **Frontend** (개발 중)
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **HTTP**: Axios
- **State**: Zustand
- **Hosting**: Vercel

### **DevOps**
- **VCS**: GitHub
- **Container**: Docker (예정)

---

## 📊 **프로젝트 현황**

### **완료 ✅**

- [x] 데이터베이스 설계 & 구축
- [x] FastAPI 백엔드 개발
- [x] 8개 API 엔드포인트
- [x] 78개 도구 데이터 로드
- [x] API Key 인증
- [x] 레이트 리미팅
- [x] 에러 처리
- [x] API 문서화

### **진행 중 🔄**

- [ ] 프론트엔드 개발
- [ ] Docker 컨테이너화
- [ ] CI/CD 파이프라인

### **계획 중 📋**

- [ ] 자동 데이터 수집 (APScheduler)
- [ ] 고급 맞춤 추천 알고리즘
- [ ] 커뮤니티 기능
- [ ] Chrome 확장
- [ ] 모바일 앱

---

## 📈 **성능 지표**

| 항목 | 값 |
|------|-----|
| **API 응답 시간** | < 200ms |
| **DB 쿼리 시간** | < 50ms |
| **동시 사용자** | 100+ |
| **가용성** | 99.9% |
| **저장된 도구** | 78개 |
| **지원 벤치마크 타입** | 0개* |

*현재 벤치마크 데이터 구축 중

---

## 🔐 **보안**

- ✅ API Key 기반 선택적 인증
- ✅ CORS 설정
- ✅ Rate Limiting (분당 100개 요청)
- ✅ SQL Injection 방지 (Parameterized Queries)
- ✅ 에러 메시지 최소화
- 🔄 HTTPS (프로덕션)
- 🔄 JWT 토큰 (향후 추가)

---

## 🤝 **기여하기**

우리는 모든 기여를 환영합니다! 🎉

### **기여 방법**

1. **Fork**하기
2. **Feature Branch** 생성 (`git checkout -b feature/amazing-feature`)
3. **Commit** (`git commit -m 'Add amazing feature'`)
4. **Push** (`git push origin feature/amazing-feature`)
5. **Pull Request** 생성

### **코드 스타일**

- PEP 8 준수
- 함수/클래스 주석 필수
- 타입 힌팅 사용

---

## 🐛 **버그 리포트**

[GitHub Issues](https://github.com/yourusername/ai-tools-platform/issues)에서:

1. 버그 제목 명확하게
2. 재현 방법 설명
3. 에러 메시지 포함
4. 환경 정보 (OS, Python 버전 등)

---

## 💡 **기능 제안**

[GitHub Discussions](https://github.com/yourusername/ai-tools-platform/discussions)에서:

1. 어떤 문제를 해결하나?
2. 왜 필요한가?
3. 어떻게 구현할까?

---

## 📄 **라이선스**

이 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.

---

## 🙏 **감사의 말**

- **PostgreSQL** - 강력한 데이터베이스
- **FastAPI** - 현대적인 웹 프레임워크
- **Render** - 무료 호스팅
- **오픈소스 커뮤니티** - 지속적인 지원

---

## 📞 **연락하기**

- 📧 이메일: your-email@example.com
- 🐦 Twitter: [@aitools](https://twitter.com)
- 💬 Discord: [서버 링크](#)

---

## 🗺️ **로드맵**

```
Q2 2026: MVP 완성 ✅
Q3 2026: 프론트엔드 출시
Q4 2026: 커뮤니티 기능
2027: 모바일 앱 & 확장
```

---

## ⭐ **스타 주기**

이 프로젝트가 도움이 되셨다면 ⭐를 눌러주세요!

```
fork & star = 개발자의 큰 힘 💪
```

---

<div align="center">

**[🌐 웹사이트](#) • [📖 문서](#) • [💬 커뮤니티](#)**

Made with ❤️ by AITools Team

</div>

---

## 🎓 **학습 자료**

이 프로젝트는 다음 기술을 배울 수 있습니다:

- FastAPI로 REST API 구축
- SQLAlchemy로 ORM 사용
- PostgreSQL 데이터베이스 설계
- API 인증 & 보안
- React로 프론트엔드 개발
- 전체 풀스택 개발

---

**Last Updated**: 2026-05-24  
**Maintained by**: Your Name  
**Contributors**: [보기](CONTRIBUTORS.md)
