# 📊 데이터 수집 계획

**작성일**: 2024-05-21  
**담당자**: 자동화 스크립트 (Python)  
**실행 주기**: 주 1회 (매주 월요일 00:00 UTC)

---

## 📋 **목차**

1. [개요](#개요)
2. [데이터 소스](#데이터-소스)
3. [수집 파이프라인](#수집-파이프라인)
4. [Product Hunt API](#product-hunt-api)
5. [GitHub API](#github-api)
6. [웹 크롤링](#웹-크롤링)
7. [에러 처리](#에러-처리)
8. [스케줄링](#스케줄링)

---

## 🎯 **개요**

### **목표**
- 100개 AI 도구의 정보를 자동으로 수집 및 업데이트
- 신규 도구 감지
- 벤치마크 및 사용자 수 데이터 추적

### **수집 데이터**
- 도구명, 로고, 설명
- 사용자 수 (Product Hunt, 공식 발표)
- 벤치마크 점수 (공식 문서, 커뮤니티)
- 가격 정보
- 뉴스/업데이트 소식
- GitHub 메트릭 (해당하는 도구의 경우)

---

## 🔗 **데이터 소스**

### **1순위: 공식 발표**
- 각 도구의 공식 블로그
- 보도 자료
- 신뢰도: ⭐⭐⭐⭐⭐

### **2순위: Product Hunt API**
- 도구 정보
- 업보트 수
- 사용자 코멘트
- 신뢰도: ⭐⭐⭐⭐

### **3순위: GitHub API**
- 스타 수
- 마지막 커밋
- 프로그래밍 언어
- 신뢰도: ⭐⭐⭐⭐ (오픈소스만)

### **4순위: 웹 크롤링**
- 공식 웹사이트 (사용자 수, 가격, 기능)
- RSS 피드 (뉴스)
- 신뢰도: ⭐⭐⭐

### **5순위: 커뮤니티**
- Reddit 언급
- Twitter 언급
- HackerNews
- 신뢰도: ⭐⭐

---

## 🔄 **수집 파이프라인**

```
START (매주 월요일 00:00)
    ↓
[1] Product Hunt API 수집
    ├─ 100개 도구 업데이트
    └─ 신규 도구 감지
    ↓
[2] GitHub API 수집
    ├─ 오픈소스 도구의 스타 수
    └─ 마지막 업데이트 확인
    ↓
[3] 웹 크롤링
    ├─ 공식 웹사이트 (가격, 사용자수)
    └─ RSS 피드 (뉴스)
    ↓
[4] 벤치마크 데이터 검색
    ├─ 공식 문서
    └─ 커뮤니티 벤치마크
    ↓
[5] DB 업데이트
    ├─ 중복 확인
    ├─ 데이터 검증
    └─ 저장
    ↓
[6] 로깅 & 모니터링
    ├─ 성공/실패 로그
    └─ 슬랙 알림
    ↓
END
```

---

## 🎯 **Product Hunt API**

### **API 정보**
- **Endpoint**: `https://api.producthunt.com/v2/api/graphql`
- **인증**: Bearer Token (API Key 필요)
- **Rate Limit**: 충분함 (월 100,000 요청)

### **필요한 API Key 획득**
1. https://www.producthunt.com/ 가입
2. Settings → Accounts → API
3. Personal Token 생성 (유효기간 무제한)

### **수집할 데이터**

```graphql
{
  posts(first: 50, after: "cursor") {
    edges {
      node {
        id
        name
        tagline
        website
        thumbnail
        # User count (comments나 upvotes로 추정)
        votesCount
        commentsCount
      }
    }
  }
}
```

### **파이썬 코드 예시**

```python
import requests
from datetime import datetime

class ProductHuntCollector:
    def __init__(self, api_token):
        self.api_token = api_token
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
    def fetch_tools(self, limit=100):
        """Product Hunt에서 상위 도구 수집"""
        query = """
        {
          posts(first: %d, order: RANKING) {
            edges {
              node {
                id
                name
                tagline
                website
                thumbnail {
                  url
                }
                votesCount
                createdAt
              }
            }
          }
        }
        """ % limit
        
        response = requests.post(
            "https://api.producthunt.com/v2/api/graphql",
            json={"query": query},
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()["data"]["posts"]["edges"]
        else:
            raise Exception(f"API Error: {response.status_code}")
    
    def save_to_db(self, tools, db_connection):
        """DB에 저장"""
        for tool in tools:
            node = tool["node"]
            # 중복 확인
            existing = db_connection.query(
                "SELECT id FROM tools WHERE name = %s",
                (node["name"],)
            )
            
            if existing:
                # 업데이트
                db_connection.execute(
                    """UPDATE tools 
                       SET user_count = %s, 
                           user_count_date = %s
                       WHERE name = %s""",
                    (node["votesCount"], datetime.now(), node["name"])
                )
            else:
                # 삽입
                db_connection.execute(
                    """INSERT INTO tools 
                       (name, logo_url, official_url, 
                        user_count, user_count_source, 
                        user_count_date)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (node["name"], node["thumbnail"]["url"], 
                     node["website"], node["votesCount"],
                     "Product Hunt", datetime.now())
                )
```

---

## 🐙 **GitHub API**

### **API 정보**
- **Endpoint**: `https://api.github.com`
- **인증**: Personal Token (Settings → Developer settings)
- **Rate Limit**: 60 req/hour (인증), 10,000 req/hour (토큰)

### **필요한 Token 획득**
1. GitHub → Settings → Developer settings → Personal access tokens
2. New token 생성 (public_repo 권한만 필요)

### **수집할 데이터**

```graphql
repository(owner: "owner", name: "repo") {
  stargazerCount
  pushedAt
  primaryLanguage {
    name
  }
  description
  url
}
```

### **파이썬 코드 예시**

```python
import requests

class GitHubCollector:
    def __init__(self, github_token):
        self.token = github_token
        self.headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
    
    def fetch_repo_stats(self, owner, repo):
        """GitHub 리포 통계 수집"""
        url = f"https://api.github.com/repos/{owner}/{repo}"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "stars": data["stargazers_count"],
                "last_push": data["pushed_at"],
                "language": data["language"],
                "url": data["html_url"]
            }
        else:
            return None
    
    def update_benchmark(self, tool_id, stars, db_connection):
        """GitHub 스타를 벤치마크로 저장"""
        if stars:
            db_connection.execute(
                """INSERT INTO benchmarks 
                   (tool_id, benchmark_type, score, source)
                   VALUES (%s, %s, %s, %s)""",
                (tool_id, "GitHub Stars", 
                 min(100, stars // 1000), "GitHub API")
            )
```

---

## 🔥 **GitHub Trending (구현됨)**

`/api/trends/github` 의 데이터 소스. 위 GitHub 릴리스 수집(news 적재)과 별개로, **독립
`github_trending` 테이블**을 채우는 수집기다(`collectors/github_trending.py`).

### **트렌딩 정의(v1)**
- 최근 생성(`weekly`=7일 / `monthly`=30일 내 `created`) + 별점 내림차순.
- 오래된 인기 레포(예: PyTorch)는 포함하지 않는다. velocity(별점 증가율)는 v2 로 보류.

### **수집 방식**
- **엔드포인트**: `GET https://api.github.com/search/repositories?q=topic:{topic} created:>={기간시작} stars:>={임계값}&sort=stars&order=desc&per_page=N`
- **토픽 다중 질의**: `ai, llm, machine-learning, generative-ai, agents, rag, stable-diffusion, deep-learning` 를 각각 질의하고 `repo_full_name` 기준으로 병합·중복제거(별점 큰 쪽 유지).
- **별점 임계값**(env 오버라이드): `GITHUB_TRENDING_MIN_STARS_WEEKLY`(기본 10), `GITHUB_TRENDING_MIN_STARS_MONTHLY`(기본 50).
- **적재 개수**: period 별 별점 상위 약 60개(`rank` 1=최고).
- **토큰**: `GITHUB_TOKEN` 있으면 인증(Search 레이트 10→30/min), 없어도 동작. 토큰은 로그에 남기지 않는다(헌법 G9).
- **번역**: `description` → `description_ko`(무료 MyMemory, 키 불필요). 실패 시 `null`(원문 유지).

### **멱등 교체**
- 수집 성공 시 해당 `period` 의 기존 행을 모두 삭제하고 새 결과로 교체(단일 트랜잭션).
- period 단위 에러 격리: 한 period 실패가 다른 period 를 막지 않는다.
- `UNIQUE(repo_full_name, period)` 제약으로 같은 레포/기간은 1행만 유지.

### **주제(테마) 매핑**
- `trends_themes.py`(단일 정본)가 GitHub `topics` → 큐레이션 테마(`agent`/`rag`/`local-llm`/`image`/`voice`/`finetune`/`mlops`)로 매핑. 라우터가 응답 `themes[]` 에 임베드(별도 엔드포인트 없음).

### **등록/실행**
- `collectors/base.py` 의 `_load_collectors()` 에 `github_trending` 등록 → `collect.py`(수동 1회)·`scheduler.py`(주기)에 자동 포함.
- `cd backend && DATABASE_URL=... [GITHUB_TOKEN=...] python collect.py` 로 초기 적재.
- **선행 조건**: `github_trending` 테이블이 먼저 존재해야 한다(아래 마이그레이션 메모 참조).

---

## 🌐 **웹 크롤링**

### **라이브러리**
- BeautifulSoup4: HTML 파싱
- Selenium: JavaScript 렌더링 필요 시
- Requests: HTTP 요청

### **크롤링 대상**

| 도구 | URL | 데이터 |
|------|-----|--------|
| ChatGPT | openai.com | 사용자수, 가격 |
| Claude | anthropic.com | 가격, 모델 정보 |
| DALL-E | openai.com | 가격, 사용량 제한 |
| Midjourney | midjourney.com | 가격, 대기열 정보 |

### **파이썬 코드 예시**

```python
from bs4 import BeautifulSoup
import requests
import re

class WebScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 ..."
        })
    
    def scrape_pricing(self, url):
        """가격 정보 크롤링"""
        try:
            response = self.session.get(url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 가격 찾기 (도구별로 다름)
            price_pattern = r'\$(\d+)'
            text = soup.get_text()
            prices = re.findall(price_pattern, text)
            
            return prices
        except Exception as e:
            print(f"Scraping error: {e}")
            return None
    
    def scrape_user_count(self, url):
        """사용자 수 크롤링"""
        try:
            response = self.session.get(url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 사용자 수 찾기
            # 예: "1,000,000+ users"
            user_pattern = r'([\d,]+)\+?\s*users'
            text = soup.get_text()
            match = re.search(user_pattern, text, re.IGNORECASE)
            
            if match:
                return int(match.group(1).replace(',', ''))
            return None
        except Exception as e:
            print(f"Scraping error: {e}")
            return None
    
    def scrape_rss_feed(self, feed_url):
        """RSS 피드에서 뉴스 수집"""
        import feedparser
        
        try:
            feed = feedparser.parse(feed_url)
            news = []
            
            for entry in feed.entries[:5]:  # 최근 5개
                news.append({
                    "title": entry.title,
                    "summary": entry.summary,
                    "link": entry.link,
                    "published": entry.published
                })
            
            return news
        except Exception as e:
            print(f"RSS parsing error: {e}")
            return None
```

---

## 🛡️ **에러 처리**

### **재시도 로직**

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=10))
def fetch_with_retry(url):
    response = requests.get(url)
    response.raise_for_status()
    return response
```

### **로깅**

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/data_collection.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 사용
logger.info(f"Successfully collected data for {tool_name}")
logger.error(f"Failed to collect data: {error}")
```

### **Slack 알림**

```python
import slack

def notify_slack(status, message):
    client = slack.WebClient(token=os.environ.get('SLACK_TOKEN'))
    emoji = "✅" if status == "success" else "❌"
    
    client.chat_postMessage(
        channel="#data-collection",
        text=f"{emoji} {message}"
    )
```

---

## ⏰ **스케줄링**

### **APScheduler 설정**

```python
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

def scheduled_collection():
    """주간 데이터 수집"""
    logger.info("Starting data collection...")
    
    try:
        # 1. Product Hunt 수집
        ph = ProductHuntCollector(API_KEY)
        tools = ph.fetch_tools(100)
        
        # 2. GitHub 수집
        gh = GitHubCollector(GH_TOKEN)
        
        # 3. 웹 크롤링
        scraper = WebScraper()
        
        # 4. DB 업데이트
        # ... (DB 업데이트 로직)
        
        notify_slack("success", 
                    f"Data collection completed at {datetime.now()}")
        logger.info("Data collection completed")
        
    except Exception as e:
        notify_slack("error", 
                    f"Data collection failed: {str(e)}")
        logger.error(f"Collection error: {e}", exc_info=True)

# 스케줄러 설정
scheduler = BackgroundScheduler()
scheduler.add_job(
    scheduled_collection,
    'cron',
    day_of_week='mon',  # 매주 월요일
    hour=0,
    minute=0,
    timezone='UTC'
)
scheduler.start()
```

### **수동 실행**

```bash
# 스크립트 직접 실행
python scripts/collect_data.py

# 또는 Docker에서
docker run ai-tools-collector python scripts/collect_data.py
```

---

## 📈 **모니터링**

### **수집 통계**

```python
def log_statistics():
    """수집 통계 기록"""
    total_tools = db.count("SELECT COUNT(*) FROM tools")
    updated_today = db.count(
        "SELECT COUNT(*) FROM tools WHERE updated_at = TODAY()"
    )
    
    logger.info(f"Total tools: {total_tools}")
    logger.info(f"Updated today: {updated_today}")
```

### **데이터 품질 검사**

```python
def validate_data():
    """데이터 품질 검증"""
    # 필드 없음 체크
    missing = db.query(
        "SELECT COUNT(*) FROM tools WHERE user_count IS NULL"
    )
    
    # 이상치 탐지
    outliers = db.query(
        """SELECT COUNT(*) FROM benchmarks 
           WHERE score NOT BETWEEN 0 AND 100"""
    )
    
    logger.info(f"Missing user_count: {missing}")
    logger.info(f"Invalid benchmark scores: {outliers}")
```

---

## 📋 **체크리스트**

- [ ] Product Hunt API Key 획득
- [ ] GitHub Personal Token 획득
- [ ] Slack Webhook URL 설정
- [ ] 크롤링 대상 URL 목록 작성
- [ ] APScheduler 설정 완료
- [ ] 에러 처리 테스트
- [ ] 로깅 시스템 테스트
- [ ] 첫 수동 실행 테스트
- [ ] 일주일 동안 모니터링

---

**마지막 업데이트**: 2024-05-21  
**다음 검토**: 첫 수집 후 1주일
