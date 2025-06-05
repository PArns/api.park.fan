import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkGroup } from './parks/park-group.entity.js';
import { Park } from './parks/park.entity.js';
import { ThemeArea } from './parks/theme-area.entity.js';
import { Ride } from './parks/ride.entity.js';
import { QueueTime } from './parks/queue-time.entity.js';
import axios from 'axios';

@Injectable()
export class QueueTimesParserService {
  private readonly logger = new Logger(QueueTimesParserService.name);

  constructor(
    @InjectRepository(ParkGroup)
    private readonly parkGroupRepository: Repository<ParkGroup>,
    @InjectRepository(Park)
    private readonly parkRepository: Repository<Park>,
    @InjectRepository(ThemeArea)
    private readonly themeAreaRepository: Repository<ThemeArea>,
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    @InjectRepository(QueueTime)
    private readonly queueTimeRepository: Repository<QueueTime>,
  ) {}

  async fetchAndStoreParks(): Promise<void> {
    try {
      const url = 'https://queue-times.com/parks.json';
      this.logger.log(`Fetching parks from ${url}`);
      const response = await axios.get(url);
      const groups = response.data;

      for (const groupData of groups) {
        // Create or update park group
        let parkGroup = await this.parkGroupRepository.findOne({
          where: { queueTimesId: groupData.id },
        });

        if (!parkGroup) {
          parkGroup = this.parkGroupRepository.create({
            queueTimesId: groupData.id,
            name: groupData.name,
          });
          await this.parkGroupRepository.save(parkGroup);
        }

        // Process parks within this group
        for (const parkData of groupData.parks) {
          await this.parkRepository.upsert(
            {
              queueTimesId: parkData.id,
              name: parkData.name,
              country: parkData.country,
              continent: parkData.continent,
              latitude: parkData.latitude,
              longitude: parkData.longitude,
              timezone: parkData.timezone,
              parkGroup: parkGroup,
            },
            ['queueTimesId'],
          );
        }
      }

      this.logger.log('Parks and park groups updated successfully');
    } catch (error) {
      this.logger.error('Failed to fetch and store parks', error);
      throw error;
    }
  }

  async fetchAndStoreQueueTimes(): Promise<void> {
    const parks = await this.parkRepository.find();
    this.logger.log(`Processing queue times for ${parks.length} parks`);

    for (const park of parks) {
      try {
        const url = `https://queue-times.com/parks/${park.queueTimesId}/queue_times.json`;
        this.logger.debug(`Fetching queue times from ${url}`);

        const response = await axios.get(url);
        const data = response.data;
        const lands = data.lands || [];

        for (const landData of lands) {
          // Create or update theme area
          let themeArea = await this.themeAreaRepository.findOne({
            where: { queueTimesId: landData.id, park: { id: park.id } },
          });

          if (!themeArea) {
            themeArea = this.themeAreaRepository.create({
              queueTimesId: landData.id,
              name: landData.name,
              park: park,
            });
            await this.themeAreaRepository.save(themeArea);
          }

          // Process rides within this theme area
          for (const rideData of landData.rides) {
            // Create or update ride
            let ride = await this.rideRepository.findOne({
              where: { queueTimesId: rideData.id, park: { id: park.id } },
            });

            if (!ride) {
              ride = this.rideRepository.create({
                queueTimesId: rideData.id,
                name: rideData.name,
                park: park,
                themeArea: themeArea,
              });
              await this.rideRepository.save(ride);
            }

            // Store queue time data only if ride is open and has valid wait time
            if (rideData.is_open && typeof rideData.wait_time === 'number') {
              const queueTime = this.queueTimeRepository.create({
                ride: ride,
                waitTime: Math.max(0, rideData.wait_time),
                isOpen: rideData.is_open,
                lastUpdated: rideData.last_updated
                  ? new Date(rideData.last_updated)
                  : new Date(),
                recordedAt: new Date(),
              });

              await this.queueTimeRepository.save(queueTime);
            }
          }
        }

        this.logger.debug(
          `Successfully processed queue times for park: ${park.name}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to fetch queue times for park ${park.name}: ${error.message}`,
        );
        // Continue processing other parks even if one fails
      }
    }

    this.logger.log('Queue times update completed');
  }
}
