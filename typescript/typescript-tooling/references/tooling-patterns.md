# TypeScript Tooling Reference

## ESLint Flat Config — Full Rule Set

```ts
// eslint.config.ts
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,  // disables ESLint rules that conflict with Prettier
  {
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  { ignores: ['dist/', 'coverage/', '*.config.js'] },
);
```

## tsup Presets

```ts
// Library with multiple entry points
export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,  // disable for CJS compat
  shims: true,       // inject __dirname/__filename shims for ESM
});

// CLI binary
export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  banner: { js: '#!/usr/bin/env node' },
  dts: false,
  clean: true,
});
```

## tsconfig Migration (Incremental)

Existing repos should NOT flip `strict: true` in one step — it creates hundreds of errors.

Staged migration order:
1. `"strictNullChecks": true` — biggest impact, catches null/undefined bugs
2. `"noImplicitAny": true` — forces explicit types on parameters
3. `"strictFunctionTypes": true` — variance checking on callbacks
4. `"strict": true` — combines all of the above plus more

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## GitHub Actions CI

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run format:check
      - run: npm run build
```
