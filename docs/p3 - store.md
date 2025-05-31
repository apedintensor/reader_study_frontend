# Pinia State Management Guide

## Objective
Develop Pinia stores for user authentication and case data, featuring persistent state and error handling.

## Store Architecture

### Directory Structure
```
src/stores/
├── userStore.ts     // Manages user authentication and profile
├── caseStore.ts     // Handles case data and progress
└── index.ts         // Optional: for re-exporting stores
```

## UserStore (`userStore.ts`)

### Responsibilities
-   Manages authentication state (token, user data).
-   Synchronizes with localStorage for persistence.
-   Integrates with API for user profile and auth calls.
-   Handles login/logout lifecycle.

### TypeScript Interface Example
```typescript
interface User {
  id: number;
  email: string;
  // Add other relevant user properties
}
```

### Store Definition
```typescript
import { defineStore } from 'pinia';
// import apiClient from '@/api'; // Your Axios instance

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('access_token') || null,
    currentUser: null as User | null,
  }),
  actions: {
    setToken(newToken: string | null) {
      this.token = newToken;
      if (newToken) {
        localStorage.setItem('access_token', newToken);
        // apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      } else {
        localStorage.removeItem('access_token');
        // delete apiClient.defaults.headers.common['Authorization'];
      }
    },
    async fetchCurrentUser() {
      if (!this.token) return false;
      try {
        // const response = await apiClient.get('/api/auth/users/me');
        // this.currentUser = response.data;
        // return true;
      } catch (error) {
        this.logout(); // Clear state on auth error
        return false;
      }
      return false; // Placeholder
    },
    logout() {
      this.setToken(null);
      this.currentUser = null;
      // Optionally, redirect to login page via router
    },
    loadFromLocalStorage() {
      const token = localStorage.getItem('access_token');
      if (token) {
        this.setToken(token);
        this.fetchCurrentUser();
      }
    },
  },
});
```

## CaseStore (`caseStore.ts`)

### Responsibilities
-   Manages case data fetching and caching.
-   Tracks pre-AI and post-AI assessment completion.
-   Handles current assessment data and form state.
-   Manages case navigation logic.

### TypeScript Interface Examples
```typescript
interface CaseData {
  id: number;
  // ... other case properties
}

interface CaseProgress {
  caseId: number;
  preCompleted: boolean;
  postCompleted: boolean;
}
```

### Store Definition
```typescript
import { defineStore } from 'pinia';
// import apiClient from '@/api';

export const useCaseStore = defineStore('case', {
  state: () => ({
    cases: [] as CaseData[],
    progress: {} as Record<number, CaseProgress>,
    // ... other case-related state
  }),
  actions: {
    async loadCases() {
      try {
        // const response = await apiClient.get('/api/cases/');
        // this.cases = response.data;
        // return true;
      } catch (error) {
        console.error('Failed to load cases:', error);
        return false;
      }
      return false; // Placeholder
    },
    // Add other actions like loadAssessmentsAndProgress, updateCaseProgress, etc.
  },
});
```

## Persistence Strategy

-   **LocalStorage Keys**: Define constants for keys (e.g., `USER_TOKEN`, `CASE_PROGRESS`).
-   **Synchronization**: API is the source of truth. LocalStorage for caching and offline drafts.
-   **Hydration**: Load persisted state on app initialization.

## Testing
-   **Unit Tests**: For individual store actions and getters.
-   **Integration Tests**: For interactions between stores and API calls (mocked).

## Setup

Ensure Pinia is installed and registered in `src/main.ts`:
```typescript
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');
```

## Performance Notes
-   Use lazy loading for detailed case data where appropriate.
-   Leverage Pinia's computed properties for derived state.

## Key Guidelines
-   Prioritize type safety with TypeScript.
-   Handle API errors gracefully within store actions.
-   Ensure reactive state is updated correctly to reflect in the UI.
