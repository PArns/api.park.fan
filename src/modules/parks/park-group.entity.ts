import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Park } from './park.entity';

@Entity()
export class ParkGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  queueTimesId: number; // ID from queue-times.com

  @Column()
  name: string;

  @OneToMany(() => Park, (park: Park) => park.parkGroup)
  parks: Park[];
}
