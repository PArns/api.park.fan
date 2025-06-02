# Build Stage
FROM node:22 AS builder

# Shell und pnpm konfigurieren
ENV SHELL=/bin/bash
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && \
    corepack prepare pnpm@latest --activate && \
    pnpm add -g @nestjs/cli

WORKDIR /app

# Nur package.json & pnpm-lock.yaml kopieren für sauberes Caching
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Production Stage
FROM node:20-alpine AS production

# Shell und pnpm konfigurieren
ENV SHELL=/bin/sh
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN apk add --no-cache bash && \
    corepack enable && \
    corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/main"]
