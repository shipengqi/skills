---
name: nestjs-guards
description: NestJS Guards, Interceptors, Pipes, and Exception Filters — authentication, request/response transformation, validation pipelines, and centralised error handling. Use when adding auth, logging, validation, or standardising error responses.
metadata:
  triggers:
    files:
      - '*.guard.ts'
      - '*.interceptor.ts'
      - '*.filter.ts'
      - '*.pipe.ts'
    keywords:
      - nestjs
      - guard
      - interceptor
      - exception filter
      - CanActivate
      - NestInterceptor
      - class-validator
      - ValidationPipe
---

# NestJS Guards, Interceptors, Pipes, Filters

## Guards — Authentication and Authorization

```ts
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      request['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(req: Request): string | undefined {
    return req.headers.authorization?.split(' ')[1];
  }
}
```

```ts
// Role-based guard using custom decorator
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!roles) return true;  // no roles required

    const user = context.switchToHttp().getRequest()['user'] as JwtPayload;
    return roles.includes(user.role);
  }
}

// Usage
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

## Interceptors — Response Transform and Logging

```ts
// common/interceptors/logging.interceptor.ts
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => console.log(`${req.method} ${req.url} — ${Date.now() - start}ms`)),
    );
  }
}

// common/interceptors/transform.interceptor.ts
// Wrap all responses in a standard envelope
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({ success: true, data })),
    );
  }
}
```

Register globally in `main.ts`:

```ts
app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
```

## Pipes — Validation and Transformation

```ts
// Global ValidationPipe handles class-validator DTOs automatically
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,           // transform payload to DTO class instance
  forbidNonWhitelisted: true,
}));

// Built-in pipes for path params
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }

@Get('page/:num')
getPage(@Param('num', ParseIntPipe) page: number) { ... }

// Custom pipe
@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.transform(v)])
      );
    }
    return value;
  }
}
```

## Exception Filters — Centralised Error Handling

```ts
// common/filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      statusCode: status,
      message:
        typeof exceptionResponse === 'object'
          ? (exceptionResponse as Record<string, unknown>).message
          : exceptionResponse,
      timestamp: new Date().toISOString(),
    });
  }
}

// Global catch-all for unexpected errors
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    ctx.getResponse<Response>().status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
    // Log the full error here
    console.error(exception);
  }
}
```

Register in `main.ts`:

```ts
app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
```

Order matters: `AllExceptionsFilter` first (least specific), `HttpExceptionFilter` last (most specific).

## Custom Decorator — CurrentUser

```ts
// common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest()['user'];
  },
);

// Usage in controller
@Get('me')
getProfile(@CurrentUser() user: JwtPayload): Promise<User> {
  return this.usersService.findOne(user.sub);
}
```

## Anti-Patterns

- ❌ Throwing raw `Error` in services — throw NestJS `HttpException` subclasses (NotFoundException, etc.)
- ❌ Business logic in guards — guards only answer "can this request proceed?"
- ❌ Multiple global exception filters catching the same types — order determines precedence
- ❌ Missing `transform: true` on ValidationPipe — payload arrives as plain object, not DTO class instance
- ❌ `@UseGuards()` on individual handlers when all routes need auth — apply at controller level

## Verification

1. Unauthenticated request → 401 Unauthorized
2. Request missing required DTO field → 400 with field error message
3. Request with extra fields → 400 (with `forbidNonWhitelisted: true`)

## References

- [Middleware Patterns](references/middleware-patterns.md) — rate limiting, CORS, request ID, Helmet
