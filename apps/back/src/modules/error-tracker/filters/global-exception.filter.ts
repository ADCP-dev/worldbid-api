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

    // Preserve structured HttpException responses (e.g. { errors: { email: 'notFound' } })
    // Only flatten to { message } for simple string responses
    const isHttpException = exception instanceof HttpException;
    const isStringResponse = typeof errorResponse === 'string';
    const isInternal = status === HttpStatus.INTERNAL_SERVER_ERROR;

    let body: Record<string, unknown>;

    if (isInternal) {
      body = {
        statusCode: status,
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      };
    } else if (
      isHttpException &&
      !isStringResponse &&
      typeof errorResponse === 'object'
    ) {
      body = {
        ...(errorResponse as Record<string, unknown>),
        statusCode: status,
        timestamp: new Date().toISOString(),
      };
    } else {
      body = {
        statusCode: status,
        message: isStringResponse
          ? errorResponse
          : (errorResponse as Record<string, unknown>).message ||
            String(errorResponse),
        timestamp: new Date().toISOString(),
      };
    }

    response.status(status).json(body);
  }
}
