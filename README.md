# Park.Fan API

A readonly public API for theme park wait times, built with NestJS. This API provides access to theme park data including parks, theme areas, rides, and real-time queue times.

## Features

- **Parks Management**: Comprehensive readonly API for theme park data
- **Real-time Queue Times**: Background processing of queue times from queue-times.com
- **Advanced Filtering**: Search, pagination, and filtering by country, continent, and park group
- **Statistics**: Detailed statistics about parks, theme areas, rides, and queue times
- **Geographic Data**: Countries and continents endpoints for geographic filtering

## API Endpoints

### Parks
- `GET /parks` - List all parks with optional filtering and pagination
- `GET /parks/:id` - Get a specific park by ID
- `GET /parks/statistics` - Get comprehensive statistics
- `GET /parks/countries` - Get all countries that have parks
- `GET /parks/continents` - Get all continents that have parks

### Queue Times
- `GET /parks/queue-times/statistics` - Get queue times statistics

### System Status
- `GET /status` - Check system health and status

## Query Parameters

### Parks Filtering
- `search` - Search parks by name or country
- `country` - Filter by specific country
- `continent` - Filter by specific continent
- `parkGroupId` - Filter by park group
- `page` - Page number for pagination (default: 1)
- `limit` - Results per page (default: 10)

## Data Statistics

Current database contains:
- **133 Parks** across 19 countries and 4 continents
- **422 Theme Areas** with detailed organization
- **2,683 Rides** with real-time queue data
- **13,710+ Queue Time Entries** with 97.08% duplicate prevention rate

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
