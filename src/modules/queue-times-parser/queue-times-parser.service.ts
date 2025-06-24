import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkGroup } from '../parks/park-group.entity.js';
import { Park } from '../parks/park.entity.js';
import { ThemeArea } from '../parks/theme-area.entity.js';
import { Ride } from '../parks/ride.entity.js';
import { QueueTime } from '../parks/queue-time.entity.js';
import { CacheService } from '../utils/cache.service.js';
import axios from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class QueueTimesParserService {
  private readonly logger = new Logger(QueueTimesParserService.name);
  private isParksUpdateRunning = false;
  private isQueueTimesUpdateRunning = false;
  private readonly BATCH_SIZE = 20;
  private readonly BATCH_DELAY_MS = 100;
  private readonly userAgent: string;

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
    private readonly cacheService: CacheService,
  ) {
    // Dynamically read version from package.json
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      this.userAgent = `ParkFan-API/${packageJson.version}`;
    } catch (error) {
      this.logger.warn(
        'Could not read package.json, using fallback user agent',
      );
      this.userAgent = 'ParkFan-API/0.4.7';
    }
  }

  async fetchAndStoreParks(): Promise<void> {
    if (this.isParksUpdateRunning) {
      this.logger.warn(
        'Parks update is already running, skipping this execution',
      );
      return;
    }

    this.isParksUpdateRunning = true;
    try {
      const url = 'https://queue-times.com/parks.json';
      this.logger.log(`Fetching parks from ${url}`);
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });
      const groups = response.data;

      // Collect all park groups and parks for bulk operations
      const parkGroupsToUpsert = [];
      const parksToUpsert = [];

      for (const groupData of groups) {
        parkGroupsToUpsert.push({
          queueTimesId: groupData.id,
          name: groupData.name,
        });

        // Collect parks with their group reference
        for (const parkData of groupData.parks) {
          parksToUpsert.push({
            queueTimesId: parkData.id,
            name: parkData.name,
            country: parkData.country,
            continent: parkData.continent,
            latitude: parkData.latitude,
            longitude: parkData.longitude,
            timezone: parkData.timezone,
            parkGroupQueueTimesId: groupData.id, // Temporary field for mapping
          });
        }
      }

      // Step 1: Bulk upsert park groups
      if (parkGroupsToUpsert.length > 0) {
        await this.parkGroupRepository.upsert(parkGroupsToUpsert, [
          'queueTimesId',
        ]);
      }

      // Step 2: Create park group lookup map
      const parkGroupMap = new Map<number, any>();
      if (parkGroupsToUpsert.length > 0) {
        const parkGroups = await this.parkGroupRepository.find({
          select: ['id', 'queueTimesId'],
        });

        for (const parkGroup of parkGroups) {
          parkGroupMap.set(parkGroup.queueTimesId, parkGroup);
        }
      }

      // Step 3: Map parks to their park groups and bulk upsert
      const parksWithGroupReferences = parksToUpsert.map((park) => ({
        queueTimesId: park.queueTimesId,
        name: park.name,
        country: park.country,
        continent: park.continent,
        latitude: park.latitude,
        longitude: park.longitude,
        timezone: park.timezone,
        parkGroup: parkGroupMap.get(park.parkGroupQueueTimesId),
      }));

      if (parksWithGroupReferences.length > 0) {
        // Use smaller batches for parks to avoid memory issues
        const PARK_BATCH_SIZE = 50;
        for (
          let i = 0;
          i < parksWithGroupReferences.length;
          i += PARK_BATCH_SIZE
        ) {
          const batch = parksWithGroupReferences.slice(i, i + PARK_BATCH_SIZE);
          await this.parkRepository.upsert(batch, ['queueTimesId']);
        }
      }

      this.logger.log(
        `Parks and park groups updated successfully: ${parkGroupsToUpsert.length} groups, ${parksToUpsert.length} parks`,
      );
    } catch (error) {
      this.logger.error('Failed to fetch and store parks', error);
      throw error;
    } finally {
      this.isParksUpdateRunning = false;
    }
  }

  async fetchAndStoreQueueTimes(): Promise<void> {
    if (this.isQueueTimesUpdateRunning) {
      this.logger.warn(
        'Queue times update is already running, skipping this execution',
      );
      return;
    }

    this.isQueueTimesUpdateRunning = true;
    try {
      // Use streaming approach to avoid loading all parks into memory
      const totalParks = await this.parkRepository.count();
      this.logger.log(`Processing queue times for ${totalParks} parks`);

      let totalNewEntries = 0;
      let totalSkippedEntries = 0;
      let totalProcessedParks = 0;
      let offset = 0;

      // Process parks in smaller chunks using pagination instead of loading all at once
      while (offset < totalParks) {
        const parks = await this.parkRepository.find({
          skip: offset,
          take: this.BATCH_SIZE,
          select: ['id', 'queueTimesId', 'name'], // Only select needed fields
        });

        if (parks.length === 0) break;

        this.logger.log(
          `Processing parks ${offset + 1}-${offset + parks.length} of ${totalParks}`,
        );

        const batchPromises = parks.map((park) =>
          this.processParkQueueTimes(park),
        );
        const batchResults = await Promise.allSettled(batchPromises);

        // Aggregate results from this batch
        batchResults.forEach((result, index) => {
          const park = parks[index];
          if (result.status === 'fulfilled') {
            totalNewEntries += result.value.newEntries;
            totalSkippedEntries += result.value.skippedEntries;
            totalProcessedParks++;
          } else {
            this.logger.error(
              `Failed to fetch queue times for park ${park.name}: ${result.reason?.message || 'Unknown error'}`,
            );
          }
        });

        offset += this.BATCH_SIZE;

        // Small delay between batches to be nice to the API
        if (offset < totalParks) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.BATCH_DELAY_MS),
          );
        }
      }

      this.logger.log(
        `Queue times update completed: ${totalProcessedParks} parks processed, ${totalNewEntries} new entries, ${totalSkippedEntries} skipped (no new data)`,
      );
    } catch (error) {
      this.logger.error('Failed to process queue times update', error);
      throw error;
    } finally {
      this.isQueueTimesUpdateRunning = false;
    }
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
   * Process a single ride and its queue time data with bulk operations optimization
   * @param rideData The ride data from the API
   * @param parkId The park ID
   * @param themeAreaId The theme area ID
   * @param isDirectRide Whether this is a direct ride or within a theme area
   * @returns Object with newEntries and skippedEntries counts
   */
  private async processRide(
    rideData: any,
    parkId: number,
    themeAreaId: number,
    isDirectRide: boolean,
  ): Promise<{ newEntries: number; skippedEntries: number }> {
    let newEntries = 0;
    let skippedEntries = 0;

    try {
      // Use upsert to create or update ride efficiently
      await this.rideRepository.upsert(
        {
          queueTimesId: rideData.id,
          name: rideData.name,
          park: { id: parkId } as Park,
          themeArea: { id: themeAreaId } as ThemeArea,
          isActive: true,
        },
        ['queueTimesId', 'park'],
      );

      // Store queue time data only if it has valid wait time
      if (typeof rideData.wait_time === 'number') {
        const lastUpdatedTime = rideData.last_updated
          ? new Date(rideData.last_updated)
          : new Date();

        try {
          // Use a more efficient approach with a single insert query and ON CONFLICT handling
          const insertResult = await this.queueTimeRepository
            .createQueryBuilder()
            .insert()
            .into(QueueTime)
            .values({
              ride: () =>
                `(SELECT r.id FROM ride r WHERE r.queueTimesId = ${rideData.id} AND r.parkId = ${parkId})`,
              waitTime: Math.max(0, rideData.wait_time),
              isOpen: rideData.is_open,
              lastUpdated: lastUpdatedTime,
              recordedAt: new Date(),
            })
            .onConflict(`DO NOTHING`) // Skip if duplicate based on any unique constraints
            .execute();

          // Check if a new row was inserted
          if (insertResult.identifiers && insertResult.identifiers.length > 0) {
            newEntries++;
          } else {
            skippedEntries++;
          }
        } catch (error) {
          // Handle constraint violations gracefully
          if (
            error.code === '23505' ||
            error.message.includes('duplicate key') ||
            error.message.includes('unique constraint')
          ) {
            skippedEntries++;
          } else {
            this.logger.warn(
              `Error saving queue time for ${isDirectRide ? 'direct ' : ''}ride ${rideData.name}: ${error.message}`,
            );
            // Try fallback approach for reliability
            try {
              const existingCount = await this.queueTimeRepository.count({
                where: {
                  ride: { queueTimesId: rideData.id, park: { id: parkId } },
                  lastUpdated: lastUpdatedTime,
                  waitTime: Math.max(0, rideData.wait_time),
                },
              });

              if (existingCount === 0) {
                const queueTime = this.queueTimeRepository.create({
                  ride: {
                    queueTimesId: rideData.id,
                    park: { id: parkId },
                  } as any,
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
            } catch (fallbackError) {
              this.logger.warn(
                `Fallback save also failed for ride ${rideData.name}: ${fallbackError.message}`,
              );
              skippedEntries++;
            }
          }
        }
      }
    } catch (rideProcessingError) {
      this.logger.warn(
        `Error processing ${isDirectRide ? 'direct ' : ''}ride ${rideData.name}: ${rideProcessingError.message}`,
      );
      skippedEntries++;
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

  /**
   * Helper method to chunk an array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Process queue times for a single park with full bulk optimization
   */
  private async processParkQueueTimes(
    park: any,
  ): Promise<{ newEntries: number; skippedEntries: number }> {
    const url = `https://queue-times.com/parks/${park.queueTimesId}/queue_times.json`;

    try {
      const response = await axios.get(url, {
        timeout: 15000, // 15 second timeout
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      const data = response.data;
      const lands = data.lands || [];

      let parkNewEntries = 0;
      let parkSkippedEntries = 0;

      // Collect all theme areas, rides, and queue times for batch processing
      const themeAreasToUpsert = [];
      const ridesToUpsert = [];
      const queueTimesToInsert = [];

      for (const landData of lands) {
        themeAreasToUpsert.push({
          queueTimesId: landData.id,
          name: landData.name,
          park: { id: park.id } as Park,
        });

        for (const rideData of landData.rides) {
          ridesToUpsert.push({
            queueTimesId: rideData.id,
            name: rideData.name,
            park: { id: park.id } as Park,
            themeArea: { queueTimesId: landData.id } as any, // Will be resolved later
            isActive: true,
          });

          // Prepare queue time data if valid
          if (typeof rideData.wait_time === 'number') {
            const lastUpdatedTime = rideData.last_updated
              ? new Date(rideData.last_updated)
              : new Date();

            queueTimesToInsert.push({
              rideQueueTimesId: rideData.id,
              waitTime: Math.max(0, rideData.wait_time),
              isOpen: rideData.is_open,
              lastUpdated: lastUpdatedTime,
              recordedAt: new Date(),
            });
          }
        }
      }

      // Step 1: Batch upsert theme areas
      if (themeAreasToUpsert.length > 0) {
        try {
          await this.themeAreaRepository.upsert(themeAreasToUpsert, [
            'queueTimesId',
            'park',
          ]);
        } catch (themeAreaError) {
          this.logger.error(
            `Error batch upserting theme areas for park ${park.name}:`,
            themeAreaError,
          );
        }
      }

      // Step 2: Create theme area lookup map
      const themeAreaMap = new Map<number, number>();
      if (themeAreasToUpsert.length > 0) {
        const themeAreas = await this.themeAreaRepository.find({
          where: { park: { id: park.id } },
          select: ['id', 'queueTimesId'],
        });

        for (const themeArea of themeAreas) {
          themeAreaMap.set(themeArea.queueTimesId, themeArea.id);
        }
      }

      // Step 3: Update rides with correct theme area IDs and batch upsert
      const ridesWithThemeAreaIds = ridesToUpsert.map((ride) => ({
        ...ride,
        themeArea: { id: themeAreaMap.get(ride.themeArea.queueTimesId) },
      }));

      if (ridesWithThemeAreaIds.length > 0) {
        try {
          await this.rideRepository.upsert(ridesWithThemeAreaIds, [
            'queueTimesId',
            'park',
          ]);
        } catch (rideError) {
          this.logger.error(
            `Error batch upserting rides for park ${park.name}:`,
            rideError,
          );
        }
      }

      // Step 4: Process queue times individually for robustness
      if (queueTimesToInsert.length > 0) {
        this.logger.debug(
          `Processing ${queueTimesToInsert.length} queue times for park ${park.name}`,
        );

        // Collect new queue times for cache update
        const newQueueTimes = new Map<number, any>();

        // Process each queue time individually to avoid complex bulk insert issues
        const rideProcessingPromises = queueTimesToInsert.map(
          async (qtData) => {
            const result = await this.processIndividualQueueTime(qtData, park.id);
            
            // If a new queue time was created, collect it for cache update
            if (result.newEntries > 0 && result.queueTimeData) {
              newQueueTimes.set(result.queueTimeData.rideId, {
                waitTime: result.queueTimeData.waitTime,
                isOpen: result.queueTimeData.isOpen,
                lastUpdated: result.queueTimeData.lastUpdated,
              });
            }
            
            return result;
          },
        );

        const rideResults = await Promise.allSettled(rideProcessingPromises);

        // Aggregate results
        rideResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            parkNewEntries += result.value.newEntries;
            parkSkippedEntries += result.value.skippedEntries;
          } else {
            this.logger.warn(
              `Individual queue time processing failed:`,
              result.reason,
            );
            parkSkippedEntries++;
          }
        });

        // Update cache with new queue times for this park
        if (newQueueTimes.size > 0) {
          await this.updateQueueTimesCache(newQueueTimes);
        }
      }

      return { newEntries: parkNewEntries, skippedEntries: parkSkippedEntries };
    } catch (error) {
      // If the entire park fails (e.g., network error, park not found)
      this.logger.error(
        `Failed to fetch queue times for park ${park.name}:`,
        error,
      );
      throw error; // Re-throw to be caught by the calling batch processor
    }
  }

  /**
   * Fallback method for individual queue time processing
   */
  private async processIndividualQueueTime(
    qtData: any,
    parkId: number,
  ): Promise<{ newEntries: number; skippedEntries: number; queueTimeData?: any }> {
    try {
      // First, find the actual ride entity to get its database ID
      const ride = await this.rideRepository.findOne({
        where: {
          queueTimesId: qtData.rideQueueTimesId,
          park: { id: parkId },
        },
        select: ['id'],
      });

      if (!ride) {
        this.logger.warn(
          `Ride with queueTimesId ${qtData.rideQueueTimesId} not found for park ${parkId}`,
        );
        return { newEntries: 0, skippedEntries: 1 };
      }

      // Check for existing queue time using the actual ride ID
      const existingCount = await this.queueTimeRepository.count({
        where: {
          ride: { id: ride.id },
          lastUpdated: qtData.lastUpdated,
          waitTime: qtData.waitTime,
        },
      });

      if (existingCount === 0) {
        // Create queue time with proper ride reference
        const queueTime = this.queueTimeRepository.create({
          ride: { id: ride.id } as Ride,
          waitTime: qtData.waitTime,
          isOpen: qtData.isOpen,
          lastUpdated: qtData.lastUpdated,
          recordedAt: qtData.recordedAt,
        });

        await this.queueTimeRepository.save(queueTime);
        
        // Return queue time data for cache update
        return { 
          newEntries: 1, 
          skippedEntries: 0,
          queueTimeData: {
            rideId: ride.id,
            waitTime: qtData.waitTime,
            isOpen: qtData.isOpen,
            lastUpdated: qtData.lastUpdated,
          }
        };
      } else {
        return { newEntries: 0, skippedEntries: 1 };
      }
    } catch (error) {
      // Handle unique constraint violations gracefully
      if (
        error.code === '23505' ||
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        return { newEntries: 0, skippedEntries: 1 };
      }

      this.logger.warn(`Error in individual queue time processing:`, error);
      return { newEntries: 0, skippedEntries: 1 };
    }
  }

  /**
   * Updates the cache with the latest queue times for rides
   */
  private async updateQueueTimesCache(queueTimesMap: Map<number, any>): Promise<void> {
    try {
      this.logger.debug(`Updating cache with ${queueTimesMap.size} queue times`);
      
      const promises = [];
      for (const [rideId, queueTimeData] of queueTimesMap) {
        const cacheKey = `latest_queue_time_${rideId}`;
        
        // Cache for 1 hour - this will be refreshed when new data comes in
        promises.push(this.cacheService.setAsync(cacheKey, queueTimeData, 3600));
      }
      
      await Promise.all(promises);
      this.logger.debug(`Cache updated successfully for ${queueTimesMap.size} rides`);
    } catch (error) {
      this.logger.error('Failed to update queue times cache:', error);
    }
  }

}
