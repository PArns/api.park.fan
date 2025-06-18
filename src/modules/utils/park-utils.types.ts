/**
 * Types for Park-Utils services
 */

export {};

export interface QueueTime {
  id?: number;
  waitTime: number | null;
  isOpen: boolean;
  lastUpdated: Date;
}

export interface Ride {
  id: number;
  name: string;
  isActive: boolean;
  queueTimes?: QueueTime[];
}

export interface ThemeArea {
  id: number;
  name: string;
  rides: Ride[];
}

export interface Park {
  id: number;
  name: string;
  country: string;
  continent: string;
  themeAreas: ThemeArea[];
}

export interface WaitTimeDistribution {
  '0-10': number;
  '11-30': number;
  '31-60': number;
  '61-120': number;
  '120+': number;
}

export interface ParkOperatingStatus {
  isOpen: boolean;
  openRideCount: number;
  totalRideCount: number;
  operatingPercentage: number;
}

export interface CrowdLevel {
  /**
   * Current crowd level as percentage (0-200+)
   * 100 = historical average, >100 = busier than usual
   */
  level: number;

  /**
   * Descriptive label for the crowd level
   */
  label: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High' | 'Extreme';

  /**
   * Number of rides used for calculation (top X% of park)
   */
  ridesUsed: number;

  /**
   * Total number of rides in park
   */
  totalRides: number;

  /**
   * Historical baseline (95th percentile over 2 years)
   */
  historicalBaseline: number;

  /**
   * Current average wait time of top rides
   */
  currentAverage: number;

  /**
   * Confidence level of the calculation (0-100)
   * Lower if insufficient historical data
   */
  confidence: number;

  /**
   * Last calculation timestamp
   */
  calculatedAt: Date;
}

export interface ParkWithCrowdLevel extends ParkOperatingStatus {
  crowdLevel: CrowdLevel;
}
