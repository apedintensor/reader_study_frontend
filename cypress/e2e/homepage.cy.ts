// cypress/e2e/homepage.cy.ts
describe('Reader Study App E2E', () => {
  const username = 'danmo2060@gmail.com';
  const password = '1234';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should allow a user to login, view dashboard, and navigate to a case', () => {
    cy.visit('/login');
    cy.contains('.text-3xl', 'Welcome Back').should('be.visible');

    // Intercept login request with proper form data
    cy.intercept('POST', '/api/auth/jwt/login').as('loginRequest');
    
    cy.get('input[aria-label="Email"]').type(username);
    cy.get('input[aria-label="Password"]').type(password);
    cy.get('button[type="submit"]').click();
    
    cy.wait('@loginRequest').then((interception) => {
      expect(interception.request.body).to.be.a('string');
      expect(interception.request.headers['content-type']).to.include('application/x-www-form-urlencoded');
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body).to.have.property('access_token');
    });

    // Dashboard should now be at root (/)
    cy.location('pathname').should('equal', '/');
    
    // Verify local storage has token
    cy.window().its('localStorage')
      .invoke('getItem', 'access_token')
      .should('exist');

    // Verify dashboard load
    cy.contains('.text-xl', 'Study Progress').should('be.visible');
    cy.contains('.text-500', 'Total Cases').should('be.visible');

    // Check case list
    cy.get('.p-datatable-tbody > tr').should('exist');

    // Click first case and verify navigation
    cy.contains('button', 'Start').first().click();
    cy.url().should('match', /\/case\/\d+$/);
    cy.contains('.text-xl', 'Pre-AI Assessment').should('be.visible');
  });
});

describe('Dashboard Progress Display', () => {
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
        expect(interception.request.body).to.be.a('string');
        expect(interception.request.headers['content-type']).to.include('application/x-www-form-urlencoded');
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.body).to.have.property('access_token');
      });

      // Dashboard should now be at root (/)
      cy.location('pathname').should('equal', '/');
      
      // Verify local storage has token
      cy.window().its('localStorage')
        .invoke('getItem', 'access_token')
        .should('exist');
    });
  });

  it('should display correct case progress after assessment completion', () => {
    cy.visit('/');
    
    // Note initial case count
    cy.get('.p-datatable-tbody > tr').then($rows => {
      const totalCases = $rows.length;
      
      // Navigate to first incomplete case
      cy.contains('button', 'Start').first().click();
      
      // Complete pre-AI assessment with new dropdown handling
      cy.selectPrimeVueDropdownOption('#diag1', 0);
      cy.selectPrimeVueDropdownOption('#diag2', 1);
      cy.selectPrimeVueDropdownOption('#diag3', 2);
      cy.selectPrimeVueDropdownOption('#management', 0);
      
      // Submit pre-AI assessment
      cy.contains('button', 'Submit & View AI Suggestions').click();
      
      // Verify the case status updated in dashboard
      cy.visit('/');
      cy.get('.p-tag').first().should('contain', 'Post-AI Pending');
      cy.contains('button', 'Continue').should('exist');
      
      // Check progress stats updated
      cy.get('.text-900.text-4xl').eq(1).invoke('text').then(completedText => {
        const completed = parseInt(completedText);
        expect(completed).to.be.at.least(0);
        expect(completed).to.be.at.most(totalCases);
      });
    });
  });
});
