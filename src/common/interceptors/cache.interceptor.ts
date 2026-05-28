import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;

    // Caching strictly GET requests
    if (method !== 'GET') {
      return undefined;
    }

    // Bypass cache for health check, metrics, and highly dynamic, real-time endpoints
    if (
      url.includes('/metrics') ||
      url.includes('/health') ||
      url.includes('/boton-panico') ||
      url.includes('/ubicaciones') ||
      url.includes('/eventos') ||
      url.includes('/webhooks')
    ) {
      return undefined;
    }

    // Secure Cache Isolation: Incorporate the authenticated User ID in the cache key
    // to prevent cross-user data leakage.
    const user = request.user;
    if (user && user.id) {
      return `${url}:user:${user.id}`;
    }

    // Fallback: If Authorization header exists but req.user is not populated yet
    const authHeader = headers.authorization;
    if (authHeader) {
      const shortToken = authHeader.replace('Bearer ', '').slice(-20);
      return `${url}:token:${shortToken}`;
    }

    // Default to plain URL for unauthenticated GETs (like public settings)
    return url;
  }
}
