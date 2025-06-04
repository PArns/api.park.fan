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
