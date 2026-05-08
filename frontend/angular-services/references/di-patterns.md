# Angular DI Patterns

## Injection Tokens (non-class dependencies)

```ts
// tokens.ts
import { InjectionToken } from '@angular/core';

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// app.config.ts — provide the value
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_CONFIG, useValue: { apiUrl: environment.apiUrl, version: '1.0' } },
  ],
};

// In a service
const config = inject(APP_CONFIG);
```

## Factory Providers

```ts
export const LOGGER = new InjectionToken<Logger>('LOGGER');

export const loggerProvider: FactoryProvider = {
  provide: LOGGER,
  useFactory: (config: AppConfig) =>
    config.production ? new ProductionLogger() : new ConsoleLogger(),
  deps: [APP_CONFIG],
};
```

## Scoped Services (per lazy-loaded route)

```ts
// dashboard.routes.ts
export const dashboardRoutes: Routes = [{
  path: '',
  providers: [DashboardStateService],  // scoped to this route subtree
  children: [...]
}];
```

## Environment-Specific Providers

```ts
// environments/environment.ts
export const environment = { production: false, apiUrl: 'http://localhost:3000' };

// environments/environment.prod.ts
export const environment = { production: true, apiUrl: 'https://api.example.com' };

// Typed env with provideEnvironmentInitializer
provideAppInitializer(async () => {
  const config = inject(ConfigService);
  await config.load();
})
```

## Testing with DI Overrides

```ts
TestBed.configureTestingModule({
  providers: [
    UserService,
    // Override a dependency for testing
    { provide: APP_CONFIG, useValue: { apiUrl: 'http://test-api' } },
    // Partial mock using jasmine.createSpyObj
    { provide: AuthStore, useValue: { isAuthenticated: signal(true), user: signal(mockUser) } },
  ],
});
```

## Self-Contained Feature with Internal Providers

```ts
// search.component.ts — internal service not exposed outside
@Component({
  standalone: true,
  providers: [SearchService],  // new instance per component, not shared
  template: `...`,
})
export class SearchComponent {
  private search = inject(SearchService);
}
```
