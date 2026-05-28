# syntax=docker/dockerfile:1

# --- Build stage: install deps, generate Prisma client, compile TS -> dist ---
FROM node:20-slim AS build
WORKDIR /app

# Prisma needs OpenSSL to detect its query-engine target at generate time.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching). No lockfile is copied because
# the workspace lockfile lives at the repo root; this package's package.json is
# self-contained, so a plain install resolves everything it needs.
COPY package.json ./
RUN npm install

# Copy the schema before generating the client, then the rest of the source.
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage: slim image with compiled output + prod-needed node_modules ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring over the full node_modules (includes the generated Prisma client and the
# Prisma CLI, which the entrypoint uses to apply migrations on startup).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
