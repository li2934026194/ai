#!/usr/bin/env bash
set -euo pipefail

PROFILE_ARGS=""
if [[ "${ENABLE_VECTOR:-false}" == "true" ]]; then
  PROFILE_ARGS="$PROFILE_ARGS --profile vector"
fi
if [[ "${ENABLE_WORKER:-false}" == "true" ]]; then
  PROFILE_ARGS="$PROFILE_ARGS --profile worker"
fi
if [[ "${ENABLE_APP:-false}" == "true" ]]; then
  PROFILE_ARGS="$PROFILE_ARGS --profile app"
fi

echo "[CrossPilot] Starting infrastructure stack..."
docker compose $PROFILE_ARGS up -d --build

echo "[CrossPilot] Waiting for PostgreSQL health..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U crosspilot -d crosspilot >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[CrossPilot] Stack ready."
