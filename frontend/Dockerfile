# syntax=docker/dockerfile:1

# --- Build stage: produce the static SPA bundle ---
FROM node:20-slim AS build
WORKDIR /app

# Same-origin by default: the bundle calls "/api/..." and nginx proxies it to the
# backend, so no host/port is baked in. (api.ts: `VITE_API_URL ?? "..."` keeps an
# empty string, so "" means "relative to wherever the app is served".)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Runtime stage: serve the static files with nginx + proxy /api ---
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
