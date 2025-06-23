import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Ride } from './ride.entity.js';

@Entity()
@Index(['ride', 'lastUpdated']) // Optimizes the duplicate check query
@Index(['ride', 'lastUpdated', 'waitTime']) // Additional index for full duplicate prevention
@Index(['ride', 'lastUpdated', 'recordedAt']) // Optimizes fetching latest queue time for a ride
export class QueueTime {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Ride, (ride: Ride) => ride.queueTimes, {
    onDelete: 'CASCADE',
  })
  ride: Ride;

  @Column('int', {
    transformer: {
      to: (value: number) => Math.max(0, value),
      from: (value: number) => value,
    },
  })
  waitTime: number;

  @Column({ default: true })
  isOpen: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUpdated: Date; // Timestamp from the API

  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt: Date; // Timestamp when we recorded the data
}
