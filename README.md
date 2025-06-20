# 🎢 Park.Fan API

The ultimate REST API for theme park data, ride information, and real-time queue times! 🚀

Built with **NestJS** and **TypeScript** - a high-performance API providing comprehensive access to detailed information about theme parks worldwide, including their attractions and current wait times.

## ✨ Features - What Makes This API Awesome

- **🏰 Theme Parks**: Complete park information with geographic organization
- **🎠 Rides & Attractions**: Detailed ride data organized by theme areas
- **⏱️ Live Wait Times**: Real-time queue times with intelligent status detection
- **🌤️ Live Weather Data**: Real-time weather information for each park location
- **🌡️ Crowd Level Intelligence**: AI-driven park congestion analysis with historical context
- **📊 Advanced Statistics**: Comprehensive analytics with geographical breakdowns and hierarchical URLs
- **🔍 Smart Search & Filter**: Multi-criteria search across parks, rides, and locations
- **🌍 Global Coverage**: Parks across multiple continents and countries
- **📱 RESTful Design**: Clean, intuitive API endpoints with consistent responses
- **🔄 Automatic Updates**: Scheduled queue time synchronization from external sources
- **📈 Performance-Optimized**: Built for high throughput with efficient data structures
- **🎯 Intelligent Park Status**: Automatic detection of whether parks are "open" or "closed"
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

### Installation & Setup

```bash
# Clone the repository
git clone <repository-url>
cd api.park.fan

# Install dependencies (pnpm is super fast!)
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup - It Couldn't Be Easier!

The API creates the database automatically! Just ensure PostgreSQL is running:

```bash
# The application automatically:
# 1. 🔌 Connects to PostgreSQL
# 2. 🏗️ Creates database if it doesn't exist
# 3. 🚀 Executes migrations automatically
# 4. 📡 Starts data synchronization
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
| `PARK_OPEN_THRESHOLD_PERCENT` | Park "open" threshold (0-100%) | `50` | ❌ |

### 🎯 Park Operating Status Logic - The Core Feature!

The **Park Operating Status** feature intelligently determines whether a park is "open" or "closed":

- **🎯 Threshold-based**: Parks are considered "open" when ≥ X% of rides are currently operating
- **⚙️ Default**: 50% threshold (configurable via environment variable or API parameter)
- **⚡ Real-time**: Based on current wait time data and ride operational status
- **🔧 Flexible**: Override per request with `?openThreshold=X` parameter

**Effects:**
- 📊 Statistics endpoint park status calculations
- 🏆 Busiest/quietest park rankings
- 📈 Geographic operational status breakdowns

**Examples:**
```bash
# Use standard 50% threshold
GET /statistics

# Custom 75% threshold for stricter "open" definition
GET /statistics?openThreshold=75

# Relaxed 25% threshold
GET /parks?openThreshold=25
```

### 🌡️ Crowd Level Intelligence - NEW! 🔥

The **Crowd Level** feature provides intelligent real-time park congestion analysis:

- **📊 Smart Calculation**: Based on top 30% of rides with highest wait times
- **📈 Historical Context**: Compares current levels to 2-year rolling average (95th percentile)
- **🎯 Confidence Scoring**: Data quality assessment for reliable predictions
- **⚡ Performance Optimized**: Optional calculation for faster API responses

**Crowd Level Scale:**
- **0-30%**: 🟢 Very Low - Perfect time to visit!
- **30-60%**: 🟡 Low - Good conditions
- **60-120%**: 🟠 Moderate - Normal busy levels
- **120-160%**: 🔴 High - Expect longer waits
- **160-200%**: 🔴 Very High - Very crowded
- **200%+**: ⚫ Extreme - Exceptionally busy

**Response Data:**
```json
{
  "crowdLevel": {
    "level": 85,              // Percentage relative to historical average
    "label": "Moderate",      // Human-readable description
    "ridesUsed": 6,          // Number of rides used for calculation
    "totalRides": 20,        // Total rides in park
    "historicalBaseline": 45, // Historical average (minutes)
    "currentAverage": 38,     // Current average wait time (minutes)
    "confidence": 78,         // Data quality score (0-100%)
    "calculatedAt": "2025-06-18T10:30:00Z"
  }
}
```

