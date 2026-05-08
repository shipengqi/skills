# React Form Patterns

## Multi-Step Form

```tsx
const STEPS = ['personal', 'address', 'review'] as const;
type Step = typeof STEPS[number];

// Persist across steps with a shared form instance
const form = useForm<FullFormData>({ resolver: zodResolver(fullSchema) });
const [step, setStep] = useState<Step>('personal');

// Validate only current step's fields before advancing
const next = async () => {
  const fields = step === 'personal' ? ['name', 'email'] : ['street', 'city'];
  const valid = await form.trigger(fields as (keyof FullFormData)[]);
  if (valid) setStep(STEPS[STEPS.indexOf(step) + 1]);
};
```

## File Upload

```tsx
const schema = z.object({
  avatar: z.instanceof(FileList).refine(f => f.length > 0, 'Required')
    .refine(f => f[0].size < 2_000_000, 'Max 2MB')
    .refine(f => ['image/jpeg', 'image/png'].includes(f[0].type), 'JPEG or PNG only'),
});

// In submit handler — convert FileList to FormData
const submit = handleSubmit(async ({ avatar }) => {
  const fd = new FormData();
  fd.append('avatar', avatar[0]);
  await uploadAvatar(fd);
});

<input type="file" accept="image/*" {...register('avatar')} />
```

## Async Select (options loaded from API)

```tsx
const schema = z.object({ userId: z.string().uuid() });

function UserSelect({ control }: { control: Control<FormData> }) {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  return (
    <Controller
      name="userId"
      control={control}
      render={({ field }) => (
        <select {...field}>
          <option value="">Select user…</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
    />
  );
}
```

## Form with Nested Objects

```ts
const schema = z.object({
  user: z.object({
    name: z.string(),
    address: z.object({
      street: z.string(),
      city: z.string(),
    }),
  }),
});

// Access nested fields with dot notation
register('user.name')
register('user.address.street')
form.watch('user.address.city')
```

## Testing Forms

```tsx
test('shows validation errors on empty submit', async () => {
  const user = userEvent.setup();
  render(<LoginForm onSubmit={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('alert', { name: /email/i })).toBeInTheDocument();
});

test('calls onSubmit with valid data', async () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText('Email'), 'alice@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
    email: 'alice@example.com',
    password: 'password123',
  }));
});
```
