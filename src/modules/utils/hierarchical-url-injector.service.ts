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
  addUrlToRide(ride: any): any {
    if (!ride) return ride;

    // Determine park info structure
    let continent, country, parkName;

    if (ride.park) {
      // Nested structure
      continent = ride.park.continent;
      country = ride.park.country;
      parkName = ride.park.name;
    } else {
      // Flat structure (from statistics)
      continent = ride.continent;
      country = ride.country;
      parkName = ride.parkName;
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
  addUrlsToRides(rides: any[]): any[] {
    if (!rides || !Array.isArray(rides)) return rides;

    return rides.map((ride) => this.addUrlToRide(ride));
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

    // Add URLs to theme areas and rides if they exist
    if (park.themeAreas && Array.isArray(park.themeAreas)) {
      parkWithUrl.themeAreas = park.themeAreas.map((themeArea: any) => ({
        ...themeArea,
        rides: this.addUrlsToRides(themeArea.rides),
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
}
