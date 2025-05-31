# JWT Authentication Implementation Guide

## Objective
Implement JWT-based authentication (user registration and login) using PrimeVue components.

## LoginPage.vue Implementation

### Key Features
- Email/Password form using PrimeVue InputText and Password.
- Real-time form validation with error messages.
- JWT token handling and localStorage persistence.
- Redirect to dashboard on successful login.
- User-friendly error messages via Toast notifications.

### Technical Details
- **API Endpoint**: `POST /api/auth/jwt/login`
- **Content Type**: `application/x-www-form-urlencoded`
- **Token Storage**: Save `access_token` to localStorage.
- **User Data**: Fetch user details post-login.
- **Redirect**: Navigate to `/dashboard` on success.

## SignupPage.vue Implementation

### Required Form Fields
1.  **Email**: InputText, required, email format validation.
2.  **Password**: Password, required, minimum 8 characters.
3.  **Age Bracket**: Dropdown, required.
4.  **Gender**: Dropdown, optional.
5.  **Years Clinical Experience**: InputNumber, required, range 0-50.
6.  **Years Dermatology Experience**: InputNumber, required, range 0-30.
7.  **Professional Role**: Dropdown, required (fetch from API).

### Data Sources for Dropdowns

-   **Age Brackets**: Predefined list (e.g., '20-29', '30-39', ...).
-   **Gender Options**: Predefined list (e.g., 'Male', 'Female', ...).
-   **Professional Roles**: Fetch from `GET /api/roles/` (e.g., 'General Practitioner', 'Dermatologist', ...).

### Registration Process
1.  Client-side form validation.
2.  API call: `POST /api/auth/register/register` with JSON payload.
3.  On success: Show success message, redirect to login.
4.  On error: Display validation or server errors.

### Sample Registration Payload Interface
```typescript
interface RegistrationData {
  email: string;
  password: string;
  age_bracket: string;
  gender?: string;
  years_experience: number;
  years_derm_experience: number;
  role_id: number;
  is_active: boolean; // Should be true by default
  is_superuser: boolean; // Should be false by default
}
```

## Security Best Practices

### Token Management
-   **Storage**: Use localStorage for `access_token`.
-   **Headers**: Automate token injection in API requests via Axios interceptors.
-   **Expiration**: Implement logic to handle token expiration (e.g., logout user).

### API Client (`src/api/index.ts`)
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/', // Adjust if your API is hosted elsewhere
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling auth errors (e.g., 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized access, e.g., redirect to login
      localStorage.removeItem('access_token');
      // Optionally, redirect or use a store action to logout
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## UI/UX Guidelines

### Design & Interaction
-   Utilize PrimeVue components exclusively.
-   Ensure responsive design for various screen sizes.
-   Implement loading indicators for API calls.
-   Provide clear error messages and guidance.

### Form Validation
-   Validate fields on blur/change events.
-   Display errors clearly, typically below the respective field.
-   Use Toast messages for success feedback.
-   Ensure accessibility (ARIA attributes, labels).

## Testing Strategy

### Unit Tests
-   Form validation logic.
-   API call handling (mocked).
-   Error state management.
-   Token storage and retrieval.

### Integration Tests
-   Full login/logout sequences.
-   Complete registration process.
-   Token persistence and re-authentication.

### End-to-End (E2E) Tests (Cypress)
```typescript
// cypress/e2e/auth.cy.ts
describe('Authentication Flow', () => {
  it('should allow a user to register and then login', () => {
    // Test registration
    cy.visit('/signup');
    // ... fill out form and submit
    cy.url().should('include', '/login');

    // Test login
    cy.visit('/login');
    // ... fill out form and submit
    cy.url().should('include', '/dashboard');
    cy.window().its('localStorage.access_token').should('exist');
  });
});
```

## Important Considerations
-   This guide assumes access tokens only (no refresh tokens).
-   Strictly use localStorage for token persistence.
-   Adhere to PrimeVue for all UI elements.
-   Maintain type safety using TypeScript interfaces.