**Configuration:**
```bash
# Include crowd level (default)
GET /parks?includeCrowdLevel=true

# Skip crowd level for faster response
GET /parks?includeCrowdLevel=false

# Individual park with crowd level
GET /parks/123?includeCrowdLevel=true
```

### 🌤️ Live Weather Data ☀️

The **Live Weather** feature provides real-time weather information for every park location:

- **🌡️ Temperature Range**: Daily min/max temperatures during park operating hours (9-22h)
- **🌧️ Precipitation Probability**: Chance of rain throughout the day
- **☀️ Weather Status**: Human-readable weather conditions
- **� Weather Score**: AI-powered weather quality rating (0-100%) for theme park visits
- **�🌍 Timezone-Aware**: Weather data adjusted to park's local timezone
- **⚡ Performance-Optimized**: Optional inclusion for faster API responses when not needed

**Weather Status Types:**
- **☀️ sunny**: Clear, sunny skies
- **⛅ partly_cloudy**: Some clouds, mostly sunny
- **☁️ cloudy**: Overcast but no precipitation
- **🌫️ overcast**: Completely overcast
- **🌦️ light_rain**: Light rain or drizzle
- **🌧️ rain**: Moderate rainfall
- **⛈️ heavy_rain**: Heavy rainfall
- **⚡ thunderstorm**: Thunderstorms with lightning
- **❄️ snow**: Snow or freezing conditions
- **🌫️ fog**: Fog or mist
- **🌦️ drizzle**: Light drizzle

**🎯 Weather Score Algorithm:**
The weather score (0-100%) evaluates conditions for theme park visits:
- **90-100%**: 🟢 Perfect conditions - ideal for visiting!
- **70-89%**: 🟡 Good conditions - great for outdoor activities
- **50-69%**: 🟠 Fair conditions - acceptable but not optimal
- **30-49%**: 🔴 Poor conditions - consider indoor attractions
- **0-29%**: ⚫ Terrible conditions - might want to postpone visit

**Factors considered:**
- Weather conditions (sunny weather = higher score)
- Precipitation probability (lower chance = higher score)
- Temperature comfort (18-25°C optimal range)
- Temperature stability (consistent temps preferred)

**Response Data:**
```json
{
  "weather": {
    "temperature": {
      "min": 18,              // Minimum temperature (°C)
      "max": 25               // Maximum temperature (°C)
    },
    "precipitationProbability": 20,  // Chance of rain (0-100%)
    "weatherCode": 1,                // WMO weather code
    "status": "partly_cloudy",       // Human-readable status
    "weatherScore": 85               // Weather quality score (0-100%)
  }
}
```

**Configuration:**
```bash
# Include weather data (default)
GET /parks?includeWeather=true

# Skip weather data for faster response
GET /parks?includeWeather=false

# Individual park with weather
GET /parks/123?includeWeather=true
```

