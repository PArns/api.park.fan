import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
  Index,
} from 'typeorm';
import { Park } from './park.entity.js';
import { ThemeArea } from './theme-area.entity.js';
import { QueueTime } from './queue-time.entity.js';

@Entity()
@Unique(['queueTimesId', 'park']) // Unique constraint on queueTimesId + park combination
@Index('IDX_ride_park', ['park'])
@Index('IDX_ride_theme_area', ['themeArea'])
@Index('IDX_ride_is_active', ['isActive'])
export class Ride {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  queueTimesId: number; // ID from queue-times.com (not globally unique)

  @Column()
  name: string;

  @Column({ default: true })
  isActive: boolean; // Whether the attraction still exists/operates

  @ManyToOne(() => Park, (park: Park) => park.rides, { onDelete: 'CASCADE' })
  park: Park;

  @ManyToOne(() => ThemeArea, (themeArea: ThemeArea) => themeArea.rides, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  themeArea: ThemeArea | null; // Optional - ride can exist without being assigned to a theme area

  @OneToMany(() => QueueTime, (queueTime: QueueTime) => queueTime.ride, {
    lazy: true,
  })
  queueTimes: Promise<QueueTime[]>;
}
