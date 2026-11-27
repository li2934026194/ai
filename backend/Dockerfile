FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN sed -i 's|http://deb.debian.org|https://mirrors.aliyun.com|g; s|http://security.debian.org|https://mirrors.aliyun.com|g; s|https://deb.debian.org|https://mirrors.aliyun.com|g; s|https://security.debian.org|https://mirrors.aliyun.com|g' \
      /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true && \
    apt-get update -o Acquire::Retries=10 && \
    apt-get install -y --no-install-recommends -o Acquire::Retries=10 \
      ffmpeg curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
