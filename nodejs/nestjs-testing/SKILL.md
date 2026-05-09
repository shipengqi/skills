---
name: nestjs-testing
description: NestJS unit and E2E testing — Test.createTestingModule(), mocking providers with jest, supertest for HTTP assertions. Use when writing tests for NestJS services, controllers, or full application flows. Apply whenever user instantiates NestJS services with new ServiceName() instead of Test.createTestingModule(), uses a real database in unit tests instead of mocking PrismaService with useValue, forgets app.close() in E2E afterAll(), or asks how to bypass JwtAuthGuard in E2E tests without modifying production code.
metadata:
  triggers:
    files:
      - '*.spec.ts'
      - '*.e2e-spec.ts'
      - 'jest.config.ts'
    keywords:
      - nestjs
      - testing
      - TestBed
      - createTestingModule
      - supertest
      - jest
      - mock
      - e2e
---

# NestJS Testing

## Unit Test — Service

```ts
// users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  describe('findOne', () => {
    it('returns user when found', async () => {
      const mockUser = { id: '1', email: 'alice@example.com', name: 'Alice' };
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.findOne('1');
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns user', async () => {
      const dto = { email: 'alice@example.com', password: 'password123' };
      const mockUser = { id: '1', ...dto };
      prisma.user.create.mockResolvedValue(mockUser as any);

      const result = await service.create(dto as any);
      expect(result.email).toBe(dto.email);
    });
  });
});
```

## Unit Test — Controller

```ts
describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    usersService = module.get(UsersService);
  });

  it('findAll delegates to service', async () => {
    usersService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(result).toEqual([]);
    expect(usersService.findAll).toHaveBeenCalledTimes(1);
  });
});
```

## E2E Test — Full Application

```ts
// test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => await app.close());

  it('POST /api/v1/users → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(201);

    expect(res.body).toMatchObject({ email: 'test@example.com' });
    expect(res.body).not.toHaveProperty('password');
  });

  it('POST /api/v1/users with invalid body → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('GET /api/v1/users/:id → 404 when not found', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
```

## Mock Guard in E2E Tests

```ts
// Override auth guard for E2E tests
const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideGuard(JwtAuthGuard)
  .useValue({ canActivate: () => true })
  .compile();
```

## jest.config.ts

```ts
// jest.config.ts
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

// jest-e2e.config.ts
export default {
  ...jestConfig,
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
};
```

## Anti-Patterns

- ❌ Creating `new UsersService()` without `Test.createTestingModule()` — bypasses DI and lifecycle hooks
- ❌ Testing controllers without mocking services — use `useValue` mocks
- ❌ Not calling `app.close()` in `afterAll` — leaves database connections open
- ❌ Using real database in unit tests — mock `PrismaService`; use real DB only in E2E
- ❌ Missing `ValidationPipe` in E2E setup — different behaviour from production

## Verification

1. `jest` — unit tests pass
2. `jest --config jest-e2e.config.ts` — E2E tests pass
3. `jest --coverage` — coverage report

## References

- [Testing Patterns](references/testing-patterns.md) — guard testing, interceptor testing, database seeding for E2E
