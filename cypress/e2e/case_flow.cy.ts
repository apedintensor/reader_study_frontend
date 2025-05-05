// cypress/e2e/case_flow.cy.ts

describe('Case Assessment Flow (Pre & Post AI)', () => {
  const username = 'danmo2060@gmail.com';
  const password = '1234';

  beforeEach(() => {
    cy.session([username, password], () => {
      cy.visit('/login');
      cy.intercept('POST', '/api/auth/jwt/login').as('loginRequest');
      
      cy.get('input[aria-label="Email"]').type(username);
      cy.get('input[aria-label="Password"]').type(password);
      cy.get('button[type="submit"]').click();

      // Wait for login request and verify response
      cy.wait('@loginRequest').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.body).to.have.property('access_token');
      });

      cy.location('pathname').should('equal', '/');
    });

    cy.visit('/');
  });

  it('should allow completing the Pre-AI and Post-AI assessment for a case', () => {
    // Navigate to first case
    cy.contains('button', 'Start').first().click();
    cy.url().should('include', '/case/');

    // --- Pre-AI Assessment ---
    cy.log('Starting Pre-AI Assessment');
    cy.contains('.text-xl', 'Pre-AI Assessment').should('be.visible');

    // Intercept API calls
    cy.intercept('POST', '/api/assessments/').as('createAssessment');
    cy.intercept('POST', '/api/diagnoses/').as('createDiagnosis');
    cy.intercept('POST', '/api/management_plans/').as('createManagementPlan');

    // Fill diagnoses using custom command
    cy.selectPrimeVueDropdownOption('#diag1', 0);
    cy.selectPrimeVueDropdownOption('#diag2', 1);
    cy.selectPrimeVueDropdownOption('#diag3', 2);

    // Set confidence using SelectButton
    cy.get('.p-selectbutton').first().contains('3').click();

    // Select management strategy
    cy.selectPrimeVueDropdownOption('#management', 0);

    // Optional management notes
    cy.get('#managementNotes').type('Test management notes');

    // Set certainty using SelectButton
    cy.get('.p-selectbutton').last().contains('3').click();

    // Submit Pre-AI
    cy.contains('button', 'Submit & View AI Suggestions').click();

    // Wait for submissions and verify responses
    cy.wait('@createAssessment').its('response.statusCode').should('eq', 201);
    cy.wait('@createDiagnosis').its('response.statusCode').should('eq', 201);
    cy.wait('@createDiagnosis').its('response.statusCode').should('eq', 201);
    cy.wait('@createDiagnosis').its('response.statusCode').should('eq', 201);
    cy.wait('@createManagementPlan').its('response.statusCode').should('eq', 201);

    // --- Post-AI Assessment ---
    cy.log('Starting Post-AI Assessment');
    cy.contains('.text-xl', 'Post-AI Assessment').should('be.visible');
    cy.contains('.p-panel-header', 'AI Predictions').should('be.visible');

    // Reset API interceptors
    cy.intercept('POST', '/api/assessments/').as('createPostAssessment');
    cy.intercept('POST', '/api/diagnoses/').as('createPostDiagnosis');
    cy.intercept('POST', '/api/management_plans/').as('createPostManagementPlan');

    // Fill updated diagnoses using custom command
    cy.selectPrimeVueDropdownOption('#postDiag1', 0);
    cy.selectPrimeVueDropdownOption('#postDiag2', 1);
    cy.selectPrimeVueDropdownOption('#postDiag3', 2);

    // Set updated confidence
    cy.get('.p-selectbutton').first().contains('4').click();

    // Select updated management strategy
    cy.selectPrimeVueDropdownOption('#postManagement', 0);

    // Optional updated management notes
    cy.get('#postManagementNotes').type('Updated management notes after AI');

    // Set updated certainty
    cy.get('.p-selectbutton').eq(1).contains('4').click();

    // Answer AI impact questions
    cy.get('.p-selectbutton').eq(2).contains('No').click(); // Change diagnosis
    cy.get('.p-selectbutton').eq(3).contains('Yes').click(); // Change management

    // Select AI usefulness
    cy.selectPrimeVueDropdownOption('#aiUsefulness', 1); // 'Somewhat Useful' is typically the second option

    // Submit Post-AI
    cy.contains('button', 'Complete Assessment').click();

    // Wait for submissions and verify responses
    cy.wait('@createPostAssessment').its('response.statusCode').should('eq', 201);
    cy.wait('@createPostDiagnosis').its('response.statusCode').should('eq', 201);
    cy.wait('@createPostDiagnosis').its('response.statusCode').should('eq', 201);
    cy.wait('@createPostDiagnosis').its('response.statusCode').should('eq', 201);
    cy.wait('@createPostManagementPlan').its('response.statusCode').should('eq', 201);

    // Verify successful submission and navigation back to dashboard
    cy.contains('.p-toast-message', 'Case Completed!').should('be.visible');
    cy.location('pathname').should('equal', '/');
  });

  it('should save form progress in localStorage', () => {
    // Navigate to a case
    cy.contains('button', 'Start').first().click();

    // Fill some pre-AI fields using custom command
    cy.selectPrimeVueDropdownOption('#diag1', 0);
    cy.selectPrimeVueDropdownOption('#management', 0);

    // Reload the page
    cy.reload();

    // Verify fields were restored - wait for dropdown labels to be populated
    cy.get('#diag1').find('.p-dropdown-label').should('not.have.text', 'Select Primary Diagnosis');
    cy.get('#management').find('.p-dropdown-label').should('not.have.text', 'Select Management Strategy');
  });
});