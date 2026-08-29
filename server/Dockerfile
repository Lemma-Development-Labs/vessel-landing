# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# Drop dev dependencies so they are not carried into the runtime image.
RUN pnpm prune --prod

# ---- runtime --------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# node:20-slim ships an unprivileged `node` user; do not run as root.
USER node

EXPOSE 8080
CMD ["node", "dist/index.js"]
