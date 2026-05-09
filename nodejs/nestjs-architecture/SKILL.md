---
name: nestjs-architecture
description: NestJS module system, controllers, providers, dependency injection, and feature module structure. Use when scaffolding a NestJS project, wiring up modules, or designing the service layer. Apply whenever user puts database queries or business logic in NestJS controllers, omits whitelist: true or forbidNonWhitelisted: true from ValidationPipe, forgets to export services from feature modules, or uses @Global() on feature modules instead of only cross-cutting infrastructure services.
metadata:
  triggers:
    files:
      - '*.module.ts'
      - '*.controller.ts'
      - '*.service.ts'
      - 'main.ts'
    keywords:
      - nestjs
      - module
      - controller
      - injectable
      - provider
      - dependency injection
      - nest
---

# NestJS Architecture

## Project Structure

```
src/
├── main.ts                   # Bootstrap
├── app.module.ts             # Root module
├── common/
│   ├── filters/              # Global exception filters
│   ├── guards/               # Auth guards
│   ├── interceptors/         # Logging, transform interceptors
│   ├── decorators/           # Custom parameter decorators
│   └── pipes/                # Global validation pipes
└── users/                    # Feature module
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    ├── dto/
    │   ├── create-user.dto.ts
    │   └── update-user.dto.ts
    └── entities/
        └── user.entity.ts
```

## Bootstrap

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // strip unknown properties
    transform: true,        // auto-transform types (string → number)
    forbidNonWhitelisted: true,
  }));

  app.setGlobalPrefix('api/v1');
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

## Feature Module

```ts
// users/users.module.ts
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],   // export only what other modules need
})
export class UsersModule {}

// app.module.ts
@Module({
  imports: [UsersModule, AuthModule, PrismaModule],
})
export class AppModule {}
```

## Controller

```ts
// users/users.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
```

Keep controllers thin — no business logic. Controllers validate HTTP input and delegate to services.

## Service

```ts
// users/users.service.ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  create(dto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data: dto });
  }
}
```

## DTO with class-validator

```ts
// users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
```

`ValidationPipe({ whitelist: true })` strips properties not decorated with `class-validator` — prevents mass assignment.

## Global Module for Shared Services

```ts
// prisma/prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Mark as `@Global()` only for truly cross-cutting services (Prisma, Config, Logger). Everything else stays in feature modules.

## Anti-Patterns

- ❌ Business logic in controllers — put it in services
- ❌ Direct Prisma calls in controllers — always go through services
- ❌ Missing `whitelist: true` on ValidationPipe — allows unknown fields through
- ❌ Circular module imports — extract shared service to a `CommonModule`
- ❌ `@Global()` on feature modules — creates hidden coupling

## Verification

1. `nest build` — DI graph errors at compile time
2. POST with extra fields → stripped by ValidationPipe
3. POST with invalid fields → 400 with field error messages

## References

- [Module Patterns](references/module-patterns.md) — dynamic modules, async providers, forRoot pattern