**Data Source:**
Weather data is sourced from the free **[Open-Meteo API](https://open-meteo.com)**, providing:
- 🌍 Global coverage for all park locations
- 🎯 High accuracy meteorological data
- ⚡ No API key required
- 🔄 Real-time updates
- 🌐 WMO (World Meteorological Organization) standard weather codes

## 🚀 Advanced Weather Data System

We've implemented a **revolutionary Weather Data Management System** with historical data collection and AI-ready capabilities:

**Performance**: 100-300ms response time (previously 2-5 seconds)  
**Data Collection**: Automatic historical weather data for AI model training  
**Forecasting**: 7-day weather forecasts with daily updates

#### Key Features:
- **🗄️ Unified Weather Database**: Current, forecast, and historical weather data in one system
- **🏰 Park-Linked Weather Data**: Weather associated with specific parks for better insights
- **🔮 7-Day Forecasts**: Complete weather forecasts updated daily at 5:00 AM
- **📊 AI-Ready Historical Dataset**: Automatic collection of weather data for machine learning
- **⚡ Server Startup Updates**: Weather data refreshed automatically when server starts
- **♻️ Smart Data Lifecycle**: Automatic conversion of forecasts to historical data
- **🎯 Fully Automated System**: No manual intervention required - everything runs via cron jobs

The system automatically builds rich datasets for future AI models including historical weather patterns, forecast accuracy tracking, and weather-attendance correlation data.

---

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
    "temperature": {
      "min": 22,
      "max": 28
    },
    "precipitationProbability": 10,
    "weatherCode": 1,
    "status": "partly_cloudy",
    "weatherScore": 92
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
  "hierarchicalUrl": "/parks/europe/germany/phantasialand",
  "operatingStatus": {
    "isOpen": false,
    "openRideCount": 0,
    "totalRideCount": 33,
    "operatingPercentage": 0
  },
  "weather": {
    "temperature": {
      "min": 12,
      "max": 18
    },
    "precipitationProbability": 65,
    "weatherCode": 61,
    "status": "light_rain",
    "weatherScore": 25
  },
  "themeAreas": [...]
}
```

### 🎢 Hierarchical Ride Access

```bash
GET https://api.park.fan/parks/europe/germany/phantasialand/taron
```

```json
{
  "id": 1330,
  "name": "Taron",
  "isActive": true,
  "hierarchicalUrl": "/parks/europe/germany/phantasialand/taron",
  "park": {
    "id": 61,
    "name": "Phantasialand",
    "country": "Germany",
    "continent": "Europe",
    "hierarchicalUrl": "/parks/europe/germany/phantasialand"
  },
  "themeArea": {
    "id": 195,
    "name": "Mystery"
  },
  "currentQueueTime": {
    "waitTime": 0,
    "isOpen": false,
    "lastUpdated": "2025-06-12T17:02:18Z"
  }
}
```

### 🎠 Ride with Current Queue Status

```bash
GET https://api.park.fan/rides/1847
```

```json
{
  "id": 1847,
  "name": "Space Mountain",
  "isActive": true,
  "park": {
    "id": 25,
    "name": "Disneyland Park",
    "country": "United States",
    "continent": "North America"
  },
  "themeArea": {
    "id": 128,
    "name": "Tomorrowland"
  },
  "currentQueueTime": {
    "waitTime": 45,
    "isOpen": true,
    "lastUpdated": "2023-06-04T18:15:33.000Z"
  }
}
```

### 📊 Comprehensive Statistics

```bash
GET https://api.park.fan/statistics
```

```json
{
  "totalParks": 145,
  "totalThemeAreas": 486,
  "totalRides": 4521,
  "parkOperatingStatus": {
    "openParks": 67,
    "closedParks": 78,
    "operatingPercentage": 46.2,
    "openThreshold": 50
  },
  "rideStatistics": {
    "totalRides": 2847,
    "activeRides": 2847,
    "openRides": 1692,
    "closedRides": 1155,
    "operatingPercentage": 59.4,
    "waitTimeDistribution": {
      "0-10": 1425,
      "11-30": 187,
      "31-60": 58,
      "61-120": 19,
      "120+": 3
    },
    "longestWaitTimes": [
      {
        "rideId": 2407,
        "rideName": "Guardians of the Galaxy: Mission Breakout!",
        "parkId": 124,
        "parkName": "Disney California Adventure",
        "country": "United States",
        "continent": "North America",
        "waitTime": 135,
        "isOpen": true,
        "lastUpdated": "2023-06-04T18:20:15.000Z",
        "hierarchicalUrl": "/parks/north-america/united-states/disney-california-adventure/guardians-of-the-galaxy-mission-breakout",
        "park": {
          "id": 124,
          "name": "Disney California Adventure",
          "country": "United States",
          "continent": "North America",
          "hierarchicalUrl": "/parks/north-america/united-states/disney-california-adventure"
        }
      }
    ],
    "shortestWaitTimes": [
      {
        "rideId": 123,
        "rideName": "Carousel",
        "parkId": 30,
        "parkName": "Phantasialand",
        "country": "Germany",
        "continent": "Europe",
        "waitTime": 5,
        "isOpen": true,
        "lastUpdated": "2023-06-04T18:15:33.000Z",
        "hierarchicalUrl": "/parks/europe/germany/phantasialand/carousel",
        "park": {
          "id": 30,
          "name": "Phantasialand",
          "country": "Germany",
          "continent": "Europe",
          "hierarchicalUrl": "/parks/europe/germany/phantasialand"
        }
      }
    ],
    "busiestParks": [
      {
        "parkId": 115,
        "parkName": "Epic Universe",
        "country": "United States",
        "continent": "North America",
        "averageWaitTime": 52,
        "openRideCount": 21,
        "totalRideCount": 23,
        "operatingPercentage": 91.3,
        "hierarchicalUrl": "/parks/north-america/united-states/epic-universe"
      }
    ],
    "quietestParks": [
      {
        "parkId": 67,
        "parkName": "Example Quiet Park",
        "country": "Germany",
        "continent": "Europe",
        "averageWaitTime": 8,
        "openRideCount": 12,
        "totalRideCount": 15,
        "operatingPercentage": 80.0,
        "hierarchicalUrl": "/parks/europe/germany/example-quiet-park"
      }
    ]
  },
  "parksByContinent": [
    {
      "continent": "North America",
      "totalParks": 84,
      "openParks": 58,
      "closedParks": 26,
      "operatingPercentage": 69.0
    }
  ]
}
```

## 🏗️ Architecture & Technology

### 🛠️ Technology Stack

- **🚀 Framework**: NestJS (Node.js)
- **💪 Language**: TypeScript
- **🗄️ Database**: PostgreSQL
- **🔄 ORM**: TypeORM
- **📦 Package Manager**: pnpm
- **✅ Validation**: class-validator & class-transformer
- **📊 Data Source**: queue-times.com API integration

### 📁 Project Structure

```
src/
├── modules/
│   ├── parks/              # 🏰 Parks, rides, and theme areas
│   │   ├── parks.controller.ts
│   │   ├── parks.service.ts
│   │   ├── park.entity.ts
│   │   ├── ride.entity.ts
│   │   ├── theme-area.entity.ts
│   │   ├── queue-time.entity.ts
│   │   └── park-group.entity.ts
│   ├── rides/              # 🎠 Ride-specific endpoints
│   ├── statistics/         # 📊 Analytics and insights
│   ├── countries/          # 🌍 Geographic data (countries)
│   ├── continents/         # 🌎 Geographic data (continents)
│   ├── queue-times-parser/ # 🔄 Data synchronization
│   ├── status/             # ⚡ Health checks
│   ├── database/           # 🗄️ Database configuration
│   ├── index/              # 🏠 Documentation rendering
│   └── utils/              # 🛠️ Shared utilities
├── types/                  # 📝 TypeScript type definitions
├── app.module.ts           # 🔧 Main application module
└── main.ts                 # 🚀 Application bootstrap
```

### 🔄 Data Flow

1. **📡 External API Integration**: Connects to queue-times.com API and Open-Meteo weather API
2. **🔄 Automated Synchronization**: Scheduled updates of park and ride data
3. **🌤️ Real-time Weather**: Live weather data fetched based on park coordinates and timezone
4. **🗄️ Database Storage**: PostgreSQL with optimized schema
5. **📊 Real-time Analytics**: Live statistics and operating status
6. **🎯 RESTful API**: Clean endpoints with intelligent caching
7. **📱 Response Formatting**: Consistent JSON responses with rich metadata

## 🌤️ Weather Data Examples

### Weather-Optimized Park Selection

```bash
# Find parks with good weather (example usage for a weather app)
GET https://api.park.fan/parks?continent=Europe&includeWeather=true&limit=50

