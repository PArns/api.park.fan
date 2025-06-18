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

    let totalNewEntries = 0;
    let totalSkippedEntries = 0;
    let totalProcessedParks = 0;

    for (const park of parks) {
      try {
        const url = `https://queue-times.com/parks/${park.queueTimesId}/queue_times.json`;

        const response = await axios.get(url);
        const data = response.data;
        const lands = data.lands || [];

        let parkNewEntries = 0;
        let parkSkippedEntries = 0;
        for (const landData of lands) {
          try {
            // Create or update theme area
            let themeArea = await this.themeAreaRepository.findOne({
              where: { queueTimesId: landData.id, park: { id: park.id } },
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
                if (
                  themeAreaError.code === '23505' ||
                  themeAreaError.message.includes(
                    'duplicate key value violates unique constraint',
                  )
                ) {
                  // Try to find the existing theme area again
                  themeArea = await this.themeAreaRepository.findOne({
                    where: { queueTimesId: landData.id, park: { id: park.id } },
                  });
                  if (!themeArea) {
                    this.logger.warn(
                      `Could not create or find theme area ${landData.name} for park ${park.name}`,
                    );
                    continue; // Skip this theme area
                  }
                } else {
                  throw themeAreaError;
                }
              }
            }

            // Process rides within this theme area
            for (const rideData of landData.rides) {
              const result = await this.processRide(
                rideData,
                park,
                themeArea,
                false, // not a direct ride
              );
              parkNewEntries += result.newEntries;
              parkSkippedEntries += result.skippedEntries;
            }
          } catch (landProcessingError) {
            this.logger.warn(
              `Error processing theme area ${landData.name} in park ${park.name}: ${landProcessingError.message}`,
            );
            // Continue with next theme area
          }
        }

        // Process rides that are not in theme areas (directly in the rides array)
        const directRides = data.rides || [];
        if (directRides.length > 0) {

          // Create or get a default theme area for direct rides
          let defaultThemeArea = await this.themeAreaRepository.findOne({
            where: {
              queueTimesId: null,
              park: { id: park.id },
              name: 'General',
            },
          });

          if (!defaultThemeArea) {
            try {
              defaultThemeArea = this.themeAreaRepository.create({
                queueTimesId: null, // No queueTimesId for default theme area
                name: 'General',
                park: park,
              });
              await this.themeAreaRepository.save(defaultThemeArea);
            } catch (defaultThemeAreaError) {
              // Handle potential unique constraint violations
              if (
                defaultThemeAreaError.code === '23505' ||
                defaultThemeAreaError.message.includes(
                  'duplicate key value violates unique constraint',
                )
              ) {
                // Try to find the existing default theme area again
                defaultThemeArea = await this.themeAreaRepository.findOne({
                  where: {
                    queueTimesId: null,
                    park: { id: park.id },
                    name: 'General',
                  },
                });
              }
              if (!defaultThemeArea) {
                this.logger.warn(
                  `Could not create or find default theme area for park ${park.name}`,
                );
                continue; // Skip processing direct rides for this park
              }
            }
          }

          // Process each direct ride
          for (const rideData of directRides) {
            const result = await this.processRide(
              rideData,
              park,
              defaultThemeArea,
              true, // is a direct ride
            );
            parkNewEntries += result.newEntries;
            parkSkippedEntries += result.skippedEntries;
          }
        }

        totalNewEntries += parkNewEntries;
        totalSkippedEntries += parkSkippedEntries;
        totalProcessedParks++;
      } catch (error) {
        this.logger.warn(
          `Failed to fetch queue times for park ${park.name}: ${error.message}`,
        );
        // Continue processing other parks even if one fails
      }
    }

    this.logger.log(
      `Queue times update completed: ${totalProcessedParks} parks processed, ${totalNewEntries} new entries, ${totalSkippedEntries} skipped (no new data)`,
    );
  }

  /**
   * Get statistics about queue time data to monitor duplicate prevention effectiveness
   * @returns Object with various statistics
   */
  async getQueueTimeStatistics(): Promise<{
    totalEntries: number;
    uniqueTimestamps: number;
    duplicatePreventionRate: number;
  }> {
    const totalEntries = await this.queueTimeRepository.count();

    const uniqueTimestamps = await this.queueTimeRepository
      .createQueryBuilder('qt')
      .select('COUNT(DISTINCT qt.lastUpdated)', 'count')
      .getRawOne();

    const duplicatePreventionRate =
      totalEntries > 0
        ? ((totalEntries - parseInt(uniqueTimestamps.count)) / totalEntries) *
          100
        : 0;

    return {
      totalEntries,
      uniqueTimestamps: parseInt(uniqueTimestamps.count),
      duplicatePreventionRate: Math.round(duplicatePreventionRate * 100) / 100,
    };
  }

  /**
   * Process a single ride and its queue time data
   * @param rideData The ride data from the API
   * @param park The park entity
   * @param themeArea The theme area entity
   * @param isDirectRide Whether this is a direct ride or within a theme area
   * @returns Object with newEntries and skippedEntries counts
   */
  private async processRide(
    rideData: any,
    park: Park,
    themeArea: ThemeArea,
    isDirectRide: boolean,
  ): Promise<{ newEntries: number; skippedEntries: number }> {
    let newEntries = 0;
    let skippedEntries = 0;

    try {
      // Find existing ride or create new one using upsert approach
      const rideExists = await this.rideRepository.findOne({
        where: { queueTimesId: rideData.id, park: { id: park.id } },
        relations: ['themeArea', 'park'],
      });

      let ride;
      if (!rideExists) {
        try {
          // Use upsert to handle potential race conditions
          await this.rideRepository.upsert(
            {
              queueTimesId: rideData.id,
              name: rideData.name,
              park: { id: park.id } as Park,
              themeArea: { id: themeArea.id } as ThemeArea,
              isActive: true,
            },
            ['queueTimesId', 'park'],
          );

          // Fetch the ride again after upsert
          ride = await this.rideRepository.findOne({
            where: { queueTimesId: rideData.id, park: { id: park.id } },
            relations: ['themeArea', 'park'],
          });
        } catch (rideError) {
          this.logger.warn(
            `Error upserting ${isDirectRide ? 'direct ' : ''}ride ${rideData.name} for park ${park.name}: ${rideError.message}`,
          );
          return { newEntries, skippedEntries };
        }
      } else {
        ride = rideExists;
      }

      if (!ride) {
        this.logger.warn(
          `Could not create or find ${isDirectRide ? 'direct ' : ''}ride ${rideData.name} for park ${park.name}`,
        );
        return { newEntries, skippedEntries };
      }

      // Store queue time data only if it has valid wait time
      if (typeof rideData.wait_time === 'number') {
        const lastUpdatedTime = rideData.last_updated
          ? new Date(rideData.last_updated)
          : new Date();

        try {
          // Check if we already have a queue time entry with the same lastUpdated timestamp and wait time
          const existingQueueTime = await this.queueTimeRepository.findOne({
            where: {
              ride: { id: ride.id },
              lastUpdated: lastUpdatedTime,
              waitTime: Math.max(0, rideData.wait_time),
            },
            order: { recordedAt: 'DESC' },
          });

          // Only save if we don't have this exact data already
          if (!existingQueueTime) {
            const queueTime = this.queueTimeRepository.create({
              ride: ride,
              waitTime: Math.max(0, rideData.wait_time),
              isOpen: rideData.is_open,
              lastUpdated: lastUpdatedTime,
              recordedAt: new Date(),
            });

            await this.queueTimeRepository.save(queueTime);
            newEntries++;
          } else {
            skippedEntries++;
          }
        } catch (error) {
          // Handle unique constraint violations gracefully
          if (
            error.code === '23505' ||
            error.message.includes(
              'duplicate key value violates unique constraint',
            )
          ) {
            skippedEntries++;
          } else {
            this.logger.warn(
              `Error saving queue time for ${isDirectRide ? 'direct ' : ''}ride ${ride.name}: ${error.message}`,
            );
          }
        }
      }
    } catch (rideProcessingError) {
      this.logger.warn(
        `Error processing ${isDirectRide ? 'direct ' : ''}ride ${rideData.name} in park ${park.name}: ${rideProcessingError.message}`,
      );
      if (isDirectRide) {
        this.logger.debug(
          `Error details - Park ID: ${park.id}, Ride Queue Times ID: ${rideData.id}, Last Updated: ${rideData.last_updated}`,
        );
        this.logger.debug(`Full error stack: ${rideProcessingError.stack}`);
      }
    }

    return { newEntries, skippedEntries };
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
      .where((qb) => {
        const subQuery = qb
          .subQuery()
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
      const duplicateIds = duplicates.map((d) => d.id);
      await this.queueTimeRepository.delete(duplicateIds);
      this.logger.log(
        `Removed ${duplicates.length} duplicate queue time entries`,
      );
    } else {
      this.logger.log('No duplicate queue time entries found');
    }

    return { removedCount: duplicates.length };
  }
}
