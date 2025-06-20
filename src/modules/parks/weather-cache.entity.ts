import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WeatherStatus } from './weather.dto.js';
import { Park } from './park.entity.js';

export enum WeatherDataType {
  CURRENT = 'current',
  FORECAST = 'forecast',
  HISTORICAL = 'historical',
}

@Entity('weather_data')
@Index(['park', 'weatherDate', 'dataType'], { unique: true })
export class WeatherData {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  id: string; // Format: park_id_date_type

  @ManyToOne(() => Park, { eager: false, nullable: true })
  @JoinColumn({ name: 'park_id' })
  park?: Park;

  @Column({ name: 'park_id', nullable: true })
  parkId?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'varchar', length: 100 })
  timezone: string;

  @Column({ type: 'date' })
  weatherDate: Date;

  @Column({
    type: 'enum',
    enum: WeatherDataType,
    default: WeatherDataType.CURRENT,
  })
  dataType: WeatherDataType;

  // Weather data
  @Column({ type: 'int' })
  temperatureMin: number;

  @Column({ type: 'int' })
  temperatureMax: number;

  @Column({ type: 'int' })
  precipitationProbability: number;

  @Column({ type: 'int' })
  weatherCode: number;

  @Column({ type: 'enum', enum: WeatherStatus })
  status: WeatherStatus;

  @Column({ type: 'int' })
  weatherScore: number;

  // Forecast-specific data
  @Column({ type: 'date', nullable: true })
  forecastCreatedDate?: Date; // When the forecast was created

  @Column({ type: 'int', nullable: true })
  daysAhead?: number; // How many days ahead this forecast was for

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Metadata for cache management
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  validUntil: Date;

  @Column({ type: 'boolean', default: false })
  isFetchFailed: boolean; // Track failed API calls to avoid repeated attempts
}
