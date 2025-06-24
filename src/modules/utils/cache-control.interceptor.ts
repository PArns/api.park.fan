import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  private readonly TTL_SECONDS = 300; // 5 minutes cache time

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    // Set Cache-Control header before processing the request
    // This prevents "Cannot set headers after they are sent" errors
    try {
      if (!response.headersSent) {
        response.header('Cache-Control', `public, max-age=${this.TTL_SECONDS}`);
      }
    } catch (error) {
      // Silently ignore header setting errors
      // This can happen if the response has already been sent
    }

    return next.handle();
  }
}
