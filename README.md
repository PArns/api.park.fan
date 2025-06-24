# 🎢 Park.Fan API

The ultimate REST API for theme park data, ride information, and real-time queu| `REDIS_HOST` | Redis Server Host | `localhost` | ✅ |
| `REDIS_PORT` | Redis Server Port | `6379` | ✅ |
| `REDIS_PASSWORD` | Redis Password | `""` | ✅ |
| `REDIS_USER` | Redis Username | `""` | ❌ |
| `PARK_OPEN_THRESHOLD_PERCENT` | Park "open" threshold (0-100%) | `50` | ❌ |mes! 🚀

Built with **NestJS** and **TypeScript** - a high-performance, modern API providing comprehensive access to detailed information about theme parks worldwide, including their attractions and current wait times.

## ✨ Features - What Makes This API Awesome

- **🏰 Theme Parks**: Complete park information with geographic organization
- **🎠 Rides & Attractions**: Detailed ride data organized by theme areas
- **⏱️ Live Wait Times**: Real-time queue times with intelligent status detection
- **🎯 Intelligent Park Status**: Automatic detection of whether parks are "open" or "closed"
- **🌡️ Crowd Level Intelligence**: AI-driven park congestion analysis with historical context
- **🌤️ Live Weather Data**: Current conditions and 7-day forecasts for each park location
- **📊 Advanced Statistics**: Comprehensive analytics with geographical breakdowns and hierarchical URLs
- **🔍 Smart Search & Filter**: Multi-criteria search across parks, rides, and locations
- **🌍 Global Coverage**: Parks across multiple continents and countries
- **📱 RESTful Design**: Clean, intuitive API endpoints with consistent responses
- **🔄 Automatic Updates**: Scheduled queue time synchronization from external sources
- **📈 Performance-Optimized**: Built for high throughput with efficient data structures
- **🏁 Top Lists**: Longest/shortest wait times, busiest/quietest parks with navigation URLs
- **⚡ Optimized Caching**: API responses include cache headers with 5-minute TTL for improved performance
- **🗺️ Hierarchical Navigation**: Every park and ride includes navigable hierarchical URLs

## 📊 Data Source

