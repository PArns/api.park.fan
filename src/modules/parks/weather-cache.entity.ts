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
import { WeatherStatus } from './weather.dto';
import { Park } from './park.entity';

export enum WeatherDataType {
  CURRENT = 'current',
  FORECAST = 'forecast',
  HISTORICAL = 'historical',
}

@Entity('weather_data')
@Index(['park', 'weatherDate', 'dataType'], { unique: true })
export class WeatherData {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  id: string; // Format: park_id_date_type_daysAhead

  @ManyToOne(() => Park, { eager: false, nullable: false })
  @JoinColumn({ name: 'park_id' })
  park: Park;

  @Column({ name: 'park_id' })
  parkId: number;

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
