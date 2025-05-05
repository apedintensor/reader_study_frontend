// cypress/e2e/homepage.cy.ts
describe('Reader Study App E2E', () => {
  beforeEach(() => {
    // Optional: Clear local storage or cookies before each test
    cy.clearLocalStorage();
    cy.clearCookies();
    // Seed database or set up initial state if necessary
  });

  it('should allow a user to login, view dashboard, and navigate to a case', () => {
    // Visit the login page
    cy.visit('/login');
    cy.contains('h2', 'Login').should('be.visible');

    // Enter credentials (use environment variables or fixtures in a real scenario)
    cy.get('input[placeholder="Email"]').type('test@example.com');
    cy.get('input[placeholder="Password"]').type('password');

    // Submit the login form
    cy.get('button[type="submit"]').click();

    // Verify redirection to the dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('h2', 'Reader Study Dashboard').should('be.visible');
    cy.contains('Available Cases').should('be.visible');

    // Click on the first available case link (assuming there's at least one)
    // Adjust the selector based on how cases are actually listed
    cy.get('.p-datatable-tbody > tr').first().find('a').click();

    // Verify navigation to the case page
    cy.url().should('match', /\/case\/\d+$/); // Matches /case/ followed by numbers
    cy.contains('h2', /Case \d+ Details/).should('be.visible'); // Matches "Case [number] Details"
    cy.contains('Pre-AI Assessment').should('be.visible');

    // --- Placeholder for filling Pre-AI form ---
    // TODO: Add steps to fill the pre-AI form fields (dropdowns, sliders, etc.)
    // Example (needs actual selectors and data):
    // cy.get('#preAiDiagnosis1').parent().click().get('.p-dropdown-item').contains('Psoriasis').click();
    // cy.get('#preAiConfidenceTop1').parent().find('.p-slider-handle').type('{rightarrow}'); // Example for slider
    // cy.get('#preAiSubmitButton').click();

    // --- Placeholder for verifying Post-AI section or completion ---
    // TODO: Add assertions for the next step after pre-AI submission
  });

  // Add more tests for signup, different assessment scenarios, etc.
});

describe('Homepage and Login', () => {
  it('visits the homepage', () => {
    cy.visit('/')
    cy.contains('h1', 'Welcome to the Reader Study') // Adjust if the heading is different
  })

  it('should log in successfully', () => {
    cy.visit('/login') // Assuming the login page route is /login

    // Find elements based on your LoginPage.vue structure
    // Adjust selectors if needed (e.g., using data-cy attributes is recommended)
    cy.get('input[type="email"]').type('danmo2060@gmail.com')
    cy.get('input[type="password"]').type('1234')
    cy.get('button[type="submit"]').click() // Adjust if the button selector is different

    // Assert successful login - check URL or presence of dashboard element
    cy.url().should('include', '/dashboard') // Assuming redirection to /dashboard
    cy.contains('h1', 'Dashboard') // Adjust if the dashboard heading is different
  })
})

describe('Authenticated Endpoint Test', () => {
  it('logs in and fetches cases', () => {
    // Use cy.request for API interaction, not UI login
    cy.request({
      method: 'POST',
      url: '/auth/jwt/login', // Assuming API is served relative to baseUrl
      form: true, // Use form encoding as per openapi.json
      body: {
        username: 'danmo2060@gmail.com',
        password: '1234',
      },
    }).then((loginResp) => {
      expect(loginResp.status).to.eq(200);
      expect(loginResp.body).to.have.property('access_token');
      const token = loginResp.body.access_token;

      // Now make a request to an authenticated endpoint
      cy.request({
        method: 'GET',
        url: '/cases/', // The endpoint to test
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((casesResp) => {
        expect(casesResp.status).to.eq(200);
        // Check if the response body is an array (as expected for /cases/)
        expect(casesResp.body).to.be.an('array');
        // Add more specific assertions if needed, e.g., check array length or properties of items
        cy.log('Successfully fetched cases:', casesResp.body);
      });
    });
  });
});
