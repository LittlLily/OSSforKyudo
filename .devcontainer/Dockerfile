FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

# pnpm は Corepack 経由で使う
RUN corepack enable

# よく使う基本ツール
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
