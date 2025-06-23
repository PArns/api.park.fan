import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  private get TTL_SECONDS(): number {
    const seconds = this.configService.get<number>('CACHE_TTL_SECONDS', 3600);
    return Math.min(seconds, 300);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        // Set Cache-Control header with max-age (TTL in seconds)
        response.header('Cache-Control', `public, max-age=${this.TTL_SECONDS}`);
      }),
    );
  }
}
