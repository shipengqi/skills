# NestJS Testing Patterns

## Testing with Prisma Mock (prisma-mock)

```ts
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('finds user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    const result = await service.findOne('1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result).toEqual(mockUser);
  });
});
```

## E2E with Test Database

```ts
// test/setup.ts — run once before all E2E tests
import { execSync } from 'child_process';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'inherit' });
});
```

## Testing Interceptors

```ts
describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps response in ApiResponse envelope', (done) => {
    const mockCallHandler: CallHandler = {
      handle: () => of({ id: '1', name: 'Alice' }),
    };

    interceptor.intercept({} as ExecutionContext, mockCallHandler).subscribe(result => {
      expect(result).toMatchObject({ success: true, data: { id: '1', name: 'Alice' } });
      done();
    });
  });
});
```

## Testing Exception Filters

```ts
describe('HttpExceptionFilter', () => {
  it('formats 404 response correctly', () => {
    const filter = new HttpExceptionFilter();
    const mockResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const mockHost = {
      switchToHttp: () => ({ getResponse: () => mockResponse }),
    } as unknown as ArgumentsHost;

    filter.catch(new NotFoundException('User not found'), mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'User not found' })
    );
  });
});
```

## Seeding Test Data

```ts
// test/fixtures/users.ts
export async function seedUsers(prisma: PrismaService): Promise<User[]> {
  return Promise.all([
    prisma.user.create({ data: { email: 'alice@test.com', name: 'Alice', password: 'hashed' } }),
    prisma.user.create({ data: { email: 'bob@test.com',   name: 'Bob',   password: 'hashed' } }),
  ]);
}
```
