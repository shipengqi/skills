---
name: angular-language
description: Angular 17+ core patterns — standalone components, Signals, new control flow (@if/@for), lifecycle hooks, pipes, and the inject() function. Use when writing Angular components, defining inputs/outputs, or working with reactive state via Signals.
metadata:
  triggers:
    files:
      - '*.component.ts'
      - '*.component.html'
      - 'angular.json'
    keywords:
      - angular
      - standalone
      - signal
      - component
      - inject
      - '@if'
      - '@for'
      - ngOnInit
---

# Angular Language

## Standalone Component

```ts
import { Component, input, output, signal, computed, inject } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div (click)="selected.emit(user().id)">
      <h2>{{ user().name }}</h2>
      <span>{{ user().createdAt | date }}</span>
    </div>
  `,
})
export class UserCardComponent {
  user = input.required<User>();   // signal-based input (Angular 17.1+)
  selected = output<string>();     // signal-based output
}
```

Always `standalone: true`. Never declare components in NgModule — that pattern is deprecated.

## Signals

```ts
// Writable signal
const count = signal(0);
count.set(5);
count.update(v => v + 1);

// Computed — derived, read-only
const doubled = computed(() => count() * 2);

// Effect — side effect when signals change
effect(() => {
  console.log('count is now', count());
});
```

Read signals by calling them: `count()`, not `count.value`. Effects run automatically when dependencies change — no manual subscription.

## New Control Flow (@if / @for / @switch)

```html
<!-- ✓ Angular 17+ control flow -->
@if (user()) {
  <app-user-card [user]="user()!" />
} @else {
  <p>Loading…</p>
}

@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>No items</li>
}

@switch (status()) {
  @case ('active') { <span class="green">Active</span> }
  @case ('inactive') { <span class="grey">Inactive</span> }
  @default { <span>Unknown</span> }
}
```

`track` is required in `@for` — use a stable unique field (`item.id`), never `$index`.

## inject() Function

```ts
// ✓ inject() — preferred in Angular 17+
@Component({ ... })
export class UserListComponent {
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
}

// ✗ constructor injection — still valid but verbose
constructor(private userService: UserService, private router: Router) {}
```

`inject()` works in field initializers and in functions called during construction. Never call it outside the injection context (e.g., in event handlers or `setTimeout`).

## Lifecycle Hooks

```ts
export class UserListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.userService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => this.users.set(users));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

Prefer `takeUntilDestroyed()` from `@angular/core/rxjs-interop` to avoid manual `Subject` cleanup.

## Pipes

```html
{{ amount | currency:'USD' }}
{{ date | date:'mediumDate' }}
{{ obs$ | async }}              <!-- subscribe and unwrap Observable -->
{{ signal() | myCustomPipe }}
```

Never subscribe to Observables in the template directly — use `AsyncPipe` or convert to Signals with `toSignal()`.

## toSignal / toObservable

```ts
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// Observable → Signal (subscribes automatically, cleans up on destroy)
users = toSignal(this.userService.getAll(), { initialValue: [] });

// Signal → Observable (useful for RxJS operators)
count$ = toObservable(this.count);
```

## Anti-Patterns

- ❌ NgModule declarations — use `standalone: true`
- ❌ `*ngIf` / `*ngFor` directives — use `@if` / `@for` control flow
- ❌ `$index` as track in `@for` — use stable IDs
- ❌ Manual Observable subscriptions in components — use `toSignal()` or `AsyncPipe`
- ❌ Calling `inject()` outside injection context — field initializers only
- ❌ Class components without `OnDestroy` cleanup for manual subscriptions

## Verification

1. `ng build` — compile errors
2. `ng test` — unit tests
3. `ng lint` — eslint + angular-eslint rules

## References

- [Signals Patterns](references/signals-patterns.md) — computed chaining, linkedSignal, resource API
