# Project Initialization Guide (Vue 3 + Vite)

This guide walks you through setting up a Vue 3 application using Vite, PrimeVue, Pinia, and Cypress for end-to-end testing.

## Prerequisites

- Node.js v16 or later
- npm (bundled with Node.js)

## 1. Install Dependencies

Open a PowerShell terminal in the project root and run:

```pwsh
npm install primevue primeicons pinia vue-router axios
npm install --save-dev cypress
```

## 2. Configure Vite

Create or update **vite.config.ts**:

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
```

> No additional configuration is required for PrimeVue or Cypress at this stage.

## 3. Update main.ts

Register PrimeVue, Pinia, and Vue Router in **src/main.ts**:

```ts
import { createApp } from 'vue';
import App from './App.vue';
import PrimeVue from 'primevue/config';
import 'primevue/resources/themes/saga-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';
import { createPinia } from 'pinia';
import router from './router';

const app = createApp(App);
app.use(PrimeVue);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

## 4. Organize Project Structure

```
src/
├── api/             # API client modules
├── assets/          # Images, icons, and styles
├── components/      # Reusable Vue components
├── pages/           # Route components
├── router/          # Vue Router configuration
├── stores/          # Pinia state management
├── App.vue
└── main.ts
```

## 5. Scaffold Core Files

### 5.1 Router Configuration

**src/router/index.ts**:

```ts
import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';

const routes = [
  { path: '/', component: HomePage },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
```

### 5.2 Home Page Component

**src/pages/HomePage.vue**:

```vue
<template>
  <h1>Welcome to the Reader Study Dashboard</h1>
</template>
```

### 5.3 Main Layout Component

**src/components/MainLayout.vue**:

```vue
<template>
  <div>
    <header class="p-mb-4 p-p-3">
      <h2>Reader Study App</h2>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>
```

### 5.4 Wrap App in Layout

Update **src/App.vue**:

```vue
<template>
  <MainLayout />
</template>

<script setup>
import MainLayout from '@/components/MainLayout.vue';
</script>
```

## 6. Set Up Cypress

Initialize Cypress for end-to-end testing:

```pwsh
npx cypress open
```

Add a basic test in **cypress/e2e/homepage.cy.ts**:

```ts
describe('Home Page', () => {
  it('loads the dashboard', () => {
    cy.visit('/');
    cy.contains('Welcome to the Reader Study Dashboard');
  });
});
```

## 7. Next Steps

- Configure API endpoints in **src/api/**
- Implement user authentication flows
- Build additional pages and components
- Expand Cypress test coverage
