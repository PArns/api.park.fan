import { Module } from '@nestjs/common';
import { QueueTimesController } from './queue-times.controller.js';
import { QueueTimesParserModule } from '../queue-times-parser/queue-times-parser.module.js';

@Module({
  imports: [QueueTimesParserModule],
  controllers: [QueueTimesController],
})
export class QueueTimesModule {}
