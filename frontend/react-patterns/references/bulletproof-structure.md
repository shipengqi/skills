# Bulletproof React — Feature Module Structure

## Full Feature Layout

```
src/features/auth/
├── index.ts                  # Public API — only export what others need
├── components/
│   ├── login-form.tsx
│   ├── register-form.tsx
│   └── auth-layout.tsx
├── hooks/
│   ├── use-login.ts          # useQuery/useMutation wrappers
│   └── use-auth-user.ts
├── api/
│   └── auth.ts               # API call functions (not hooks)
└── types/
    └── auth.types.ts

# index.ts — explicit barrel
export { LoginForm } from './components/login-form';
export { useAuthUser } from './hooks/use-auth-user';
export type { AuthUser, LoginDto } from './types/auth.types';
# Do NOT export internals: hooks used only inside the feature, api functions, etc.
```

## API Layer Pattern

```ts
// features/auth/api/auth.ts
import { api } from '@/lib/api-client';
import type { LoginDto, AuthResponse } from '../types/auth.types';

export function login(dto: LoginDto): Promise<AuthResponse> {
  return api.post('/auth/login', dto);
}

export function logout(): Promise<void> {
  return api.post('/auth/logout');
}

// features/auth/hooks/use-login.ts — wraps API call in TanStack Query mutation
export function useLogin() {
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      useAuthStore.getState().setUser(data.user);
      router.push('/dashboard');
    },
  });
}
```

## lib/ — Third-Party Wrappers

```ts
// lib/api-client.ts — single axios instance
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (err) => Promise.reject(err.response?.data ?? err)
);
```

## Cross-Feature Import Rule

```ts
// ✓ import from feature's public API (index.ts)
import { LoginForm } from '@/features/auth';
import { useAuthUser } from '@/features/auth';

// ✗ deep import — breaks encapsulation, fragile to refactoring
import { LoginForm } from '@/features/auth/components/login-form';
import { login } from '@/features/auth/api/auth';
```

Enforce with ESLint `no-restricted-imports` rule or the `boundaries` plugin.
