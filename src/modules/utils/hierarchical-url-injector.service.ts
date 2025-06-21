import { Injectable } from '@nestjs/common';
import { HierarchicalUrlService } from './hierarchical-url.service.js';

@Injectable()
export class HierarchicalUrlInjectorService {
  /**
   * Add hierarchical URL to a single park object
   */
  addUrlToPark(park: any): any {
    if (!park) return park;

    return {
      ...park,
      hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
        park.continent || 'unknown',
        park.country || 'unknown',
        park.name || park.parkName || 'unknown',
      ),
    };
  }

  /**
   * Add hierarchical URLs to an array of parks
   */
  addUrlsToParks(parks: any[]): any[] {
    if (!parks || !Array.isArray(parks)) return parks;

    return parks.map((park) => this.addUrlToPark(park));
  }

  /**
   * Add hierarchical URL to a single ride object
   * Handles both nested park structure (ride.park) and flat structure (ride.parkName, etc.)
   */
  addUrlToRide(
    ride: any,
    contextPark?: { continent?: string; country?: string; name?: string },
  ): any {
    if (!ride) return ride;

    // Determine park info structure
    let continent, country, parkName;

    if (ride.park) {
      // Nested structure - use park data or fall back to context
      continent = ride.park.continent?.trim() || contextPark?.continent || null;
      country = ride.park.country?.trim() || contextPark?.country || null;
      parkName = ride.park.name?.trim() || contextPark?.name || null;

      // If park data is missing key fields, log a warning
      if (!ride.park.continent || !ride.park.country) {
        console.warn(
          `Warning: Using context fallback for ride "${ride.name}" - park data incomplete`,
          {
            parkId: ride.park.id,
            dbContinent: ride.park.continent,
            dbCountry: ride.park.country,
            contextContinent: contextPark?.continent,
            contextCountry: contextPark?.country,
          },
        );
      }
    } else {
      // Flat structure (from statistics) - use direct fields or context
      continent = ride.continent?.trim() || contextPark?.continent || null;
      country = ride.country?.trim() || contextPark?.country || null;
      parkName = ride.parkName?.trim() || contextPark?.name || null;
    }

    const rideWithUrl = {
      ...ride,
      hierarchicalUrl: HierarchicalUrlService.generateRideUrl(
        continent || 'unknown',
        country || 'unknown',
        parkName || 'unknown',
        ride.name || ride.rideName || 'unknown',
      ),
    };

    // If we have park info, add hierarchical URL to the park as well
    if (ride.park) {
      rideWithUrl.park = {
        ...ride.park,
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          ride.park.continent || 'unknown',
          ride.park.country || 'unknown',
          ride.park.name || 'unknown',
        ),
      };
    } else if (
      ride.parkId &&
      (ride.parkName || ride.continent || ride.country)
    ) {
      // Create park object from flat structure
      rideWithUrl.park = {
        id: ride.parkId,
        name: ride.parkName || 'unknown',
        country: ride.country || 'unknown',
        continent: ride.continent || 'unknown',
        hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
          ride.continent || 'unknown',
          ride.country || 'unknown',
          ride.parkName || 'unknown',
        ),
      };
    }

    return rideWithUrl;
  }

  /**
   * Add hierarchical URLs to an array of rides
   */
  addUrlsToRides(
    rides: any[],
    contextPark?: { continent?: string; country?: string; name?: string },
  ): any[] {
    if (!rides || !Array.isArray(rides)) return rides;

    return rides.map((ride) => this.addUrlToRide(ride, contextPark));
  }

  /**
   * Add hierarchical URLs to park statistics data (for statistics endpoint)
   */
  addUrlsToParkStatistics(parkStats: any[]): any[] {
    if (!parkStats || !Array.isArray(parkStats)) return parkStats;

    return parkStats.map((park) => ({
      ...park,
      hierarchicalUrl: HierarchicalUrlService.generateParkUrl(
        park.continent || 'unknown',
        park.country || 'unknown',
        park.parkName || park.name || 'unknown',
      ),
    }));
  }

  /**
   * Add hierarchical URLs to ride statistics data (for statistics endpoint)
   */
  addUrlsToRideStatistics(rideStats: any[]): any[] {
    if (!rideStats || !Array.isArray(rideStats)) return rideStats;

    return rideStats.map((ride) => this.addUrlToRide(ride));
  }

  /**
   * Add hierarchical URLs to parks with theme areas and rides
   */
  addUrlsToParkWithDetails(park: any): any {
    if (!park) return park;

    const parkWithUrl = this.addUrlToPark(park);

    // Create park context for rides
    const parkContext = {
      continent: park.continent,
      country: park.country,
      name: park.name,
    };

    // Add URLs to theme areas and rides if they exist
    if (park.themeAreas && Array.isArray(park.themeAreas)) {
      parkWithUrl.themeAreas = park.themeAreas.map((themeArea: any) => ({
        ...themeArea,
        rides: this.addUrlsToRides(themeArea.rides, parkContext),
      }));
    }

    return parkWithUrl;
  }

  /**
   * Add hierarchical URLs to a single park with theme areas and rides
   */
  addUrlToParkWithDetails(park: any): any {
    return this.addUrlsToParkWithDetails(park);
  }

  /**
   * Add hierarchical URLs to an array of parks with full details
   */
  addUrlsToParksWithDetails(parks: any[]): any[] {
    if (!parks || !Array.isArray(parks)) return parks;

    return parks.map((park) => this.addUrlsToParkWithDetails(park));
  }

  /**
   * Add hierarchical URLs to a park with theme areas and rides, using URL context as fallback
   */
  addUrlToParkWithDetailsAndContext(
    park: any,
    urlContext?: { continent?: string; country?: string; name?: string },
  ): any {
    if (!park) return park;

    // Use park data or fall back to URL context
    const effectivePark = {
      ...park,
      continent: park.continent || urlContext?.continent || 'unknown',
      country: park.country || urlContext?.country || 'unknown',
      name: park.name || urlContext?.name || 'unknown',
    };

    const parkWithUrl = this.addUrlToPark(effectivePark);

    // Create park context for rides (prefer URL context over potentially missing DB data)
    const parkContext = {
      continent: urlContext?.continent || park.continent || 'unknown',
      country: urlContext?.country || park.country || 'unknown',
      name: urlContext?.name || park.name || 'unknown',
    };

    // Add URLs to theme areas and rides if they exist
    if (park.themeAreas && Array.isArray(park.themeAreas)) {
      parkWithUrl.themeAreas = park.themeAreas.map((themeArea: any) => ({
        ...themeArea,
        rides: this.addUrlsToRides(themeArea.rides, parkContext),
      }));
    }

    return parkWithUrl;
  }
}
