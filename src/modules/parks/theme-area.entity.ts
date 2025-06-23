import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
  Index,
} from 'typeorm';
import { Park } from './park.entity';
import { Ride } from './ride.entity';

@Entity()
@Unique(['queueTimesId', 'park'])
// Index on theme area name for quick filtering
@Index('IDX_THEME_AREA_NAME', ['name'])
@Index('IDX_THEME_AREA_PARK_NAME', ['park', 'name'])
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
