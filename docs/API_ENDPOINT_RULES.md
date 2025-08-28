# 🔌 API Endpoint Rules for Frontend Development

This document provides comprehensive guidelines for constructing API endpoint URLs when making requests from the Vue.js frontend application to the FastAPI backend.

## 🏗️ Backend API & Proxy Architecture

### Infrastructure Overview
- **Backend FastAPI Server (local)**: `http://localhost:8000`
- **Frontend Vite Dev Server**: Uses a proxy configuration for API routing
- **Proxy Target (Dev)**: Requests starting with `/api` are forwarded to the backend with the `/api` prefix stripped
- **Production Resolution**: The base origin is taken from `VITE_API_BASE_URL` (or legacy `VITE_API_BASE_URL_PROD`), and requests still include `/api` in the path

### Proxy & Environment Configuration
The Vite development server (`vite.config.ts`) intercepts `/api/*` calls and rewrites them by removing the `/api` prefix before forwarding to `http://localhost:8000`.

In production we do NOT rely on a proxy. Instead, the Axios client resolves its `baseURL` via this priority order:
1. `VITE_API_BASE_URL`
2. `VITE_API_BASE_URL_PROD` (legacy)
3. (Dev only) empty string `''` to enable the dev proxy
4. Safety fallback: `https://reader-study.fly.dev`

Important:
- The value of `VITE_API_BASE_URL` must NOT include `/api`.
- Frontend calls must ALWAYS include the `/api` prefix in code (keeps dev/prod symmetric and avoids accidental absolute paths).
- To bypass the proxy locally (not typical), set `VITE_API_BASE_URL=http://localhost:8000` and adjust rules accordingly (dropping `/api` usage) — this is discouraged because it fragments conventions.

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
**Problem**: Mixing absolute URLs (hard-coded origins) with relative ones
**Solution**: Use relative URLs with the `/api` prefix; let the Axios baseURL + proxy/env handle origins

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
- **API Client**: `src/api/index.ts` - Centralized HTTP client setup & env fallback logic
- **Environment Variable**: `VITE_API_BASE_URL` (preferred) sets production backend origin (no `/api` suffix)

By following these rules and patterns, you ensure consistent API communication between the frontend and backend while maintaining clean, maintainable code that's easy to debug and extend.
