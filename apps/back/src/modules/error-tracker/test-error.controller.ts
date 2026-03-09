import { Controller, Get } from '@nestjs/common';
import { ErrorTrackerService } from './error-tracker.service';

@Controller({ path: 'system/test', version: '1' })
export class TestErrorController {
  constructor(private readonly errorTrackerService: ErrorTrackerService) {}

  @Get('error-500')
  async trigger500() {
    const error = new Error(
      'Test 500 Error - This is a simulated backend error',
    );

    await this.errorTrackerService.logError({
      message: error.message,
      source: 'NestJS Test - GET /system/test/error-500',
      stack: error.stack,
      metadata: { test: true },
    });

    throw error;
  }
}
