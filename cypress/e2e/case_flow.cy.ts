// cypress/e2e/case_flow.cy.ts

describe('Case Assessment Flow (Pre & Post AI)', () => {
    const username = 'danmo2060@gmail.com';
    const password = '1234';
  
    beforeEach(() => {
      // Use cy.session to cache the login state
      cy.session([username, password], () => {
        cy.visit('/login');
        // --- Login --- 
        // Use ID selectors based on LoginPage.vue
        cy.get('#email').type(username);
        cy.get('#password').type(password);
        cy.get('button[type=submit]').click(); // Select button by type
  
        // --- Verify Login Success ---
        // Wait for navigation to the dashboard and check URL
        cy.url().should('include', '/dashboard');
        // Optional: Check if localStorage contains the token (adjust key if needed)
        cy.window().its('localStorage.access_token').should('exist');
      }, {
        // Ensure localStorage is persisted across tests in this session
        cacheAcrossSpecs: false, // Usually false, set true if needed across spec files
        validate() {
          // Optional: Add validation logic here if needed, e.g., check token validity
          cy.window().its('localStorage.access_token').should('exist');
        }
      });
  
      // Visit the dashboard before each test run (session is active)
      cy.visit('/dashboard');
    });
  
    it('should allow completing the Pre-AI and Post-AI assessment for a case', () => {
      // --- Navigate to the first case ---
      // Select the button by its text content
      cy.contains('button', 'Start Next Case').click();
      cy.url().should('include', '/case/'); // Verify navigation to a case page

      // --- Pre-AI Assessment ---
      cy.log('Starting Pre-AI Assessment');
      // Verify we are in Pre-AI by checking the heading
      cy.contains('h3', 'Your Assessment (Pre-AI)').should('be.visible');

      // Fill Diagnosis (using PrimeVue Dropdowns with IDs)
      // Rank 1
      cy.get('#diag1').click(); // Click the component directly
      // Target item globally with timeout
      cy.get('body .p-dropdown-item', { timeout: 10000 }).first().click(); 
      // Rank 2
      cy.get('#diag2').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).eq(1).click(); 
      // Rank 3
      cy.get('#diag3').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).eq(2).click(); 

      // Set Confidence Slider (using ID - interaction might need adjustment for PrimeVue)
      // This attempts to set value directly; might need keyboard interaction or clicking
      cy.get('#confidence').parent().find('.p-slider-handle').focus().type('{rightarrow}{rightarrow}'); // Example: Move slider to value 3 (assuming start is 1)

      // Select Management Strategy (using PrimeVue Dropdown with ID)
      cy.get('#management').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).first().click(); 

      // Set Certainty Slider (using ID - interaction might need adjustment)
      cy.get('#certainty').parent().find('.p-slider-handle').focus().type('{rightarrow}{rightarrow}'); // Example: Move slider to value 3

      // Submit Pre-AI form (find button by text)
      cy.contains('button', 'Submit Pre-AI & View AI').click();

      // --- Post-AI Assessment ---
      cy.log('Starting Post-AI Assessment');
      // Verify transition to Post-AI by checking the heading
      cy.contains('h3', 'Your Updated Assessment (Post-AI)').should('be.visible');
      // Verify AI predictions panel is visible
      cy.contains('.p-panel-header', 'AI Predictions').should('be.visible');

      // Fill Updated Diagnosis
      // Rank 1
      cy.get('#postDiag1').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).first().click(); 
      // Rank 2
      cy.get('#postDiag2').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).eq(1).click(); 
      // Rank 3
      cy.get('#postDiag3').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).eq(2).click(); 

      // Set Updated Confidence Slider
      cy.get('#postConfidence').parent().find('.p-slider-handle').focus().type('{rightarrow}{rightarrow}{rightarrow}{rightarrow}'); // Example: Move slider to value 5

      // Select Updated Management Strategy
      cy.get('#postManagement').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).eq(1).click(); 

      // Set Updated Certainty Slider
      cy.get('#postCertainty').parent().find('.p-slider-handle').focus().type('{rightarrow}{rightarrow}{rightarrow}'); // Example: Move slider to value 4

      // Answer AI Impact Questions (using PrimeVue SelectButton)
      // Assuming the buttons are identifiable by text within the component
      cy.contains('.p-selectbutton .p-button', 'No').first().click(); // Change Diagnosis? No
      cy.contains('.p-selectbutton .p-button', 'Yes').last().click(); // Change Management? Yes

      // Select AI Usefulness (using PrimeVue Dropdown with ID)
      cy.get('#aiUsefulness').click(); // Click the component directly
      cy.get('body .p-dropdown-item', { timeout: 10000 }).contains('Somewhat Useful').click(); 

      // Submit Post-AI form (find button by text)
      cy.contains('button', 'Submit Post-AI & Next Case').click();

      // --- Verify Completion ---
      // Check for navigation back to dashboard, or to the next case, or a completion message
      // Example: Check if URL is back to dashboard OR completion page
       cy.url().should(url => {
         expect(url).to.include('/dashboard').or.to.include('/complete')
       });
      // Or Example: Check for a completion message if applicable
      // cy.get('[data-cy=case-completion-message]').should('be.visible');
    });
  });