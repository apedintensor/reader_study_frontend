# 🔌 API Endpoint Rules for Frontend Development

This document provides comprehensive guidelines for constructing API endpoint URLs when making requests from the Vue.js frontend application to the FastAPI backend.

## 🏗️ Backend API & Proxy Architecture

### Infrastructure Overview
- **Backend FastAPI Server**: Runs on `http://localhost:8000`
- **Frontend Vite Dev Server**: Uses proxy configuration for API routing
- **Proxy Target**: All requests starting with `/api` are forwarded to the backend
- **Path Transformation**: The `/api` prefix is removed before forwarding to backend

### Proxy Configuration
The Vite development server (`vite.config.ts`) is configured to:
1. Intercept all requests beginning with `/api`
2. Remove the `/api` prefix from the URL path
3. Forward the modified request to `http://localhost:8000`

## 📋 URL Construction Rules

### Step-by-Step Process

1. **Locate Endpoint in OpenAPI Schema**
   - Find the desired endpoint in `docs/openapi.json`
   - Note the exact path as defined in the backend specification
   - Example paths: `/auth/users/me`, `/cases/`, `/images/case/{id}`

2. **Add Frontend API Prefix**
   - Prefix ALL backend paths with `/api`
   - This ensures proper proxy routing
   - Example transformations:
     - `/auth/users/me` → `/api/auth/users/me`
     - `/cases/` → `/api/cases/`
     - `/assessments/{user_id}/{case_id}/{is_post_ai}` → `/api/assessments/{user_id}/{case_id}/{is_post_ai}`

### ✅ Correct Usage Examples

```typescript
import apiClient from '../api';

// Authentication endpoints
apiClient.get('/api/auth/users/me');
apiClient.post('/api/auth/jwt/login', formData);

// Case data endpoints
apiClient.get('/api/cases/');
apiClient.get(`/api/cases/${caseId}`);
apiClient.get(`/api/images/case/${caseId}`);

// Assessment endpoints
apiClient.post('/api/assessments/', assessmentPayload);
apiClient.get(`/api/assessments/${userId}/${caseId}/${isPostAi}`);

// Supporting data endpoints
apiClient.get('/api/diagnosis_terms/');
apiClient.get('/api/management_strategies/');
```

### ❌ Incorrect Usage Examples

```typescript
// Missing /api prefix - WRONG!
apiClient.get('/auth/users/me');
apiClient.get('/cases/');
apiClient.post('/assessments/', data);

// Using absolute URLs - WRONG!
apiClient.get('http://localhost:8000/cases/');

// Inconsistent prefixing - WRONG!
apiClient.get('api/cases/'); // Missing leading slash
```

## 🔍 Endpoint Categories

### Authentication Endpoints
```typescript
POST /api/auth/jwt/login          // User login
POST /api/auth/register/register  // User registration  
GET  /api/auth/users/me          // Current user info
```

### Core Data Endpoints
```typescript
GET  /api/cases/                 // List all cases
GET  /api/cases/{id}            // Specific case details
GET  /api/images/case/{id}      // Case images
GET  /api/case_metadata/case/{id} // Case metadata
```

### Assessment Endpoints
```typescript
POST /api/assessments/           // Create assessment
GET  /api/assessments/{user_id}/{case_id}/{is_post_ai} // Get specific assessment
GET  /api/diagnoses/assessment/{assessment_id} // Assessment diagnoses
GET  /api/management_plans/assessment/{user_id}/{case_id}/{is_post_ai} // Management plans
```

### Reference Data Endpoints
```typescript
GET  /api/diagnosis_terms/       // Available diagnosis terms
GET  /api/management_strategies/ // Available management strategies
GET  /api/ai_outputs/case/{id}  // AI predictions for case
```

## 🚨 Common Pitfalls & Solutions

### Pitfall #1: Missing API Prefix
**Problem**: Direct use of OpenAPI paths without `/api` prefix
**Solution**: Always add `/api` prefix to all backend endpoint paths

### Pitfall #2: Inconsistent URL Formatting
**Problem**: Mixing absolute and relative URLs
**Solution**: Use relative URLs with `/api` prefix consistently

### Pitfall #3: Manual URL Construction
**Problem**: Building URLs with string concatenation
**Solution**: Use template literals with proper parameter substitution

```typescript
// Good: Template literal with parameters
const url = `/api/assessments/${userId}/${caseId}/${isPostAi}`;
apiClient.get(url);

// Bad: String concatenation
const url = '/api/assessments/' + userId + '/' + caseId + '/' + isPostAi;
```

## 🔧 Development Best Practices

### API Client Configuration
- Use the centralized `apiClient` instance from `src/api/index.ts`
- Leverage Axios interceptors for authentication headers
- Implement consistent error handling across all API calls

### Error Handling
```typescript
try {
  const response = await apiClient.get('/api/cases/');
  return response.data;
} catch (error) {
  if (error.response?.status === 404) {
    // Handle not found
  } else if (error.response?.status === 401) {
    // Handle authentication error
  }
  throw error;
}
```

### Type Safety
```typescript
interface CaseData {
  id: number;
  // ... other properties
}

const cases: CaseData[] = await apiClient.get('/api/cases/');
```

## 📚 Reference Resources

- **OpenAPI Specification**: `docs/openapi.json` - Complete API documentation
- **Vite Proxy Config**: `vite.config.ts` - Frontend proxy configuration
- **API Client**: `src/api/index.ts` - Centralized HTTP client setup

By following these rules and patterns, you ensure consistent API communication between the frontend and backend while maintaining clean, maintainable code that's easy to debug and extend.
