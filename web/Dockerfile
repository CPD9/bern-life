# The production web app for `make run`. Node runs it, as in CI; bun only installs from the lockfile.
# The app imports ../contracts, so the image keeps the repo layout: /app/web and /app/contracts.
FROM oven/bun:1.4.2-slim@sha256:cb3bbbb08e13a4a2ff400f24c7a2a1d5efa83f6ef8544d52d95a519631e2fc61 AS bun

FROM node:24-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app/web
COPY web/package.json web/bun.lock web/bunfig.toml ./
RUN bun install --frozen-lockfile
COPY contracts /app/contracts
COPY web ./
# Next calls each GET handler once while building, which parses the accounts env. With no session
# cookie nothing connects, so the build gets an address without credentials; compose sets the
# real one.
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=postgresql://db:5432/bernlife
RUN bun run build

FROM node:24-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Docker fills a new, empty named volume from the image's folder, owner included, so the uploads
# volume mounted here is writable by node from the start.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
WORKDIR /app/web
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY web/package.json web/bun.lock web/bunfig.toml ./
RUN bun install --frozen-lockfile --production && rm /usr/local/bin/bun
COPY --from=build /app/web/next.config.ts ./
COPY --from=build /app/web/public public
COPY --from=build --chown=node /app/web/.next .next
USER node
# 0.0.0.0 inside the container only: compose publishes the port on the host's 127.0.0.1.
ENTRYPOINT ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
