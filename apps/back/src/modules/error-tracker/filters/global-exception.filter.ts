import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorTrackerService } from '../error-tracker.service';
import {
  buildActionableError,
} from '@src/core/spec-engine/spec-error-reporter';
import {
  HookAbortError,
} from '@src/core/spec-engine/spec.types';
import type { ActionableError, SpecError, SpecTrace } from '@src/core/spec-engine/spec.types';

/**
 * Detect whether an error originates from the spec engine. The spec engine
 * throws `HookAbortError` for hook- aborted operations and tags other
 * errors with a `specError = true` marker so the filter can route them
 * into the ActionableError shaping path without an `instanceof` chain
 * against every spec-engine error class.
 */
function isSpecEngineError(err: unknown): err is Error & {
  specError?: boolean;
  statusCode?: number;
} {
  if (err instanceof HookAbortError) return true;
  if (err instanceof Error && (err as { specError?: boolean }).specError === true) {
    return true;
  }
  return false;
}

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
        : isSpecEngineError(exception)
          ? exception.statusCode ?? HttpStatus.BAD_REQUEST
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

    // ─── Spec-engine errors → ActionableError body (PRD 01) ───────────
    if (isSpecEngineError(exception)) {
      const trace: SpecTrace = {
        requestId:
          (request.headers['x-request-id'] as string | undefined) ??
          `req_${Date.now().toString(36)}`,
        resource: '',
        operation: 'create',
        user: null,
        stages: [],
        totalDurationMs: 0,
        layer: 'hook_executor',
        step: 'global-exception-filter',
      };
      const specError: SpecError = {
        message: exception.message,
        source: `spec-engine - ${request.method} ${request.url}`,
        stack: exception.stack,
        hash: '',
        occurrences: 1,
      };
      const actionable = buildActionableError(specError, trace);
      const body: Record<string, unknown> = {
        statusCode: status,
        message: exception.message,
        timestamp: new Date().toISOString(),
        error: actionable,
      };
      response.status(status).json(body);
      return;
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
