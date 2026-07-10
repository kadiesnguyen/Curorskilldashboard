FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
  && pip3 install --no-cache-dir --break-system-packages qdrant-client fastembed \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server.mjs ./
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts
COPY config ./config
COPY data/store.example.json data/store.docker.example.json ./data/
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x docker/entrypoint.sh scripts/mem0_add.py scripts/start.sh

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV CUROR_SKILL_DASHBOARD_PORT=3847
ENV MEM0_QDRANT_HOST=qdrant
ENV MEM0_QDRANT_PORT=6333

EXPOSE 3847

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["node", "server.mjs"]
