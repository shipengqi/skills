---
name: angular-testing
description: Angular 17+ testing with Jest + TestBed — standalone component tests, service tests, HTTP mocking, and signal-based input testing. Use when writing unit tests for Angular components or services. Apply whenever user sets signal inputs via component.myInput.set() instead of fixture.componentRef.setInput(), imports HttpClientTestingModule instead of provideHttpClientTesting(), forgets fixture.detectChanges() after state changes, or needs to test a functional guard that uses inject().
metadata:
  triggers:
    files:
      - '*.spec.ts'
      - 'jest.config.ts'
    keywords:
      - angular
      - TestBed
      - ComponentFixture
      - testing
      - jest
      - detectChanges
      - HttpTestingController
---

# Angular Testing

## Setup — Jest with Angular 17+

```ts
// jest.config.ts
export default {
  preset: 'jest-preset-angular',
  setupFilesAfterFramework: ['<rootDir>/setup-jest.ts'],
};

// setup-jest.ts
import 'jest-preset-angular/setup-jest';
```

## Standalone Component Test

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserCardComponent } from './user-card.component';

describe('UserCardComponent', () => {
  let fixture: ComponentFixture<UserCardComponent>;
  let component: UserCardComponent;

  const mockUser: User = { id: '1', name: 'Alice', email: 'alice@example.com' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent],  // standalone: import directly
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    component = fixture.componentInstance;
  });

  it('renders user name', () => {
    fixture.componentRef.setInput('user', mockUser);  // signal input
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Alice');
  });

  it('emits selected event on click', () => {
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();

    const spy = jest.fn();
    component.selected.subscribe(spy);

    fixture.nativeElement.querySelector('div').click();
    expect(spy).toHaveBeenCalledWith('1');
  });
});
```

Use `fixture.componentRef.setInput()` for signal-based `input()` properties. `fixture.detectChanges()` triggers change detection — call it after every state change.

## Service Test

```ts
describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: OtherDep, useValue: { someMethod: jest.fn() } },
      ],
    });
    service = TestBed.inject(UserService);
  });

  it('calls correct endpoint', () => {
    const spy = jest.spyOn(service['http'], 'get').mockReturnValue(of([mockUser]));
    service.getAll().subscribe(users => expect(users).toHaveLength(1));
    expect(spy).toHaveBeenCalledWith('/api/users');
  });
});
```

## HttpClient Testing

```ts
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';

describe('UserService HTTP', () => {
  let service: UserService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UserService, provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());  // ensure no outstanding requests

  it('GETs all users', () => {
    service.getAll().subscribe(users => {
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    const req = httpTesting.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush([mockUser]);
  });

  it('handles 404 error', () => {
    service.getById('999').subscribe({
      error: (err) => expect(err.message).toContain('999'),
    });

    httpTesting.expectOne('/api/users/999').flush('Not Found', {
      status: 404,
      statusText: 'Not Found',
    });
  });
});
```

## Testing Signal State

```ts
describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuthStore] });
    store = TestBed.inject(AuthStore);
  });

  it('isAuthenticated reflects user state', () => {
    expect(store.isAuthenticated()).toBe(false);
    store.setUser(mockUser);
    expect(store.isAuthenticated()).toBe(true);
    store.logout();
    expect(store.isAuthenticated()).toBe(false);
  });
});
```

Read signals in tests by calling them: `store.user()`.

## Testing Route Guards

```ts
describe('authGuard', () => {
  it('redirects unauthenticated users', async () => {
    const authStore = { isAuthenticated: signal(false) };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: authStore }, provideRouter([])],
    });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/dashboard' } as any)
    );

    expect(result).toMatchObject({ root: { fragment: null } }); // UrlTree
  });
});
```

## Anti-Patterns

- ❌ Testing with `NO_ERRORS_SCHEMA` — hides template errors
- ❌ Not calling `fixture.detectChanges()` after state change — stale DOM
- ❌ Using `fixture.nativeElement.innerHTML` for assertions — use DOM queries
- ❌ Missing `httpTesting.verify()` — silent unhandled requests
- ❌ Importing full `AppModule` instead of standalone component — slow and coupled

## Verification

1. `jest` — all tests pass
2. `jest --coverage` — coverage report per component

## References

- [Testing Patterns](references/testing-patterns.md) — async component tests, router testing, form testing
