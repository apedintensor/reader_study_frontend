# Cypress End-to-End Testing Guide

This guide outlines setting up Cypress for end-to-end (E2E) testing of the reader study application.

## 1. Cypress Scaffolding

-   **Initialization**: If Cypress is not yet part of the project, run `npx cypress open` in the terminal. This will create the necessary configuration files and folders.
-   **Test File Structure**: Create E2E test files (specs) within the `cypress/e2e/` directory. Suggested organization:
    -   `auth.cy.ts`: For user registration, login, and logout flows.
    -   `case_flow.cy.ts`: For testing the complete Pre-AI and Post-AI assessment sequence for a case.
    -   `resume_navigation.cy.ts`: For verifying session resume functionality and direct case navigation.

## 2. Mock Data and Helper Commands

-   **Location**: Place reusable mock data generators and custom Cypress commands in the `cypress/support/` directory.
-   **Mock Data Functions**: Create JavaScript/TypeScript functions to generate consistent mock data for:
    -   **Users**: For signup forms (email, password, demographic details).
        ```typescript
        // cypress/support/mockData.ts (example)
        export const generateMockUser = (overrides = {}) => ({
          email: `testuser_${Date.now()}@example.com`,
          password: 'password123',
          age_bracket: '30-39',
          gender: 'Female',
          years_experience: 5,
          years_derm_experience: 1,
          role_id: 1, // Example role ID
          ...overrides,
        });
        ```
    -   **Cases**: Sample case structures including metadata, image URLs, and AI outputs.
    -   **Diagnosis Terms & Management Strategies**: Small, hardcoded lists for testing dropdowns and submissions.
-   **Custom Commands**: Define custom Cypress commands in `cypress/support/commands.ts` for repetitive actions like logging in, filling forms, etc., to keep tests DRY.
    ```typescript
    // cypress/support/commands.ts (example)
    Cypress.Commands.add('login', (email, password) => {
      cy.visit('/login');
      cy.get('[data-cy=email-input]').type(email);
      cy.get('[data-cy=password-input]').type(password);
      cy.get('[data-cy=login-button]').click();
    });
    ```

## 3. Key Test Scenarios

Develop tests covering critical user flows:

-   **Authentication**: Successful registration, login with valid/invalid credentials, logout.
-   **Full Case Assessment Flow**: Complete Pre-AI assessment, view AI output, complete Post-AI assessment, navigate to next case.
-   **Session Resume**: User completes some Pre-AI cases, logs out, logs back in, and is correctly navigated to the next incomplete case.
-   **Direct Navigation**: User can jump to a specific case from the dashboard (respecting Pre-AI completion rules for Post-AI access).
-   **Form Submissions**: Verify data is correctly submitted and UI updates accordingly (e.g., progress indicators).
-   **Edge Cases**: Test scenarios like attempting to access Post-AI before Pre-AI, handling API errors gracefully (if mockable).

## 4. Optional Enhancements

-   **Completion Summary Page (`/complete`)**: If implemented, test that this page correctly displays summary statistics and any export functionality.
-   **Admin Dashboard (`/admin`)**: If an admin section exists, test its specific functionalities and role-based access.

## 5. Running Tests

-   **Interactive Mode**: `npx cypress open`
-   **Headless Mode** (for CI/CD or terminal execution): `npx cypress run`

Ensure tests are self-contained and clean up their state where necessary (e.g., using `beforeEach` or `afterEach` hooks for user creation/deletion if interacting with a live backend, or resetting state for frontend-only tests). Utilize `cy.intercept()` extensively to mock API responses and ensure predictable test runs.