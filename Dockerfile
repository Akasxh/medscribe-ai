# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Supabase public keys — baked into the JS bundle at build time by Vite
ENV VITE_SUPABASE_URL=https://giiazikyvdtyixjzcaix.supabase.co
ENV VITE_SUPABASE_ANON_KEY=sb_publishable_2WlK76rcEgU0Q-AOFmRqcg_dkFE0ovx
ENV VITE_ADMIN_EMAIL=jhmedvani2026@gmail.com

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Cache buster — change this value to force a fresh frontend build
ARG CACHEBUST=3
RUN npm run build

# Stage 2: Python backend + serve frontend
FROM python:3.12-slim
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./static

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
