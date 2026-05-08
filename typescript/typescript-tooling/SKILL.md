---
name: typescript-tooling
description: Build toolchain for TypeScript Node.js projects and libraries — ESLint flat config, Prettier, tsup bundling, tsc type-checking, and pre-commit hooks. Use when configuring linting, formatting, building, or CI type-check pipelines.
metadata:
  triggers:
    files:
      - 'tsconfig.json'
      - 'eslint.config.*'
      - '.eslintrc.*'
      - 'tsup.config.*'
      - '.prettierrc*'
    keywords:
      - eslint
      - prettier
      - tsup
      - lint-staged
      - husky
      - ts-expect-error
---

# TypeScript Tooling

## ESLint Flat Config (eslint.config.ts)

```ts
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { project: true, tsconfigRootDir: import.meta.dirname } },
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  { ignores: ['dist/'] },
);
```

Use `@ts-expect-error` (not `@ts-ignore`) for edge-cases — fails at build time if the error disappears.

## Prettier (.prettierrc)

```json
{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

Never configure Prettier rules in ESLint — run as separate tools. In CI: `prettier --check .`.

## tsup — Library Bundling

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

For ESM-only apps (not libraries), `"type": "module"` + `tsc` output is sufficient — skip tsup.

## CI Scripts

```json
{ "scripts": { "type-check": "tsc --noEmit", "build": "tsup", "lint": "eslint . --max-warnings 0" } }
```

Always run `tsc --noEmit` in CI — bundlers (esbuild, tsup) skip type-checking.

## Pre-commit (lint-staged + Husky)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix --max-warnings 0", "prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged && npm run type-check
```

## Anti-Patterns

- ❌ `@ts-ignore` — use `@ts-expect-error` with a comment; it fails if the error is fixed
- ❌ Prettier rules in ESLint — install `eslint-config-prettier` to turn them off
- ❌ Skipping `tsc --noEmit` in CI — bundlers don't type-check
- ❌ `eslint-disable` globally — suppress per-line, fix root cause
- ❌ `strict: true` flip on existing repos — migrate incrementally (`strictNullChecks` first)

## References

- [Tooling Patterns](references/tooling-patterns.md) — ESLint rules, tsup presets, tsconfig migration
