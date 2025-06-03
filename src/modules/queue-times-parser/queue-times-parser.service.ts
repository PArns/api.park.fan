import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkGroup } from '../parks/park-group.entity.js';
import { Park } from '../parks/park.entity.js';
import { ThemeArea } from '../parks/theme-area.entity.js';
import { Ride } from '../parks/ride.entity.js';
import { QueueTime } from '../parks/queue-time.entity.js';
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
          where: { queueTimesId: groupData.id }
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
          await this.parkRepository.upsert({
            queueTimesId: parkData.id,
            name: parkData.name,
            country: parkData.country,
            continent: parkData.continent,
            latitude: parkData.latitude,
            longitude: parkData.longitude,
            timezone: parkData.timezone,
            parkGroup: parkGroup,
          }, ['queueTimesId']);
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
    
    let totalNewEntries = 0;
    let totalSkippedEntries = 0;
    let totalProcessedParks = 0;

    for (const park of parks) {
      try {
        const url = `https://queue-times.com/parks/${park.queueTimesId}/queue_times.json`;
        this.logger.debug(`Fetching queue times from ${url}`);
        
        const response = await axios.get(url);
        const data = response.data;
        const lands = data.lands || [];

        let parkNewEntries = 0;
        let parkSkippedEntries = 0;        for (const landData of lands) {
          try {
            // Create or update theme area
            let themeArea = await this.themeAreaRepository.findOne({
              where: { queueTimesId: landData.id, park: { id: park.id } }
            });

            if (!themeArea) {
              try {
                themeArea = this.themeAreaRepository.create({
                  queueTimesId: landData.id,
                  name: landData.name,
                  park: park,
                });
                await this.themeAreaRepository.save(themeArea);
              } catch (themeAreaError) {
                // Handle potential unique constraint violations for theme areas
                if (themeAreaError.code === '23505' || themeAreaError.message.includes('duplicate key value violates unique constraint')) {
                  // Try to find the existing theme area again
                  themeArea = await this.themeAreaRepository.findOne({
                    where: { queueTimesId: landData.id, park: { id: park.id } }
                  });
                  if (!themeArea) {
                    this.logger.warn(`Could not create or find theme area ${landData.name} for park ${park.name}`);
                    continue; // Skip this theme area
                  }
                } else {
                  throw themeAreaError;
                }
              }
            }

            // Process rides within this theme area
            for (const rideData of landData.rides) {
              try {
                // Create or update ride
                let ride = await this.rideRepository.findOne({
                  where: { queueTimesId: rideData.id, park: { id: park.id } }
                });

                if (!ride) {
                  try {
                    ride = this.rideRepository.create({
                      queueTimesId: rideData.id,
                      name: rideData.name,
                      park: park,
                      themeArea: themeArea,
                    });
                    await this.rideRepository.save(ride);
                  } catch (rideError) {
                    // Handle potential unique constraint violations for rides
                    if (rideError.code === '23505' || rideError.message.includes('duplicate key value violates unique constraint')) {
                      // Try to find the existing ride again
                      ride = await this.rideRepository.findOne({
                        where: { queueTimesId: rideData.id, park: { id: park.id } }
                      });
                      if (!ride) {
                        this.logger.warn(`Could not create or find ride ${rideData.name} for park ${park.name}`);
                        continue; // Skip this ride
                      }
                    } else {
                      throw rideError;
                    }
                  }
                }

                // Store queue time data only if ride is open and has valid wait time
                if (rideData.is_open && typeof rideData.wait_time === 'number') {
                  const lastUpdatedTime = rideData.last_updated ? new Date(rideData.last_updated) : new Date();
                  
                  try {
                    // Check if we already have a queue time entry with the same lastUpdated timestamp and wait time
                    // This prevents duplicate entries even if the API returns the same data multiple times
                    const existingQueueTime = await this.queueTimeRepository.findOne({
                      where: { 
                        ride: { id: ride.id },
                        lastUpdated: lastUpdatedTime,
                        waitTime: rideData.wait_time
                      },
                      order: { recordedAt: 'DESC' }
                    });

                    // Only save if we don't have this exact data already
                    if (!existingQueueTime) {
                      const queueTime = this.queueTimeRepository.create({
                        ride: ride,
                        waitTime: rideData.wait_time,
                        isOpen: rideData.is_open,
                        lastUpdated: lastUpdatedTime,
                        recordedAt: new Date(),
                      });

                      await this.queueTimeRepository.save(queueTime);
                      parkNewEntries++;
                      this.logger.debug(`Saved new queue time for ${ride.name}: ${rideData.wait_time}min (updated: ${lastUpdatedTime.toISOString()})`);
                    } else {
                      parkSkippedEntries++;
                      this.logger.debug(`Skipped queue time for ${ride.name}: duplicate data (${rideData.wait_time}min at ${lastUpdatedTime.toISOString()})`);
                    }
                  } catch (error) {
                    // Handle unique constraint violations gracefully
                    if (error.code === '23505' || error.message.includes('duplicate key value violates unique constraint')) {
                      parkSkippedEntries++;
                      this.logger.debug(`Skipped queue time for ${ride.name}: duplicate detected at database level (${rideData.wait_time}min at ${lastUpdatedTime.toISOString()})`);
                    } else {
                      this.logger.warn(`Error saving queue time for ${ride.name}: ${error.message}`);
                    }
                  }
                }
              } catch (rideProcessingError) {
                this.logger.warn(`Error processing ride ${rideData.name} in park ${park.name}: ${rideProcessingError.message}`);
                // Continue with next ride
              }
            }
          } catch (landProcessingError) {
            this.logger.warn(`Error processing theme area ${landData.name} in park ${park.name}: ${landProcessingError.message}`);
            // Continue with next theme area
          }
        }totalNewEntries += parkNewEntries;
        totalSkippedEntries += parkSkippedEntries;
        totalProcessedParks++;
        
        this.logger.debug(`Successfully processed queue times for park: ${park.name} (${parkNewEntries} new, ${parkSkippedEntries} skipped)`);
      } catch (error) {
        this.logger.warn(`Failed to fetch queue times for park ${park.name}: ${error.message}`);
        // Continue processing other parks even if one fails
      }
    }

    this.logger.log(`Queue times update completed: ${totalProcessedParks} parks processed, ${totalNewEntries} new entries, ${totalSkippedEntries} skipped (no new data)`);
  }

  /**
   * Batch check for existing queue times to improve performance
   * @param rideId The ride ID to check
   * @param timestamps Array of timestamps to check
   * @returns Set of existing timestamps
   */
  private async getExistingQueueTimeTimestamps(rideId: number, timestamps: Date[]): Promise<Set<string>> {
    if (timestamps.length === 0) return new Set();
    
    const existingTimes = await this.queueTimeRepository.find({
      where: { 
        ride: { id: rideId },
        lastUpdated: timestamps.length === 1 ? timestamps[0] : undefined
      },
      select: ['lastUpdated', 'waitTime']
    });
    
    return new Set(existingTimes.map(qt => `${qt.lastUpdated.toISOString()}_${qt.waitTime}`));
  }

  /**
   * Get statistics about queue time data to monitor duplicate prevention effectiveness
   * @returns Object with various statistics
   */
  async getQueueTimeStatistics(): Promise<{
    totalEntries: number;
    uniqueTimestamps: number;
    duplicatePreventionRate: number;
    entriesPerRide: { rideName: string; count: number }[];
  }> {
    const totalEntries = await this.queueTimeRepository.count();
    
    const uniqueTimestamps = await this.queueTimeRepository
      .createQueryBuilder('qt')
      .select('COUNT(DISTINCT qt.lastUpdated)', 'count')
      .getRawOne();
    
    const entriesPerRide = await this.queueTimeRepository
      .createQueryBuilder('qt')
      .leftJoin('qt.ride', 'ride')
      .select('ride.name', 'rideName')
      .addSelect('COUNT(qt.id)', 'count')
      .groupBy('ride.name')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
    
    const duplicatePreventionRate = totalEntries > 0 
      ? ((totalEntries - parseInt(uniqueTimestamps.count)) / totalEntries) * 100 
      : 0;
    
    return {
      totalEntries,
      uniqueTimestamps: parseInt(uniqueTimestamps.count),
      duplicatePreventionRate: Math.round(duplicatePreventionRate * 100) / 100,
      entriesPerRide: entriesPerRide.map(item => ({
        rideName: item.rideName,
        count: parseInt(item.count)
      }))
    };
  }

  /**
   * Clean up any existing duplicate queue time entries
   * This should be run once to clean up data from before duplicate prevention was implemented
   */
  async cleanupDuplicateQueueTimes(): Promise<{ removedCount: number }> {
    this.logger.log('Starting cleanup of duplicate queue time entries...');
    
    // Find duplicates based on ride, lastUpdated, and waitTime
    const duplicates = await this.queueTimeRepository
      .createQueryBuilder('qt1')
      .select('qt1.id')
      .where(qb => {
        const subQuery = qb.subQuery()
          .select('MIN(qt2.id)')
          .from(QueueTime, 'qt2')
          .where('qt2.ride = qt1.ride')
          .andWhere('qt2.lastUpdated = qt1.lastUpdated')
          .andWhere('qt2.waitTime = qt1.waitTime')
          .getQuery();
        return 'qt1.id != (' + subQuery + ')';
      })
      .getMany();
    
    if (duplicates.length > 0) {
      const duplicateIds = duplicates.map(d => d.id);
      await this.queueTimeRepository.delete(duplicateIds);
      this.logger.log(`Removed ${duplicates.length} duplicate queue time entries`);
    } else {
      this.logger.log('No duplicate queue time entries found');
    }
    
    return { removedCount: duplicates.length };
  }
}
