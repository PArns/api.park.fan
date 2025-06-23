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
import { Ride } from './ride.entity.js';

@Entity()
@Unique(['queueTimesId', 'park'])
@Index('IDX_theme_area_park', ['park'])
export class ThemeArea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  queueTimesId: number; // ID from queue-times.com

  @Column()
  name: string; // e.g., "Coasters", "Family rides", "Thrill rides"

  @ManyToOne(() => Park, (park: Park) => park.themeAreas, {
    onDelete: 'CASCADE',
  })
  park: Park;

  @OneToMany(() => Ride, (ride: Ride) => ride.themeArea)
  rides: Ride[];
}
