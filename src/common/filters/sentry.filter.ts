
import { Catch, ArgumentsHost, HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryFilter extends BaseExceptionFilter {
    handleUnknownError(
        exception: any,
        host: ArgumentsHost,
        applicationRef: HttpServer | any,
    ) {
        Sentry.captureException(exception);
        super.handleUnknownError(exception, host, applicationRef);
    }
}
