---
name: cypress-e2e
description: Cypress E2E testing — config, data-cy selectors, Custom Commands, cy.intercept with request assertions and fixture, and network error simulation. Use when writing end-to-end tests, stubbing API responses, or setting up Cypress in a project.
metadata:
  triggers:
    files:
      - 'cypress.config.*'
      - 'cypress/**/*.cy.ts'
    keywords:
      - cypress
      - cy.intercept
      - cy.visit
---

# Cypress E2E

## Config

```ts
// cypress.config.ts
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
  },
});
```

## Selectors — data-cy Attributes

```ts
cy.get('[data-cy="submit-btn"]').click()    // ✓ stable, purpose-clear
cy.dataCy('submit-btn').click()             // ✓ shorthand via Custom Command
cy.get('.btn-primary').click()              // ✗ breaks on CSS refactor
cy.get('#submit').click()                   // ✗ breaks on ID rename
// HTML: <button data-cy="submit-btn">Submit</button>
```

## Custom Commands

```ts
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.dataCy('email').type(email)
    cy.dataCy('password').type(password)
    cy.dataCy('submit').click()
    cy.url().should('include', '/dashboard')
  })
})

Cypress.Commands.add('dataCy', (value: string) => cy.get(`[data-cy="${value}"]`))
```

## cy.intercept

```ts
// stub + alias + wait
cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers')
cy.visit('/users')
cy.wait('@getUsers')
cy.dataCy('user-list').children().should('have.length', 3)

// request assertion — verify payload
cy.intercept('POST', '/api/auth/login').as('login')
cy.dataCy('submit').click()
cy.wait('@login').its('request.body')
  .should('deep.equal', { email: 'alice@example.com', password: 'pw' })

// network error simulation
cy.intercept('GET', '/api/users', { forceNetworkError: true })
cy.dataCy('error-msg').should('be.visible')
```

## Fixtures

```ts
// cypress/fixtures/users.json → [{ "id": "1", "name": "Alice" }]
cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers')
cy.fixture('users.json').then((users) => {
  cy.dataCy('user-name').should('contain', users[0].name)
})
```

## Anti-Patterns

- ❌ `cy.get('.class')` / `cy.get('#id')` — use `[data-cy]` attributes for stable selectors
- ❌ `cy.wait(2000)` arbitrary sleep — use `cy.wait('@alias')` or retry-able assertions
- ❌ Shared state across tests — each test must be fully independent; use `cy.session()` for auth
- ❌ `cy.intercept` without `cy.wait('@alias')` — the intercept may not have been reached
- ❌ Testing implementation details in E2E — assert user-visible outcomes only

## References

- [Cypress Patterns](references/cypress-patterns.md) — TypeScript declarations, CI setup, fixture patterns, intercept advanced
