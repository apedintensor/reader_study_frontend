// cypress/e2e/review_page.cy.ts

describe('Review Page Functionality', () => {
  const username = 'danmo2060@gmail.com';
  const password = '1234';

  beforeEach(() => {
    cy.session([username, password], () => {
      cy.visit('/login');
      cy.intercept('POST', '/api/auth/jwt/login').as('loginRequest');
      
      cy.get('input[aria-label="Email"]').type(username);
      cy.get('input[aria-label="Password"]').type(password);
      cy.get('button[type="submit"]').click();

      cy.wait('@loginRequest').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200);
        expect(interception.response?.body).to.have.property('access_token');
      });

      cy.location('pathname').should('equal', '/');
    });

    cy.visit('/');
  });

  it('should navigate to review page for completed cases', () => {
    // Find a completed case (if any) and click Review button
    cy.get('.p-datatable-tbody tr').each(($row) => {
      cy.wrap($row).within(() => {
        cy.get('.p-tag').then(($tag) => {
          if ($tag.text().includes('Completed')) {
            cy.get('button').contains('Review').click();
            cy.url().should('include', '/review');
            return false; // Break the loop
          }
        });
      });
    });
  });

  it('should display case review information when localStorage data exists', () => {
    // Create mock localStorage data for a case
    const caseId = 1;
    const mockPreAiData = {
      diagnosisRank1Id: 1,
      diagnosisRank2Id: 2,
      diagnosisRank3Id: 3,
      confidenceScore: 4,
      managementStrategyId: 1,
      managementNotes: 'Test management notes',
      certaintyScore: 3
    };

    const mockPostAiData = {
      diagnosisRank1Id: 2,
      diagnosisRank2Id: 1,
      diagnosisRank3Id: 3,
      confidenceScore: 5,
      managementStrategyId: 2,
      managementNotes: 'Updated management notes',
      certaintyScore: 4,
      changeDiagnosis: true,
      changeManagement: true,
      aiUsefulness: 'Very Useful'
    };

    // Set localStorage data
    cy.window().then((win) => {
      win.localStorage.setItem(`case_${caseId}_preai`, JSON.stringify(mockPreAiData));
      win.localStorage.setItem(`case_${caseId}_postai`, JSON.stringify(mockPostAiData));
    });

    // Intercept API calls
    cy.intercept('GET', `/api/cases/${caseId}`, {
      statusCode: 200,
      body: {
        id: caseId,
        case_metadata_relation: {
          id: 1,
          case_id: caseId,
          age: 45,
          gender: 'Female',
          fever_history: true,
          psoriasis_history: false,
          other_notes: 'Test case notes'
        },
        images: [
          {
            id: 1,
            image_url: '/6970012_preview.jpg',
            case_id: caseId
          }
        ]
      }
    }).as('getCase');

    cy.intercept('GET', '/api/management_strategies/', {
      statusCode: 200,
      body: [
        { id: 1, name: 'Topical treatment' },
        { id: 2, name: 'Systemic treatment' }
      ]
    }).as('getStrategies');

    cy.intercept('GET', '/api/diagnosis_terms/', {
      statusCode: 200,
      body: [
        { id: 1, name: 'Psoriasis' },
        { id: 2, name: 'Eczema' },
        { id: 3, name: 'Dermatitis' }
      ]
    }).as('getTerms');

    cy.intercept('GET', `/api/ai_outputs/case/${caseId}`, {
      statusCode: 200,
      body: [
        {
          id: 1,
          case_id: caseId,
          prediction_id: 1,
          rank: 1,
          confidence_score: 0.85,
          prediction: { id: 1, name: 'Psoriasis' }
        },
        {
          id: 2,
          case_id: caseId,
          prediction_id: 2,
          rank: 2,
          confidence_score: 0.72,
          prediction: { id: 2, name: 'Eczema' }
        }
      ]
    }).as('getAiOutputs');

    // Visit the review page
    cy.visit(`/case/${caseId}/review`);

    // Wait for API calls
    cy.wait('@getCase');
    cy.wait('@getStrategies');
    cy.wait('@getTerms');
    cy.wait('@getAiOutputs');

    // Verify review page elements
    cy.contains('h1', `Case Review #${caseId}`).should('be.visible');
    cy.get('.p-tag').contains('Completed').should('be.visible');
    
    // Verify case images are displayed
    cy.contains('Case Images').should('be.visible');
    
    // Verify case metadata is displayed
    cy.contains('Case Metadata').should('be.visible');
    cy.contains('Age:').should('be.visible');
    cy.contains('45').should('be.visible');
    cy.contains('Gender:').should('be.visible');
    cy.contains('Female').should('be.visible');
    
    // Verify AI predictions are displayed
    cy.contains('AI Predictions').should('be.visible');
    cy.get('.p-datatable').should('be.visible');
    
    // Verify assessment displays
    cy.contains('Pre-AI Assessment').should('be.visible');
    cy.contains('Post-AI Assessment').should('be.visible');
    cy.contains('Assessment Comparison').should('be.visible');
  });

  it('should show error message when review data is not available', () => {
    const caseId = 999; // Non-existent case
    
    cy.intercept('GET', `/api/cases/${caseId}`, {
      statusCode: 404,
      body: { detail: 'Case not found' }
    }).as('getCaseNotFound');

    cy.visit(`/case/${caseId}/review`);
    
    cy.wait('@getCaseNotFound');
    
    // Should show error message
    cy.contains('Unable to Load Review Data').should('be.visible');
    cy.get('button').contains('Return to Dashboard').should('be.visible').click();
    
    // Should navigate back to dashboard
    cy.location('pathname').should('equal', '/');
  });

  it('should navigate back to dashboard when clicking back button', () => {
    const caseId = 1;
    
    // Mock successful API calls with minimal data
    cy.intercept('GET', `/api/cases/${caseId}`, {
      statusCode: 200,
      body: {
        id: caseId,
        case_metadata_relation: null,
        images: []
      }
    }).as('getCase');

    cy.intercept('GET', '/api/management_strategies/', { statusCode: 200, body: [] }).as('getStrategies');
    cy.intercept('GET', '/api/diagnosis_terms/', { statusCode: 200, body: [] }).as('getTerms');
    cy.intercept('GET', `/api/ai_outputs/case/${caseId}`, { statusCode: 200, body: [] }).as('getAiOutputs');

    // Set minimal localStorage data
    cy.window().then((win) => {
      win.localStorage.setItem(`case_${caseId}_preai`, JSON.stringify({ diagnosisRank1Id: 1 }));
      win.localStorage.setItem(`case_${caseId}_postai`, JSON.stringify({ diagnosisRank1Id: 1 }));
    });

    cy.visit(`/case/${caseId}/review`);
    
    cy.wait('@getCase');
    
    // Click back button
    cy.get('button').contains('Back to Dashboard').click();
    
    // Should navigate back to dashboard
    cy.location('pathname').should('equal', '/');
  });
});
