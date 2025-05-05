# API Endpoint Rules for Frontend Development

This document outlines how to correctly construct API endpoint URLs when making requests from the frontend Vue application.

## Backend API & Proxy Setup

*   The backend FastAPI server runs at `http://localhost:8000`.
*   The frontend Vite development server uses a proxy configuration (`vite.config.ts`) to forward API requests.
*   The proxy specifically targets requests starting with `/api`. It removes the `/api` prefix before sending the request to the backend server (`http://localhost:8000`).

## Rule for Constructing Frontend API URLs

**To make an API call from the frontend code (e.g., using `apiClient` in stores or components), follow this rule:**

1.  **Find the desired endpoint path** in the backend's OpenAPI specification (`docs/openapi.json`). The paths listed there are relative to the backend server's root.
    *   *Example:* The endpoint to get user details might be listed as `/auth/users/me` in `openapi.json`.
    *   *Example:* The endpoint to get cases might be listed as `/cases/` in `openapi.json`.

2.  **Prefix the path found in `openapi.json` with `/api`.**

    *   *Example:* For `/auth/users/me`, the frontend URL is `/api/auth/users/me`.
    *   *Example:* For `/cases/`, the frontend URL is `/api/cases/`.
    *   *Example:* For `/images/case/{id}`, the frontend URL is `/api/images/case/{id}`.

**Use this `/api/...` prefixed URL when making requests with the `apiClient` (Axios instance).**

```typescript
// Example usage in frontend code:
import apiClient from '../api';

// Correct: Uses /api prefix
apiClient.get('/api/auth/users/me');
apiClient.get(`/api/cases/${caseId}`);
apiClient.post('/api/assessments/', payload);

// Incorrect: Missing /api prefix (will likely result in 404 or unexpected behavior)
// apiClient.get('/auth/users/me'); // WRONG
// apiClient.get(`/cases/${caseId}`); // WRONG
```

## Why this rule?

This convention ensures that:

*   All API requests from the frontend are clearly identifiable (they start with `/api`).
*   The Vite proxy correctly intercepts these requests and routes them to the backend API server.
*   The frontend code remains consistent regardless of the backend server's actual address during development.

**Always refer to `docs/openapi.json` for the base path and prefix it with `/api` in the frontend code.**
