# NestJS Middleware Patterns

## Helmet + CORS in main.ts

```ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(3000);
}
```

## Rate Limiting (throttler)

```ts
// app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

// Override per route
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Post('auth/login')
login(@Body() dto: LoginDto) { ... }
```

## Request ID Middleware

```ts
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    req['id'] = req.headers['x-request-id'] ?? crypto.randomUUID();
    res.setHeader('x-request-id', req['id']);
    next();
  }
}

// Register in AppModule
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

## Global Response Transform Interceptor

```ts
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }))
    );
  }
}
```

## Logging Interceptor with Correlation ID

```ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${method} ${url} ${Date.now() - start}ms`),
        error: (err) => this.logger.error(`${method} ${url} failed: ${err.message}`),
      })
    );
  }
}
```
