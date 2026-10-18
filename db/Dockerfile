# Applies the Prisma migrations to DATABASE_URL and exits, so `make run` needs no bun on the host.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61

WORKDIR /app/db
COPY db/package.json db/bun.lock db/prisma.config.ts ./
RUN bun install --frozen-lockfile
COPY db/prisma prisma

USER bun
ENTRYPOINT ["bunx", "prisma", "migrate", "deploy"]
