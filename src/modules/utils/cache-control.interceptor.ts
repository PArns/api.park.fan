import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  private readonly TTL_SECONDS = 300; // 5 minutes cache time

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    
    return next.handle().pipe(
      tap(() => {
        // Set Cache-Control header with max-age (TTL in seconds)
        response.header('Cache-Control', `public, max-age=${this.TTL_SECONDS}`);
      })
    );
  }
}
