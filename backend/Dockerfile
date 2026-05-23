FROM python:3.11-slim

WORKDIR /app

# requirements.txt 먼저 복사
COPY requirements.txt ./

# 설치
RUN pip install --no-cache-dir -r requirements.txt

# 앱 코드 복사
COPY . .

# 환경변수
ENV PYTHONUNBUFFERED=1

# 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]