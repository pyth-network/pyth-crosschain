FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
COPY proto ./proto

RUN pip install --no-cache-dir .

CMD ["python", "-m", "hyperliquid_recorder.main"]
