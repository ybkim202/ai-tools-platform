FROM python:3.11-slim

WORKDIR /app

# Copy requirements (backend 폴더에 있으니까)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app ./app

# Set environment
ENV PYTHONUNBUFFERED=1

# Run the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]