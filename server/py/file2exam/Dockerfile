FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice \
        fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    pymupdf \
    python-docx \
    charset-normalizer

EXPOSE 8000

CMD ["python", "file2exam.py", "--serve", "--host", "0.0.0.0", "--port", "8000"]
