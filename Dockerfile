# Build do front-end e do back-end, depois imagem final enxuta
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package*.json server/
COPY client/package*.json client/
RUN npm --prefix server ci && npm --prefix client ci
COPY server server
COPY client client
RUN npm --prefix client run build && npm --prefix server run build && npm --prefix server prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3333 DATABASE_PATH=/data/operis.db TZ=America/Sao_Paulo
WORKDIR /app/server
COPY --from=build /app/server/node_modules node_modules
COPY --from=build /app/server/dist dist
COPY --from=build /app/server/package.json package.json
COPY --from=build /app/client/dist /app/client/dist
VOLUME /data
EXPOSE 3333
CMD ["node", "dist/index.js"]
