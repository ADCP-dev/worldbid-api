import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorTrackerController } from './error-tracker.controller';
import { ErrorTrackerService } from './error-tracker.service';
import { ErrorLogEntity } from './entities/error-log.entity';
import { TestErrorController } from './test-error.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorLogEntity])],
  controllers: [ErrorTrackerController, TestErrorController],
  providers: [ErrorTrackerService],
  exports: [ErrorTrackerService],
})
export class ErrorTrackerModule {}
