---
name: angular-services
description: Angular 17+ services, DI, HttpClient with functional interceptors, and functional route guards. Use when wiring up services, HTTP calls, authentication guards, or request/response interceptors. Apply whenever user implements class-based HttpInterceptor instead of HttpInterceptorFn, registers interceptors with HTTP_INTERCEPTORS token instead of withInterceptors(), writes class-based CanActivate instead of CanActivateFn, or uses router.navigate() instead of createUrlTree() inside a guard.
metadata:
  triggers:
    files:
      - '*.service.ts'
      - '*.guard.ts'
      - '*.interceptor.ts'
      - 'app.config.ts'
    keywords:
      - angular
      - Injectable
      - HttpClient
      - interceptor
      - CanActivate
      - guard
      - inject
      - providedIn
---

# Angular Services

## Service Definition

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  getAll(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>('/api/users', dto);
  }

  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http.put<User>(`/api/users/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
```

`providedIn: 'root'` is tree-shakeable and creates a singleton. Use feature-scoped providers (`providedIn: UserModule`) only when the service must not be shared.

## Functional Interceptor (Angular 17+)

```ts
// auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  if (!token) return next(req);

  return next(req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  }));
};

// error-handling.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) inject(Router).navigate(['/login']);
      return throwError(() => err);
    })
  );
};
```

Register in `app.config.ts`:

```ts
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    provideRouter(routes),
  ],
};
```

## Functional Route Guards (Angular 17+)

```ts
// auth.guard.ts
import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

// roles.guard.ts
export const rolesGuard = (roles: Role[]): CanActivateFn => (route) => {
  const user = inject(AuthStore).user();
  return !!user && roles.includes(user.role);
};
```

Apply in routes:

```ts
export const routes: Routes = [
  {
    path: 'dashboard',
    canActivate: [authGuard],
    children: [
      { path: 'admin', canActivate: [rolesGuard(['admin'])], component: AdminPage },
    ],
  },
];
```

## Signal-Based State in Services

```ts
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private _user = signal<User | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly token = computed(() => this._user()?.token ?? null);

  setUser(user: User | null) { this._user.set(user); }
  logout() { this._user.set(null); }
}
```

## HttpClient Error Handling

```ts
getUser(id: string): Observable<User> {
  return this.http.get<User>(`/api/users/${id}`).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 404) return throwError(() => new NotFoundError(`User ${id}`));
      return throwError(() => err);
    })
  );
}
```

## Anti-Patterns

- ❌ Class-based interceptors — use functional `HttpInterceptorFn`
- ❌ Class-based guards with `implements CanActivate` — use `CanActivateFn`
- ❌ Subscribing to HTTP calls in services — return Observables, let components subscribe
- ❌ `providedIn: 'any'` — creates multiple instances, use `'root'` or feature-scope
- ❌ Manual `new HttpClient()` — always inject via DI
- ❌ Storing mutable state as plain class fields — use Signals for reactive state

## Verification

1. `ng build` — DI graph errors surface at compile time
2. `ng test` — service unit tests with `HttpClientTestingModule`
3. Auth guard: unauthenticated route redirects to `/login`

## References

- [DI Patterns](references/di-patterns.md) — factory providers, injection tokens, scoped services
