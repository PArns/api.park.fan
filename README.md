# 🎢 Park.Fan API

A comprehensive REST API for theme park data, ride information, and real-time queue times. Built with NestJS and TypeScript, this API provides access to detailed information about theme parks worldwide, including their attractions and current wait times.

## 🌟 Features

- **🏰 Parks Management**: Complete information about theme parks worldwide
- **🎠 Rides & Attractions**: Detailed ride data with theme area organization
- **⏱️ Real-time Queue Times**: Live wait times for park attractions
- **📊 Statistics**: Comprehensive park and ride statistics
- **🔍 Advanced Search**: Filter parks by country, continent, or search terms
- **🏁 Park Operating Status**: Intelligent park status detection based on ride availability
- **📱 RESTful API**: Clean, intuitive API endpoints
- **🔄 Automatic Updates**: Scheduled queue time updates from external sources

## 📊 Data Source

This API utilizes data from **[queue-times.com](https://queue-times.com)**, providing reliable and up-to-date information about theme park wait times and attraction data.

## 🌐 Live API

The API is used at **[https://arns.dev](https://arns.dev)** - try it out with real theme park data!

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd api.park.fan

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# Run database migrations
pnpm run migration:run

# Seed initial data (optional)
pnpm run seed
```

### Running the Application

```bash
# Development mode with hot reload
pnpm run start:dev

# Production mode
pnpm run start:prod

# Build for production
pnpm run build
```

The API will be available at `http://localhost:3000`

## ⚙️ Configuration

The API can be configured using environment variables. Copy `.env.example` to `.env` and adjust the values as needed.

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL database host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL database port | `5432` | Yes |
| `DB_USER` | PostgreSQL username | `postgres` | Yes |
| `DB_PASS` | PostgreSQL password | `postgres` | Yes |
| `DB_NAME` | PostgreSQL database name | `parkfan` | Yes |
| `PARK_OPEN_THRESHOLD_PERCENT` | Percentage threshold (0-100) to determine when a park is considered "open" | `50` | No |

### Park Operating Status

The `PARK_OPEN_THRESHOLD_PERCENT` variable controls how the API determines whether a park is "open" or "closed":

- **Default (50%)**: A park is considered open if at least 50% of its rides are currently operating
- **Flexible Range**: You can set any value from 0-100 to match your requirements
- **API Override**: Users can override this default by passing `?openThreshold=X` in API requests

This affects:
- Park operating status in `/statistics` endpoint
- Busiest/quietest park calculations
- Park filtering in analytics

## 📚 API Documentation

### 🏰 Parks Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parks` | Get all parks with pagination and filtering |
| `GET` | `/parks/:id` | Get a specific park with rides and queue times |
| `GET` | `/parks/:id/rides` | Get all rides for a specific park |

### 🎠 Rides Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rides` | Get all rides with filtering and pagination |
| `GET` | `/rides/:id` | Get a specific ride with current queue time |

### 📊 Statistics & Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/statistics` | Get comprehensive park and ride statistics with operating status |
| `GET` | `/countries` | Get list of all countries with parks |
| `GET` | `/continents` | Get list of all continents with parks |

### ⏱️ Queue Times Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/queue-times/statistics` | Get queue time statistics and analytics |

### 🔍 System Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Check API health and system status |

### Query Parameters

#### Parks Filtering (`/parks`)
- `search` - Search parks by name or country
- `country` - Filter by specific country (e.g., `?country=Germany`)
- `continent` - Filter by specific continent (e.g., `?continent=Europe`)
- `parkGroupId` - Filter by park group ID
- `openThreshold` - Percentage threshold for park to be considered "open" (0-100, default: 50)
- `page` - Page number for pagination (default: 1)
- `limit` - Results per page (default: 10, max: 100)

#### Rides Filtering (`/rides`)
- `search` - Search rides by name (e.g., `?search=coaster`)
- `parkId` - Filter rides by specific park ID
- `isActive` - Filter by ride status (true/false)
- `page` - Page number for pagination (default: 1)
- `limit` - Results per page (default: 10, max: 100)

#### Statistics Parameters (`/statistics`)
- `openThreshold` - Percentage threshold for park to be considered "open" (0-100, default: 50)

### Example Requests

#### Get Parks with Country Filtering
```bash
GET https://park.fan/parks?country=Germany&page=1&limit=5
```

#### Search for Coaster Rides
```bash
GET https://park.fan/rides?search=coaster&limit=10
```

#### Get All Rides for a Specific Park
```bash
GET https://park.fan/parks/1/rides
```

### 🏁 Park Operating Status

All park endpoints now include an `operatingStatus` field that intelligently determines if a park is open based on the percentage of rides that are currently operating.

#### How It Works
- **Threshold-based**: Parks are considered "open" when at least X% of their rides are open
- **Default Threshold**: 50% (configurable via `openThreshold` parameter)
- **Real-time Data**: Based on current queue time data and ride availability

#### Operating Status Response
```json
{
  "operatingStatus": {
    "isOpen": true,
    "openRideCount": 25,
    "totalRideCount": 39,
    "operatingPercentage": 64
  }
}
```

#### Examples

**Check park with default 50% threshold:**
```bash
GET https://park.fan/parks/25
```

**Check park with custom 25% threshold:**
```bash
GET https://park.fan/parks/25?openThreshold=25
```

**Find all parks that are open (75% threshold):**
```bash
GET https://park.fan/parks?openThreshold=75
```

#### Get Specific Ride Details
```bash
GET https://park.fan/rides/1
```

**Response:**
```json
{
  "id": 1,
  "name": "Demon",
  "isActive": true,
  "park": {
    "id": 1,
    "name": "California's Great America",
    "country": "United States",
    "continent": "North America"
  },
  "themeArea": {
    "id": 1,
    "name": "Coasters"
  },
  "currentQueueTime": {
    "waitTime": 15,
    "isOpen": true,
    "lastUpdated": "2025-06-03T20:00:44.000Z"
  }
}
```

#### Get Statistics
```bash
GET https://park.fan/statistics
```

**Response:**
```json
{
  "totalParks": 133,
  "totalThemeAreas": 422,
  "totalRides": 4164,
  "parkOperatingStatus": {
    "openParks": 53,
    "closedParks": 80,
    "operatingPercentage": 40,
    "openThreshold": 50
  },
  "rideStatistics": {
    "totalRides": 2683,
    "activeRides": 2683,
    "inactiveRides": 0,
    "openRides": 1548,
    "closedRides": 1135,
    "ridesWithoutData": 0,
    "operatingPercentage": 58,
    "waitTimeDistribution": {
      "0-10": 1320,
      "11-30": 136,
      "31-60": 70,
      "61-120": 21,
      "120+": 1
    },
    "ridesByContinent": [
      {
        "continent": "North America",
        "totalRides": 2036,
        "activeRides": 2036,
        "openRides": 1423,
        "operatingPercentage": 70
      }
    ],
    "ridesByCountry": [
      {
        "country": "United States",
        "totalRides": 1858,
        "activeRides": 1858,
        "openRides": 1271,
        "operatingPercentage": 68
      }
    ],
    "longestWaitTimes": [
      {
        "rideId": 2407,
        "rideName": "Radiator Springs Racers",
        "parkId": 123,
        "parkName": "Disney California Adventure",
        "country": "United States",
        "waitTime": 125,
        "isOpen": true,
        "lastUpdated": "2025-06-04T16:21:39.000Z"
      }
    ],
    "shortestWaitTimes": [
      {
        "rideId": 1445,
        "rideName": "Backlot Stunt Coaster",
        "parkId": 81,
        "parkName": "Canada's Wonderland",
        "country": "Canada",
        "waitTime": 0,
        "isOpen": true,
        "lastUpdated": "2025-06-04T16:25:46.000Z"
      }
    ],
    "busiestParks": [
      {
        "parkId": 115,
        "parkName": "Epic Universe",
        "country": "United States",
        "continent": "North America",
        "averageWaitTime": 40,
        "openRideCount": 18,
        "totalRideCount": 19,
        "operatingPercentage": 95
      }
    ],
    "quietestParks": [
      {
        "parkId": 98,
        "parkName": "Worlds of Fun",
        "country": "United States",
        "continent": "North America",
        "averageWaitTime": 0,
        "openRideCount": 25,
        "totalRideCount": 25,
        "operatingPercentage": 100
      }
    ]
  },
  "parksByContinent": [
    {
      "continent": "North America",
      "totalParks": 69,
      "openParks": 47,
      "closedParks": 22,
      "operatingPercentage": 68
    },
    {
      "continent": "Europe",
      "totalParks": 46,
      "openParks": 6,
      "closedParks": 40,
      "operatingPercentage": 13
    }
  ],
  "parksByCountry": [
    {
      "country": "United States",
      "totalParks": 66,
      "openParks": 44,
      "closedParks": 22,
      "operatingPercentage": 67
    },
    {
      "country": "France",
      "totalParks": 9,
      "openParks": 2,
      "closedParks": 7,
      "operatingPercentage": 22
    }
  ]
}
```

#### Get Statistics with Custom Threshold
```bash
GET https://park.fan/statistics?openThreshold=25
```

### 🎢 Comprehensive Ride Statistics

The statistics endpoint now provides detailed ride analytics including:

#### Key Metrics
- **Total, Active, and Operating Ride Counts**: Real-time statistics on ride availability
- **Wait Time Distribution**: Categorized by time ranges (0-10, 11-30, 31-60, 61-120, 120+ minutes)
- **Geographic Analysis**: Ride statistics broken down by continent and country
- **Top Lists**: Longest and shortest wait times across all parks

#### Wait Time Distribution
Rides are automatically categorized into wait time buckets:
- **0-10 minutes**: Walk-on attractions and short waits
- **11-30 minutes**: Moderate wait times
- **31-60 minutes**: Popular attractions with longer waits
- **61-120 minutes**: High-demand attractions
- **120+ minutes**: Peak popularity rides

#### Geographic Breakdown
- **By Continent**: Total rides, active rides, open rides, and operating percentages
- **By Country**: Top 10 countries with the most rides and their operating statistics

#### Real-time Top Lists
- **Longest Wait Times**: Top 5 rides with the highest current wait times
- **Shortest Wait Times**: Top 5 open rides with the lowest wait times (perfect for walk-ons!)
- **Busiest Parks**: Top 5 parks with the highest average wait times across all open rides
- **Quietest Parks**: Top 5 parks with the lowest average wait times across all open rides
- **Direct Navigation**: Each entry includes `rideId`/`parkId` for easy API navigation to specific rides and parks

#### Navigation Examples
Use the IDs from the top lists to get detailed information:
```bash
# Get details for the ride with longest wait time
GET https://park.fan/rides/{rideId}

# Get details for the park containing that ride
GET https://park.fan/parks/{parkId}

# Get all rides in that park
GET https://park.fan/parks/{parkId}/rides

# Navigate to busiest/quietest parks directly
GET https://park.fan/parks/{parkId}    # from busiestParks or quietestParks
```

#### Example: Current Ride Insights
```json
{
  "rideStatistics": {
    "totalRides": 2683,
    "operatingPercentage": 58,
    "waitTimeDistribution": {
      "0-10": 1320,    // 85% of open rides have short waits!
      "11-30": 136,
      "31-60": 70,
      "61-120": 21,
      "120+": 1
    },
    "longestWaitTimes": [
      {
        "rideName": "Radiator Springs Racers",
        "waitTime": 125,
        "parkName": "Disney California Adventure"
      }
    ]
  }
}
```

## 🏗️ Architecture

### Technology Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Package Manager**: pnpm
- **Validation**: class-validator

### Project Structure

```
src/
├── modules/
│   ├── parks/              # Parks management and park-specific operations
│   ├── rides/              # Rides endpoints with filtering and search
│   ├── statistics/         # Statistics and analytics endpoints
│   ├── countries/          # Countries data endpoints
│   ├── continents/         # Continents data endpoints
│   ├── queue-times/        # Queue times statistics and analytics
│   ├── queue-times-parser/ # Data parsing and updates
│   ├── database/           # Database configuration
│   └── status/             # Health checks and system status
├── app.module.ts
└── main.ts
```

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

# Testing
pnpm run test           # Run unit tests
pnpm run test:e2e       # Run e2e tests
pnpm run test:cov       # Test coverage
```

## 🐳 Docker Support

```bash
# Build image
docker build -t park-fan-api .

# Run container
docker run -p 3000:3000 park-fan-api
```

## 🤝 Acknowledgments

- **[queue-times.com](https://queue-times.com)** for providing comprehensive theme park data and reliable API access
- **NestJS** team for the excellent framework and documentation
- **TypeORM** for robust database management and migrations

## 👨‍💻 Developer

Created by **[Patrick Arns https://arns.dev](https://arns.dev)** - Rust developer, passionate about theme parks and modern web technologies.

---

*Built with ❤️ for theme park enthusiasts worldwide* 🎡

**Live API: [https://park.fan](https://park.fan) | Powered by [queue-times.com](https://queue-times.com) data**
