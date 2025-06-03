import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { ParkGroup } from './park-group.entity.js';
import { ThemeArea } from './theme-area.entity.js';
import { Ride } from './ride.entity.js';

@Entity()
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
