# Cypress Patterns Reference

## TypeScript Declarations

```ts
// cypress/support/index.d.ts
declare namespace Cypress {
  interface Chainable {
    login(email: string, password: string): Chainable<void>
    dataCy(value: string): Chainable<JQuery<HTMLElement>>
  }
}
```

```ts
// cypress/support/e2e.ts
import './commands';
```

## Full Custom Commands Reference

```ts
// cypress/support/commands.ts
import 'cypress-real-events';

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.dataCy('email').type(email)
    cy.dataCy('password').type(password)
    cy.dataCy('submit').click()
    cy.url().should('include', '/dashboard')
  }, {
    validate: () => {
      cy.getCookie('session').should('exist')
    },
  })
})

Cypress.Commands.add('dataCy', (value: string) =>
  cy.get(`[data-cy="${value}"]`)
)
```

## cy.intercept — Advanced Patterns

```ts
// Modify response on the fly
cy.intercept('GET', '/api/users', (req) => {
  req.reply((res) => {
    res.body.push({ id: '99', name: 'Injected' })
  })
}).as('getUsers')

// Match by URL pattern
cy.intercept('GET', '/api/users/*').as('getUser')
cy.intercept({ method: 'POST', url: '/api/**', headers: { 'x-token': '*' } })

// Response delay simulation
cy.intercept('GET', '/api/slow', { delay: 2000, body: [] })
```

## Fixture Patterns

```ts
// cypress/fixtures/users.json
[
  { "id": "1", "name": "Alice", "role": "admin" },
  { "id": "2", "name": "Bob",   "role": "user"  }
]

// Load and use in test
cy.fixture('users.json').as('usersData')
cy.get('@usersData').then((users: any[]) => {
  cy.dataCy('first-user').should('contain', users[0].name)
})
```

## GitHub Actions CI

```yaml
# .github/workflows/e2e.yml
name: E2E
on: [push, pull_request]
jobs:
  cypress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm start
          wait-on: 'http://localhost:3000'
          browser: chrome
        env:
          CYPRESS_BASE_URL: http://localhost:3000
```

## Recommended Directory Structure

```
cypress/
  e2e/
    auth/
      login.cy.ts
      logout.cy.ts
    users/
      user-list.cy.ts
  fixtures/
    users.json
    auth.json
  support/
    commands.ts
    e2e.ts
    index.d.ts
cypress.config.ts
```

## Run Commands

```bash
npx cypress open          # interactive runner (development)
npx cypress run           # headless (CI)
npx cypress run --spec "cypress/e2e/auth/**"  # run specific specs
npx cypress run --browser chrome
```
