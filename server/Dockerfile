FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS dependencies
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
ARG SOURCE_REVISION
LABEL org.opencontainers.image.revision=$SOURCE_REVISION
ENV NODE_ENV=production PORT=8080 LEADERBOARDS_DB=/data/leaderboards.sqlite SOURCE_REVISION=$SOURCE_REVISION
WORKDIR /app
RUN printf '{"type":"module"}\n' > package.json
COPY --from=dependencies /app/server/node_modules ./server/node_modules
COPY server/package.json server/package-lock.json ./server/
COPY server/leaderboards ./server/leaderboards
COPY server/tests ./server/tests
COPY src/game/hex.js ./src/game/hex.js
COPY src/art/urls.js ./src/art/urls.js
COPY src/prototype/model-v4.js src/prototype/model.js src/prototype/magnet-influence.js src/prototype/magnet-radius.js src/prototype/difficulty.js src/prototype/levels-v4.js src/prototype/daily-catalog-v1.js src/prototype/daily-rules.js ./src/prototype/
COPY tools/fixtures/daily-v4-witnesses.json ./tools/fixtures/daily-v4-witnesses.json
USER 1000:1000
EXPOSE 8080
STOPSIGNAL SIGTERM
CMD ["node", "server/leaderboards/main.mjs"]
