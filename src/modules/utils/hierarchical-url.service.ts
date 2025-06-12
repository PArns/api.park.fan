import { Injectable } from '@nestjs/common';

/**
 * Utility service for generating hierarchical URLs for parks and rides
 */
@Injectable()
export class HierarchicalUrlService {
  /**
   * Convert a string to URL-friendly slug
   * Removes dots, replaces spaces with hyphens, converts to lowercase
   */
  static toSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/\./g, '') // Remove dots
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^\w\-]+/g, '') // Remove special characters except hyphens
      .replace(/\-\-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+/, '') // Remove leading hyphens
      .replace(/-+$/, ''); // Remove trailing hyphens
  } /**
   * Generate hierarchical URL for a park
   */
  static generateParkUrl(
    continent: string,
    country: string,
    parkName: string,
  ): string {
    const continentSlug = this.toSlug(continent);
    const countrySlug = this.toSlug(country);
    const parkSlug = this.toSlug(parkName);

    return `/parks/${continentSlug}/${countrySlug}/${parkSlug}`;
  }

  /**
   * Generate hierarchical URL for a ride
   */
  static generateRideUrl(
    continent: string,
    country: string,
    parkName: string,
    rideName: string,
  ): string {
    const continentSlug = this.toSlug(continent);
    const countrySlug = this.toSlug(country);
    const parkSlug = this.toSlug(parkName);
    const rideSlug = this.toSlug(rideName);

    return `/parks/${continentSlug}/${countrySlug}/${parkSlug}/${rideSlug}`;
  }

  /**
   * Convert slug back to possible text variations for matching
   */
  static fromSlug(slug: string): string[] {
    // Convert hyphen-separated slug back to possible original forms
    const withSpaces = slug.replace(/-/g, ' ');
    const withDots = slug.replace(/-/g, '.');
    const variations = [
      slug,
      withSpaces,
      withDots,
      // Try with different capitalizations
      this.capitalizeWords(withSpaces),
      this.capitalizeWords(withDots),
    ];

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Capitalize first letter of each word
   */
  private static capitalizeWords(text: string): string {
    return text.replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
