#!/usr/bin/env bash
# Builds (first run only) and starts ThaiTeX inside a GitHub Codespace.
# Log: thai/codespace-start.log
set -euo pipefail
cd "$(dirname "$0")/.."
exec > >(tee -a thai/codespace-start.log) 2>&1

until docker info >/dev/null 2>&1; do sleep 2; done

# Codespaces disk is small, so use a reduced TeX Live (Thai + common packages)
if ! docker image inspect thaitex/sharelatex-base:latest >/dev/null 2>&1; then
  echo "== building base image (TeX Live + Thai fonts), first run takes a while"
  cp server-ce/.dockerignore .
  docker build -f server-ce/Dockerfile-base \
    --build-arg TEXLIVE_SCHEME=scheme-medium \
    -t thaitex/sharelatex-base:latest .
fi

if ! docker image inspect thaitex/sharelatex:latest >/dev/null 2>&1; then
  echo "== building ThaiTeX app image"
  docker build -f server-ce/Dockerfile \
    --build-arg OVERLEAF_BASE_TAG=thaitex/sharelatex-base:latest \
    -t thaitex/sharelatex:latest .
fi

if [ -n "${CODESPACE_NAME:-}" ]; then
  export OVERLEAF_SITE_URL="https://${CODESPACE_NAME}-80.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi

docker compose -f thai/docker-compose.yml up -d
echo "== ThaiTeX is starting: ${OVERLEAF_SITE_URL:-http://localhost}/launchpad"
