import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  Index,
} from 'typeorm';
import { ParkGroup } from './park-group.entity';
import { ThemeArea } from './theme-area.entity';
import { Ride } from './ride.entity';

@Entity()
@Index('IDX_PARK_NAME')
@Index('IDX_PARK_COUNTRY')
@Index('IDX_PARK_CONTINENT')
@Index('IDX_PARK_QUEUE_TIMES_ID', ['queueTimesId'])
@Index('IDX_PARK_CONT_COUNTRY_NAME', ['continent', 'country', 'name'])
export class Park {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  queueTimesId: number; // ID from queue-times.com

  @Column()
  name: string;

  @Column()
  country: string;

  @Column()
  continent: string;

  @Column('decimal', { precision: 10, scale: 6 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 6 })
  longitude: number;

  @Column()
  timezone: string;

  @ManyToOne(() => ParkGroup, (parkGroup: ParkGroup) => parkGroup.parks, {
    onDelete: 'CASCADE',
  })
  parkGroup: ParkGroup;

  @OneToMany(() => ThemeArea, (themeArea: ThemeArea) => themeArea.park)
  themeAreas: ThemeArea[];

  @OneToMany(() => Ride, (ride: Ride) => ride.park)
  rides: Ride[];
}
