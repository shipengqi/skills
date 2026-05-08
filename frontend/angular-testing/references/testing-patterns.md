# Angular Testing Patterns

## Async Component Test

```ts
it('loads and displays users', async () => {
  const mockUsers = [{ id: '1', name: 'Alice' }];
  const userService = { getAll: jest.fn(() => of(mockUsers)) };

  await TestBed.configureTestingModule({
    imports: [UserListComponent],
    providers: [{ provide: UserService, useValue: userService }],
  }).compileComponents();

  const fixture = TestBed.createComponent(UserListComponent);
  fixture.detectChanges();

  // Wait for async operations to complete
  await fixture.whenStable();
  fixture.detectChanges();

  const items = fixture.nativeElement.querySelectorAll('li');
  expect(items).toHaveLength(1);
  expect(items[0].textContent).toBe('Alice');
});
```

## Testing Signals

```ts
it('updates count signal on button click', () => {
  const fixture = TestBed.createComponent(CounterComponent);
  fixture.detectChanges();

  expect(fixture.componentInstance.count()).toBe(0);

  fixture.nativeElement.querySelector('button').click();
  fixture.detectChanges();

  expect(fixture.componentInstance.count()).toBe(1);
});
```

## Router Testing

```ts
describe('with router', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserDetailComponent],
      providers: [
        provideRouter([{ path: 'users/:id', component: UserDetailComponent }]),
      ],
    }).compileComponents();
  });

  it('reads route param', async () => {
    const router = TestBed.inject(Router);
    await router.navigate(['/users/42']);
    const fixture = TestBed.createComponent(UserDetailComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.userId()).toBe('42');
  });
});
```

## Form Testing

```ts
it('disables submit when form is invalid', () => {
  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();

  const button = fixture.nativeElement.querySelector('button[type="submit"]');
  expect(button.disabled).toBe(true);

  fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'password123' });
  fixture.detectChanges();

  expect(button.disabled).toBe(false);
});
```

## Spectator (Optional Simplification)

```ts
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';

describe('UserCard with Spectator', () => {
  let spectator: Spectator<UserCardComponent>;
  const createComponent = createComponentFactory({ component: UserCardComponent });

  it('shows user name', () => {
    spectator = createComponent({ props: { user: mockUser } });
    expect(spectator.query('h2')).toHaveText('Alice');
  });
});
```
