# ── Build stage ────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build tooling
RUN pip install --no-cache-dir poetry==2.4.1

# Copy dependency manifests first (layer-cache friendly)
COPY pyproject.toml poetry.lock* ./

# Install deps into /app/.venv so we can copy just the venv to the final image
RUN poetry config virtualenvs.in-project true \
    && poetry install --no-root --without dev --no-interaction --no-ansi

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Non-root user for security
RUN addgroup --system app && adduser --system --group app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application source
COPY . .

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# k8s readiness/liveness probe port
EXPOSE 8000

USER app

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health/live')"

CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--loop", "uvloop", \
     "--http", "httptools"]
