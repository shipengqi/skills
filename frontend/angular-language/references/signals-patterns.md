# Angular Signals Patterns

## linkedSignal — Dependent Writable Signal

```ts
import { linkedSignal } from '@angular/core';

// Reset page when filter changes
const filter = signal('');
const page = linkedSignal(() => {
  filter();  // depend on filter
  return 1;  // reset to page 1 whenever filter changes
});
```

## resource API (Angular 19+)

```ts
import { resource, signal } from '@angular/core';

const userId = signal('1');

const userResource = resource({
  request: () => ({ id: userId() }),
  loader: ({ request }) => fetch(`/api/users/${request.id}`).then(r => r.json()),
});

// Template
@if (userResource.isLoading()) { <Spinner /> }
@if (userResource.value()) { <UserCard [user]="userResource.value()!" /> }
@if (userResource.error()) { <ErrorMsg [error]="userResource.error()" /> }
```

## toSignal with Error Handling

```ts
// Provide initial value to avoid undefined on first render
users = toSignal(this.userService.getAll(), { initialValue: [] as User[] });

// Handle Observable errors — use catchError before toSignal
usersWithFallback = toSignal(
  this.userService.getAll().pipe(
    catchError(() => of([] as User[]))
  ),
  { initialValue: [] as User[] }
);
```

## Signal-Based Component Communication

```ts
// Parent passes a signal as input; child reacts to it
@Component({
  template: `<span>Count: {{ count() }}</span>`,
})
export class CounterDisplay {
  count = input.required<Signal<number>>();  // input is a Signal<Signal<number>>
  // Read: this.count()()
}

// Simpler: use model() for two-way binding (Angular 17.2+)
@Component({ ... })
export class Toggle {
  checked = model(false);  // parent can bind [(checked)]="parentSignal"
}
```

## Effect Cleanup

```ts
effect((onCleanup) => {
  const subscription = someObservable(this.userId()).subscribe();
  onCleanup(() => subscription.unsubscribe());
});
```

Always use `onCleanup` when an effect sets up a resource that needs teardown.
