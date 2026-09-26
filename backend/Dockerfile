FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_APP=wsgi.py

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN useradd --create-home --uid 1000 app && chmod +x entrypoint.sh
USER app

EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--access-logfile", "-", "wsgi:app"]
