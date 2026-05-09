---
name: react-forms
description: React form patterns — react-hook-form with Zod validation, Controller for complex inputs, server error handling. Use when building forms, adding validation, or integrating custom input components. Apply whenever user defines TypeScript types separately from Zod schema, uses useState per form field, or asks how to integrate a custom non-ref-forwarding input component with react-hook-form.
metadata:
  triggers:
    files:
      - '*.tsx'
    keywords:
      - react-hook-form
      - useForm
      - zod
      - zodResolver
      - form validation
      - Controller
      - register
---

# React Forms

## Setup: useForm + zodResolver

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
});

type FormData = z.infer<typeof schema>;
```

Always derive the TypeScript type from the Zod schema — never define it separately.

## Basic Form

```tsx
export function LoginForm({ onSubmit }: { onSubmit: (data: FormData) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch {
      setError('root', { message: 'Invalid credentials' });
    }
  });

  return (
    <form onSubmit={submit}>
      <input {...register('email')} type="email" />
      {errors.email && <p role="alert">{errors.email.message}</p>}

      <input {...register('password')} type="password" />
      {errors.password && <p role="alert">{errors.password.message}</p>}

      {errors.root && <p role="alert">{errors.root.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
```

## Controller — Custom / Headless Inputs

Use `Controller` when a UI library component doesn't accept a native `ref`.

```tsx
import { Controller } from 'react-hook-form';

<Controller
  name="role"
  control={control}
  render={({ field, fieldState }) => (
    <Select
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
      options={roleOptions}
    />
  )}
/>
```

## Default Values and Reset

```tsx
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { email: '', password: '' },
});

// Reset to new values after server load
useEffect(() => {
  if (serverData) form.reset(serverData);
}, [serverData, form]);
```

Always provide `defaultValues` — avoids uncontrolled→controlled warnings and makes reset predictable.

## Server-Side Validation Errors

```tsx
const submit = handleSubmit(async (data) => {
  const result = await createUser(data);
  if (!result.ok) {
    // Map server field errors back to form fields
    result.errors.forEach(({ field, message }) => {
      setError(field as keyof FormData, { message });
    });
    return;
  }
  router.push('/dashboard');
});
```

## FormArray — Dynamic Fields

```tsx
import { useFieldArray } from 'react-hook-form';

const { fields, append, remove } = useFieldArray({ control, name: 'tags' });

return (
  <>
    {fields.map((field, index) => (
      <div key={field.id}>
        <input {...register(`tags.${index}.value`)} />
        <button type="button" onClick={() => remove(index)}>Remove</button>
      </div>
    ))}
    <button type="button" onClick={() => append({ value: '' })}>Add tag</button>
  </>
);
```

## Zod Schema Patterns

```ts
// Conditional validation
const schema = z.object({
  type: z.enum(['personal', 'business']),
  companyName: z.string().optional(),
}).refine(
  data => data.type !== 'business' || !!data.companyName,
  { message: 'Company name required for business accounts', path: ['companyName'] }
);

// Password confirm
z.object({
  password: z.string().min(8),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords must match',
  path: ['confirm'],
});
```

## Anti-Patterns

- ❌ Manual `useState` per field — use `register` instead
- ❌ Defining TypeScript type separately from Zod schema — use `z.infer<typeof schema>`
- ❌ Using `useEffect` to watch fields — use `watch()` or `useWatch()` from react-hook-form
- ❌ Skipping `defaultValues` — causes uncontrolled/controlled switching
- ❌ Calling `handleSubmit` without `await` on async handlers — missed error handling

## Verification

1. Submit form with invalid data — Zod errors appear on correct fields
2. Submit with server error — `setError('root', ...)` displays global message
3. `isSubmitting` disables button during submit

## References

- [Form Patterns](references/form-patterns.md) — multi-step forms, file upload, async select