# Get all parks with minimal data for weather overview
GET https://api.park.fan/parks?includeCrowdLevel=false&includeWeather=true
```

### Weather-Aware Trip Planning

```bash
# Check weather at a specific park before visiting
GET https://api.park.fan/parks/europe/germany/phantasialand?includeWeather=true

# Compare weather across multiple Disney parks
GET https://api.park.fan/parks?search=Disney&includeWeather=true

# Weather data for all US parks
GET https://api.park.fan/parks/north-america/united-states?includeWeather=true
```

**Weather Response Example:**
```json
{
  "weather": {
    "temperature": {
      "min": 16,
      "max": 23
    },
    "precipitationProbability": 15,
    "weatherCode": 2,
    "status": "partly_cloudy",
    "weatherScore": 78
  }
}
```

Weather conditions evaluation: 🟡 **Good conditions (78/100)** - Great weather for theme park visits! Partly cloudy with comfortable temperatures and low chance of rain.

## 🚀 Performance Optimizations

### 📦 Caching Strategy

The API implements a robust caching strategy to enhance performance and reduce load:

- **⏱️ Cache Headers**: All API responses include Cache-Control headers with a 5-minute (300 seconds) TTL
- **🔄 Automatic Invalidation**: Cache refreshes after the TTL expires to ensure data freshness
- **⚡ Improved Response Times**: Enables client-side caching for faster repeat requests
- **📈 Reduced Server Load**: Minimizes redundant processing for frequently requested endpoints
- **🌐 CDN Compatibility**: Compatible with CDNs and reverse proxies for edge caching

Example response header:
```
Cache-Control: public, max-age=300
```

This caching implementation is handled through a global NestJS interceptor that applies consistent cache headers across all API endpoints.

## 🔄 Data Updates

The API automatically fetches and updates queue time data through a scheduled service that:

1. **Connects** to queue-times.com API endpoints
2. **Processes** park and ride data efficiently
3. **Updates** queue times in real-time
4. **Maintains** historical data for analytics
5. **Prevents** duplicate entries with 97%+ efficiency

## 📊 Current Data Stats

- **133 Parks** across 19 countries and 4 continents
- **422 Theme Areas** with detailed organization
- **2,683 Rides** with real-time queue data
- **13,710+ Queue Time Entries** with high data quality

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm run start:dev      # Start with hot reload
pnpm run start:debug    # Start with debugging

# Building
pnpm run build          # Build for production
pnpm run start:prod     # Run production build

# Building
pnpm run build          # Build for production
pnpm run start:prod     # Run production build
```

