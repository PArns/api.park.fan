FROM node:22

# pnpm aktivieren (ab Node 16+ ist corepack dabei)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Nur package.json & pnpm-lock.yaml kopieren für sauberes Caching
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# Rest des Codes kopieren
COPY . .

# Startbefehl
CMD ["pnpm", "start"]
