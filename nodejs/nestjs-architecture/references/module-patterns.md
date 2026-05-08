# NestJS Module Patterns

## Dynamic Module (forRoot Pattern)

```ts
// config/config.module.ts
@Module({})
export class ConfigModule {
  static forRoot(options: ConfigOptions): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [
        { provide: CONFIG_OPTIONS, useValue: options },
        ConfigService,
      ],
      exports: [ConfigService],
    };
  }
}

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env' }),
  ],
})
export class AppModule {}
```

## Async Provider (database connection)

```ts
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class AppModule {}
```

## Feature Module with forFeature

```ts
// users/users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],  // or PrismaModule
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

## Shared Module

```ts
@Module({
  imports: [JwtModule, PrismaModule],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],  // JwtModule re-exported so importers get JwtService
})
export class AuthModule {}
```

## Circular Dependency Resolution

```ts
// ✗ circular: UsersModule imports PostsModule and PostsModule imports UsersModule
// ✓ extract shared logic to a CommonModule
@Module({
  providers: [UserLookupService],
  exports: [UserLookupService],
})
export class CommonModule {}

// Both modules import CommonModule instead of each other
```

## Lazy Loading via Microservices

```ts
// For large monoliths — lazy load via dynamic import (not native NestJS, but pattern)
const lazyModule = await import('./heavy/heavy.module');
app.get(lazyModule.HeavyService).doWork();
```
