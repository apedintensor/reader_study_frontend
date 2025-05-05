// cypress/e2e/homepage.cy.ts
describe('HomePage', () => {
  it('renders the welcome message', () => {
    cy.visit('/')
    cy.contains('h1', 'Welcome to Reader Study Dashboard').should('be.visible')
  })
})
