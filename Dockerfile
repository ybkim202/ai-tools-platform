FROM python:3.11-slim

WORKDIR /app

# backend 폴더에서 requirements.txt 복사
COPY backend/requirements.txt .

# 설치
RUN pip install --no-cache-dir -r requirements.txt

# backend 앱 코드 복사
COPY backend/app ./app

# 환경변수
ENV PYTHONUNBUFFERED=1

# 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]