## 🐳 Docker Support

```bash
# Build image
docker build -t park-fan-api .

# Run container
docker run -p 3000:3000 park-fan-api
```

## 📋 API Documentation

This API provides comprehensive documentation in multiple formats:

- **📖 Interactive HTML**: Visit the root endpoint `/` for beautifully formatted documentation
- **📄 Raw Markdown**: Access `/readme` for the source documentation  
- **📋 OpenAPI Specification**: Download the complete OpenAPI 3.0.3 spec from `/openapi.yaml`

### Using the OpenAPI Specification

Import `https://api.park.fan/openapi.yaml` into your favorite API tools:
- **[Postman](https://www.postman.com/)**: Import → Link → Paste URL
- **[Insomnia](https://insomnia.rest/)**: Import/Export → From URL
- **[Swagger Editor](https://editor.swagger.io/)**: File → Import URL
- **[OpenAPI Generator](https://openapi-generator.tech/)**: Generate client SDKs in 50+ languages

## 🤝 Acknowledgments

- **[queue-times.com](https://queue-times.com)** for providing comprehensive theme park data and reliable API access
- **NestJS** team for the excellent framework and documentation
- **TypeORM** for robust database management and migrations

## 👨‍💻 Developer

Created by **[Patrick Arns https://arns.dev](https://arns.dev)** - Rust developer, passionate about theme parks and modern web technologies.

---

*Built with ❤️ for theme park enthusiasts worldwide* 🎡

**Live API: [https://api.park.fan](https://api.park.fan) | Powered by [queue-times.com](https://queue-times.com) data**
