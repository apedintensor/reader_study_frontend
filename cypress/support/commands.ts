/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//       selectPrimeVueDropdownOption(selector: string, optionIndex: number): Chainable<void>
//     }
//   }
// }

// Add a custom command for handling PrimeVue dropdowns
Cypress.Commands.add('selectPrimeVueDropdownOption', (selector: string, optionIndex: number) => {
  cy.get(selector).parent().click();
  // Wait for dropdown overlay to be visible
  cy.get('.p-dropdown-items-wrapper').should('be.visible');
  // Force click because PrimeVue sometimes has overlay issues in tests
  cy.get('.p-dropdown-item').eq(optionIndex).click({ force: true });
});