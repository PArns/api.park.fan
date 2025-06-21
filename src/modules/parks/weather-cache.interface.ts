export const WEATHER_CACHE_SERVICE = Symbol('WEATHER_CACHE_SERVICE');

export interface WeatherCacheService {
  // Park-based weather methods
  getCurrentWeatherForPark(parkId: number): Promise<any | null>;
  getForecastWeatherForPark(parkId: number): Promise<any[]>;
  getCompleteWeatherForPark(parkId: number): Promise<{
    current: any | null;
    forecast: any[];
  }>;
  getBatchCompleteWeatherForParks(parkIds: number[]): Promise<
    Map<
      number,
      {
        current: any | null;
        forecast: any[];
      }
    >
  >;
  clear(): Promise<void>;
}
