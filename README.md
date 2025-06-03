# 🎢 Park.Fan API

A comprehensive REST API for theme park data, ride information, and real-time queue times. Built with NestJS and TypeScript, this API provides access to detailed information about theme parks worldwide, including their attractions and current wait times.

## 🌟 Features

- **🏰 Parks Management**: Complete information about theme parks worldwide
- **🎠 Rides & Attractions**: Detailed ride data with theme area organization
- **⏱️ Real-time Queue Times**: Live wait times for park attractions
- **📊 Statistics**: Comprehensive park and ride statistics
- **🔍 Advanced Search**: Filter parks by country, continent, or search terms
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

## 📚 API Documentation

### Parks Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parks` | Get all parks with pagination and filtering |
| `GET` | `/parks/:id` | Get a specific park with rides and queue times |
| `GET` | `/parks/rides/:id` | Get individual ride with current queue time |
| `GET` | `/parks/statistics` | Get comprehensive park statistics |
| `GET` | `/parks/countries` | Get list of all countries with parks |
| `GET` | `/parks/continents` | Get list of all continents with parks |

### Queue Times Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parks/queue-times/statistics` | Get queue time statistics |

### System Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Check API health and system status |

### Query Parameters

#### Parks Filtering (`/parks`)
- `search` - Search parks by name or country
- `country` - Filter by specific country
- `continent` - Filter by specific continent
- `parkGroupId` - Filter by park group ID
- `page` - Page number for pagination (default: 1)
- `limit` - Results per page (default: 10, max: 100)

### Example Requests

#### Get Parks with Filtering
```bash
GET https://park.fan/parks?country=United%20States&page=1&limit=5
```

#### Get Specific Ride
```bash
GET https://park.fan/parks/rides/1
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
    "id": 52800,
    "waitTime": 15,
    "isOpen": true,
    "lastUpdated": "2025-06-03T20:00:44.000Z"
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
│   ├── parks/              # Parks, rides, and queue times
│   ├── queue-times-parser/ # Data parsing and updates
│   ├── database/           # Database configuration
│   └── status/             # Health checks
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