This API integrates with **[queue-times.com](https://queue-times.com)** to provide reliable and up-to-date information about theme park wait times and attraction data from around the world.

## 🌐 Live API

Experience the API live at **[https://api.park.fan](https://api.park.fan)** - test it with real theme park data and interactive documentation! 🎯

## 🚀 Quick Start - How to Get Going Fast!

### Prerequisites

- **Node.js** v20.0.0 or higher 💚
- **pnpm** package manager (recommended) 📦
- **PostgreSQL** database (v12 or higher) 🐘
- **Redis** server (v6 or higher) 🚀

### Installation & Setup

```bash
# Clone the repository
git clone <repository-url>
cd api.park.fan

# Install dependencies (pnpm is super fast!)
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database and Redis credentials
```

### Database Setup - It Couldn't Be Easier!

The API creates the database automatically! Just ensure PostgreSQL and Redis are running:

```bash
# The application automatically:
# 1. 🔌 Connects to PostgreSQL and Redis
# 2. 🏗️ Creates database if it doesn't exist
# 3. 🚀 Executes migrations automatically
# 4. 📡 Starts data synchronization
# 5. ⚡ Initializes Redis cache for performance optimization
```

### Starting the API - Let's Go! 🚀

```bash
# Development Mode with Hot Reload (for development)
pnpm run start:dev

# Production Build and Start
pnpm run build
pnpm run start:prod

# Debug Mode (for troubleshooting)
pnpm run start:debug
```

🎯 **API Ready!** Go to `http://localhost:3000` for interactive documentation

## ⚙️ Configuration - Make It Your Own!

Configure the API using environment variables in your `.env` file:

### Important Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL Database Host | `localhost` | ✅ |
| `DB_PORT` | PostgreSQL Database Port | `5432` | ✅ |
| `DB_USER` | PostgreSQL Username | `postgres` | ✅ |
| `DB_PASS` | PostgreSQL Password | `postgres` | ✅ |
| `DB_NAME` | PostgreSQL Database Name | `parkfan` | ✅ |
| `REDIS_HOST` | Redis Server Host | `localhost` | ✅ |
| `REDIS_PORT` | Redis Server Port | `6379` | ✅ |
| `REDIS_PASSWORD` | Redis Password | `""` | ✅ |
| `PARK_OPEN_THRESHOLD_PERCENT` | Park "open" threshold (0-100%) | `50` | ❌ |

## 🚀 Performance & Caching Strategy

The API leverages a sophisticated multi-layer caching strategy powered by **Redis** for optimal performance:

### 🔥 Redis-Powered Features

- **⚡ Crowd Level Optimization**: Historical baselines and confidence calculations are cached with daily granularity
- **🌤️ Weather Data Caching**: Smart caching prevents redundant API calls to weather services
- **📊 Statistical Computations**: Complex analytics cached for fast retrieval
- **🎯 Cache TTL Management**: Intelligent time-to-live settings balance freshness with performance

### 🎛️ Cache Configuration

- **Historical Baselines**: 4-hour TTL with daily cache keys
- **Confidence Scores**: 4-hour TTL optimized per ride combination
- **Weather Data**: Park-specific caching with automatic refresh
- **API Responses**: 5-minute cache headers for client-side optimization

**Performance Benefits:**
- 🚀 Sub-second response times for complex calculations
- 📈 Reduced database load by up to 80%
- ⚡ Instant crowd level analysis without real-time computation
- 🌍 Scalable architecture supporting high concurrent loads

## 🎯 Core Features

### 🏰 Park Operating Status Logic

The **Park Operating Status** feature intelligently determines whether a park is "open" or "closed":

- **🎯 Threshold-based**: Parks are considered "open" when ≥ X% of rides are currently operating
- **⚙️ Default**: 50% threshold (configurable via environment variable or API parameter)
- **⚡ Real-time**: Based on current wait time data and ride operational status
- **🔧 Flexible**: Override per request with `?openThreshold=X` parameter

**Examples:**
```bash
# Use standard 50% threshold
GET /statistics

# Custom 75% threshold for stricter "open" definition
GET /statistics?openThreshold=75

# Relaxed 25% threshold
GET /parks?openThreshold=25
```

### 🌡️ Crowd Level Intelligence

The **Crowd Level** feature provides intelligent real-time park congestion analysis:

- **📊 Smart Calculation**: Based on top 30% of rides with highest wait times
- **📈 Historical Context**: Compares current levels to 2-year rolling average (95th percentile)
- **🎯 Confidence Scoring**: Data quality assessment for reliable predictions
- **⚡ Performance Optimized**: Optional calculation for faster API responses
- **🚀 Redis-Powered Caching**: Historical baselines and confidence scores cached for optimal performance

**Crowd Level Scale:**
- **0-30%**: 🟢 Very Low - Perfect time to visit!
- **30-60%**: 🟡 Low - Good conditions
- **60-120%**: 🟠 Moderate - Normal busy levels
- **120-160%**: 🔴 High - Expect longer waits
- **160-200%**: 🔴 Very High - Very crowded
- **200%+**: ⚫ Extreme - Exceptionally busy

**Configuration:**
```bash
# Include crowd level (default)
GET /parks?includeCrowdLevel=true

# Skip crowd level for faster response
GET /parks?includeCrowdLevel=false
```

### 🌤️ Live Weather Data

Provides current weather conditions and 7-day forecasts for each park location:

- **🌡️ Current & Forecast**: Real-time conditions and 7-day weather forecasts
- **🌧️ Precipitation Data**: Chance of rain and temperature ranges
- **🎯 Weather Score**: AI-powered weather quality rating (0-100%) for theme park visits
- **📅 Date-Stamped**: Each forecast includes the exact date (UTC format)
- **⚡ Performance-Optimized**: Optional inclusion for faster API responses

**Configuration:**
```bash
# Include weather data (default)
GET /parks?includeWeather=true

# Skip weather data for faster response
GET /parks?includeWeather=false
```

**Data Source:** Powered by [Open-Meteo API](https://open-meteo.com) with global coverage and WMO standard weather codes.

## 🎯 API Endpoints - Where the Magic Happens!

### 🏠 Home & Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | 📖 Interactive API documentation (HTML) - Beautifully formatted! |
| `GET` | `/readme` | 📄 Raw documentation (Markdown) |
| `GET` | `/openapi.yaml` | 📋 OpenAPI 3.0.3 specification (YAML) |

> 💡 **Pro Tip**: Import the OpenAPI specification into tools like [Postman](https://www.postman.com/), [Insomnia](https://insomnia.rest/), or [Swagger Editor](https://editor.swagger.io/) for interactive API testing!

### 🏰 Parks - The Theme Parks!

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parks` | 🌟 All parks with advanced filters & pagination |
| `GET` | `/parks/:id` | 🎯 Specific park with all ride details |
| `GET` | `/parks/:id/rides` | 🎠 All rides for a specific park |

### 🗺️ Hierarchical Routes - Navigate by Location!

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parks/:continent` | 🌍 All parks in a continent |
| `GET` | `/parks/:continent/:country` | 🇩🇪 All parks in a country |
| `GET` | `/parks/:continent/:country/:park` | 🏰 Access park via hierarchical path |
| `GET` | `/parks/:continent/:country/:park/:ride` | 🎢 Access ride via hierarchical path |

**Smart Routing:**
- Numeric IDs are automatically detected (e.g., `/parks/30` → Park by ID)
- String parameters are treated as hierarchical paths
- Full backward compatibility maintained

**URL Transformation Rules:**
- Spaces replaced with hyphens (`-`)
- Dots (`.`) removed entirely
- All lowercase
- Special characters removed

**Examples:**
- All European parks → `/parks/europe`
- All German parks → `/parks/europe/germany`
- `Phantasialand` → `/parks/europe/germany/phantasialand`
- `Europa Park` → `/parks/europe/germany/europa-park`
- `Islands Of Adventure At Universal Orlando` → `/parks/north-america/united-states/islands-of-adventure-at-universal-orlando`
- `Taron` ride → `/parks/europe/germany/phantasialand/taron`

### 🎠 Rides - The Attractions!

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rides` | 🔍 All rides with filtering & search |
| `GET` | `/rides/:id` | 🎯 Specific ride with current queue status |

### 📊 Statistics & Analytics - The Insights!

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/statistics` | 📈 Comprehensive statistics with geographic breakdowns |

### 🌍 Geographic Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/countries` | 🇩🇪 All countries with park counts |
| `GET` | `/continents` | 🌎 All continents with park counts |

### ⚡ System Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | 💚 API health check and system information |

## 🔍 Query Parameters & Filtering - Find Exactly What You Want!

### 🏰 Parks Filtering (`/parks`)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | `string` | Search by park name or country | `?search=Disney` |
| `country` | `string` | Filter by specific country | `?country=Germany` |
| `continent` | `string` | Filter by continent | `?continent=Europe` |
| `parkGroupId` | `number` | Filter by park group | `?parkGroupId=1` |
| `openThreshold` | `number` | Operational status threshold (0-100) | `?openThreshold=75` |
| `includeCrowdLevel` | `boolean` | Include crowd level calculation | `?includeCrowdLevel=false` |
| `includeWeather` | `boolean` | Include live weather data | `?includeWeather=false` |
| `page` | `number` | Page number (≥1) | `?page=2` |
| `limit` | `number` | Results per page (max 100) | `?limit=20` |

### 🎠 Rides Filtering (`/rides`)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | `string` | Search by ride name | `?search=coaster` |
| `parkId` | `number` | Filter by specific park | `?parkId=25` |
| `isActive` | `boolean` | Filter by operational status | `?isActive=true` |
| `page` | `number` | Page number (≥1) | `?page=3` |
| `limit` | `number` | Results per page (max 100) | `?limit=50` |

### 📊 Statistics Parameters (`/statistics`)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `openThreshold` | `number` | Park operational threshold (0-100) | `?openThreshold=60` |

## 🚀 Example API Calls

### 🔍 Search & Filter Parks

```bash
# Find Disney parks worldwide
GET https://api.park.fan/parks?search=Disney&limit=10

# All German parks
GET https://api.park.fan/parks?country=Germany

# European parks with relaxed "open" criteria
GET https://api.park.fan/parks?continent=Europe&openThreshold=25

# Parks with crowd level analysis (default)
GET https://api.park.fan/parks?search=Disney&includeCrowdLevel=true

# Fast response without crowd level calculation
GET https://api.park.fan/parks?country=Germany&includeCrowdLevel=false

# Fast response without weather data
GET https://api.park.fan/parks?country=Germany&includeWeather=false

# Complete data with both crowd level and weather (default)
GET https://api.park.fan/parks?search=Disney

# Minimal response - no crowd level or weather for maximum speed
GET https://api.park.fan/parks?includeCrowdLevel=false&includeWeather=false

# Parks in a specific group with pagination
GET https://api.park.fan/parks?parkGroupId=1&page=2&limit=5
```

### 🗺️ Hierarchical Navigation

```bash
# Get all parks in Europe
GET https://api.park.fan/parks/europe

# Get all parks in Germany
GET https://api.park.fan/parks/europe/germany

# Access Phantasialand via hierarchical path
GET https://api.park.fan/parks/europe/germany/phantasialand

# Access specific ride via hierarchical path
GET https://api.park.fan/parks/europe/germany/phantasialand/taron

# Access parks with complex names
GET https://api.park.fan/parks/north-america/united-states/islands-of-adventure-at-universal-orlando

# Access European park
GET https://api.park.fan/parks/europe/england/alton-towers/the-smiler

# Backward compatibility - access by ID
GET https://api.park.fan/parks/61
```

### 🎢 Discover Rides

```bash
# Search for roller coasters
GET https://api.park.fan/rides?search=coaster&limit=20

# All rides at Disneyland Paris
GET https://api.park.fan/parks/26/rides

# Active rides only with pagination
GET https://api.park.fan/rides?isActive=true&page=1&limit=25
```

### 📊 Analytics & Statistics

```bash
# Global theme park statistics
GET https://api.park.fan/statistics

# Statistics with strict "open" criteria (75%)
GET https://api.park.fan/statistics?openThreshold=75
```

### 🌍 Geographic Exploration

```bash
# All countries with parks
GET https://api.park.fan/countries

# Continental breakdown
GET https://api.park.fan/continents
```

## 📋 Response Examples

### 🏰 Park Details with Operating Status & Weather

```bash
GET https://api.park.fan/parks/25
```

```json
{
  "id": 25,
  "name": "Disneyland Park",
  "country": "United States",
  "continent": "North America",
  "timezone": "America/Los_Angeles",
  "latitude": 33.8121,
  "longitude": -117.919,
  "isActive": true,
  "operatingStatus": {
    "isOpen": true,
    "openRideCount": 42,
    "totalRideCount": 58,
    "operatingPercentage": 72.4,
    "openThreshold": 50
  },
  "weather": {
    "current": {
      "temperature": {
        "min": 22,
        "max": 28
      },
      "precipitationProbability": 10,
      "weatherCode": 1,
      "status": "partly_cloudy",
      "weatherScore": 92
    },
    "forecast": [
      {
        "date": "2025-06-22",
        "temperature": {
          "min": 20,
          "max": 30
        },
        "precipitationProbability": 5,
        "weatherCode": 0,
        "status": "sunny",
        "weatherScore": 95
      }
    ]
  },
  "crowdLevel": {
    "level": 85,
    "label": "Moderate",
    "ridesUsed": 15,
    "totalRides": 42,
    "historicalBaseline": 35,
    "currentAverage": 42,
    "confidence": 82,
    "calculatedAt": "2025-06-20T15:30:00Z"
  },
  "themeAreas": [
    {
      "id": 123,
      "name": "Fantasyland",
      "rides": [...]
    }
  ]
}
```

### 🗺️ Hierarchical Park Access

```bash
GET https://api.park.fan/parks/europe/germany/phantasialand
```

```json
{
  "id": 61,
  "name": "Phantasialand",
  "country": "Germany",
  "continent": "Europe",
  "timezone": "Europe/Berlin",
  "latitude": 50.7998,
  "longitude": 6.8783,
  "isActive": true,
  "hierarchicalUrl": "/parks/europe/germany/phantasialand",
  "operatingStatus": {
    "isOpen": true,
    "openRideCount": 8,
    "totalRideCount": 12,
    "operatingPercentage": 66.7,
    "openThreshold": 50
  },
  "themeAreas": [
    {
      "id": 234,
      "name": "Klugheim",
      "rides": [
        {
          "id": 456,
          "name": "Taron",
          "hierarchicalUrl": "/parks/europe/germany/phantasialand/taron",
          "isActive": true,
          "waitTime": 45,
          "lastUpdate": "2025-06-20T15:28:00Z"
        }
      ]
    }
  ]
}
```

### 🎢 Ride with Queue Information

```bash
GET https://api.park.fan/rides/456
```

```json
{
  "id": 456,
  "name": "Taron",
  "hierarchicalUrl": "/parks/europe/germany/phantasialand/taron",
  "park": {
    "id": 61,
    "name": "Phantasialand",
    "hierarchicalUrl": "/parks/europe/germany/phantasialand"
  },
  "themeArea": {
    "id": 234,
    "name": "Klugheim"
  },
  "isActive": true,
  "waitTime": 45,
  "lastUpdate": "2025-06-20T15:28:00Z"
}
```

### 📊 Statistics Overview

```bash
GET https://api.park.fan/statistics
```

```json
{
  "global": {
    "totalParks": 142,
    "totalRides": 3247,
    "openParks": 89,
    "closedParks": 53,
    "openPercentage": 62.7,
    "openThreshold": 50
  },
  "longestWaitTimes": [
    {
      "park": {
        "id": 25,
        "name": "Disneyland Park",
        "hierarchicalUrl": "/parks/north-america/united-states/disneyland-park"
      },
      "ride": {
        "id": 789,
        "name": "Space Mountain",
        "hierarchicalUrl": "/parks/north-america/united-states/disneyland-park/space-mountain"
      },
      "waitTime": 120,
      "lastUpdate": "2025-06-20T15:30:00Z"
    }
  ],
  "shortestWaitTimes": [
    {
      "park": {
        "id": 61,
        "name": "Phantasialand",
        "hierarchicalUrl": "/parks/europe/germany/phantasialand"
      },
      "ride": {
        "id": 456,
        "name": "Taron",
        "hierarchicalUrl": "/parks/europe/germany/phantasialand/taron"
      },
      "waitTime": 5,
      "lastUpdate": "2025-06-20T15:25:00Z"
    }
  ],
  "busiestParks": [
    {
      "id": 25,
      "name": "Disneyland Park",
      "hierarchicalUrl": "/parks/north-america/united-states/disneyland-park",
      "averageWaitTime": 75,
      "operatingPercentage": 72.4
    }
  ],
  "quietestParks": [
    {
      "id": 61,
      "name": "Phantasialand",
      "hierarchicalUrl": "/parks/europe/germany/phantasialand",
      "averageWaitTime": 18,
      "operatingPercentage": 66.7
    }
  ],
  "byContinent": {
    "North America": {
      "totalParks": 45,
      "openParks": 28,
      "openPercentage": 62.2
    },
    "Europe": {
      "totalParks": 67,
      "openParks": 42,
      "openPercentage": 62.7
    },
    "Asia": {
      "totalParks": 30,
      "openParks": 19,
      "openPercentage": 63.3
    }
  }
}
```

## 🛠️ Development & Architecture

### 📁 Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts             # Root application module
└── modules/
    ├── parks/                # Parks module with weather integration
    ├── rides/                # Rides management
    ├── statistics/           # Analytics and statistics
    ├── countries/            # Country data
    ├── continents/           # Continental data
    ├── database/             # Database configuration
    ├── queue-times-parser/   # External data synchronization
    └── utils/                # Shared utilities and services
```

### 🔧 Technology Stack

- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis for high-performance data caching
- **Architecture**: Modular, service-oriented design
- **Caching**: Intelligent park-based weather caching system with Redis-powered crowd level optimization
- **External APIs**: Queue-times.com, Open-Meteo weather API
- **Documentation**: OpenAPI 3.0.3 specification

### 🚀 Deployment

The API is production-ready and designed for horizontal scaling:

- **Docker**: Containerized deployment support
- **Environment**: Configurable via environment variables
- **Database**: Auto-migration and schema synchronization
- **Redis**: High-performance caching layer for optimal scalability
- **Performance**: Optimized queries and response caching
- **Monitoring**: Health check endpoints and system status

**Infrastructure Requirements:**
- PostgreSQL database server
- Redis cache server
- Node.js runtime environment
- Optional: Docker containerization support

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions or support, please contact:
- **Email**: info@arns.dev
- **Website**: [https://arns.dev](https://arns.dev)

---

**Built with ❤️ for theme park enthusiasts worldwide** 🎢
