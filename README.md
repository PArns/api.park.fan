# Park.Fan API

Die Backend-API für Park.Fan, entwickelt mit NestJS.

## Installation

```bash
# Dependencies installieren
pnpm install

# Entwicklungsserver starten
pnpm start:dev

# Produktionsbuild
pnpm build
```

## Docker

```bash
# Image bauen
docker build -t park-fan-api .

# Container starten
docker run -p 3000:3000 park-fan-api
```

## API Endpoints

- `GET /status` - API Status
- `GET /parks` - Liste aller Parks
- `GET /parks/:id` - Park Details

## Entwicklung

- TypeScript
- NestJS
- pnpm
- Docker
