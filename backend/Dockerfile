FROM python:3.11-slim

WORKDIR /app

# 현재 backend 폴더의 requirements.txt 복사
COPY . .

# 설치
RUN pip install --no-cache-dir -r requirements.txt

# 환경변수
ENV PYTHONUNBUFFERED=1

# 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]