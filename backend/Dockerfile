# OpsPilot AI — FastAPI backend
FROM python:3.12-slim

# System deps for PyMuPDF / Pillow wheels are bundled; keep image lean.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Persist uploads / generated graph artifacts outside the image layer.
VOLUME ["/app/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0) if urllib.request.urlopen('http://localhost:8000/health').status==200 else sys.exit(1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
