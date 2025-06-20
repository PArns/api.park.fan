export interface WeatherData {
  temperature: {
    min: number;
    max: number;
  };
  precipitationProbability: number;
  weatherCode: number;
  status: WeatherStatus;
  weatherScore: number; // 0-100% weather quality score (100% = perfect, 0% = terrible)
}

export enum WeatherStatus {
  SUNNY = 'sunny',
  PARTLY_CLOUDY = 'partly_cloudy',
  CLOUDY = 'cloudy',
  OVERCAST = 'overcast',
  LIGHT_RAIN = 'light_rain',
  RAIN = 'rain',
  HEAVY_RAIN = 'heavy_rain',
  THUNDERSTORM = 'thunderstorm',
  SNOW = 'snow',
  FOG = 'fog',
  DRIZZLE = 'drizzle',
}

export interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
}
