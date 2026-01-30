import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Capturar en Sentry
        Sentry.captureException(exception);

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';

        const errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            message: typeof message === 'object' ? (message as any).message || message : message,
            error: typeof message === 'object' ? (message as any).error || null : null,
        };

        if (status >= 500) {
            this.logger.error(
                `${request.method} ${request.url} ${status} Error: ${JSON.stringify(message)}`,
                exception.stack,
            );
        } else {
            this.logger.warn(`${request.method} ${request.url} ${status} Message: ${JSON.stringify(message)}`);
        }

        response.status(status).json(errorResponse);
    }
}
