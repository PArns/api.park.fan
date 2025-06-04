import { Module } from '@nestjs/common';
import { IndexController } from './index.controller.js';
import { UtilsModule } from '../utils/utils.module.js';

@Module({
  imports: [UtilsModule],
  controllers: [IndexController],
})
export class IndexModule {}
