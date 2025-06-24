# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
RUN pnpm run build

# Stage 2: Production
FROM node:24-alpine
WORKDIR /app
RUN corepack enable \
  && apk add --no-cache curl
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod
COPY --from=builder /app/dist ./dist
# Copy documentation and API specification files
COPY README.md ./
COPY openapi.yaml ./
ENV NODE_ENV=production
CMD ["node", "dist/main"]
