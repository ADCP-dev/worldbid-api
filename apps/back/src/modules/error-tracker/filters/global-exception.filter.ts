import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorTrackerService } from '../error-tracker.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorTrackerService: ErrorTrackerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const message =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : null;

      this.errorTrackerService
        .logError({
          message,
          source: `NestJS HTTP - ${request.method} ${request.url}`,
          stack: stack || undefined,
          metadata: {
            body: request.body,
            query: request.query,
            ip: request.ip,
            method: request.method,
            url: request.url,
          },
        })
        .catch((err) =>
          console.error('ErrorTracker: Failed to save error:', err),
        );
    }

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal Server Error' };

    response.status(status).json({
      statusCode: status,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : (errorResponse as { message?: string }).message || 'Error',
      timestamp: new Date().toISOString(),
    });
  }
}
