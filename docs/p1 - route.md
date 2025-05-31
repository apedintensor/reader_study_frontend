# Vue Router Configuration Guide

This guide details setting up routing in a Vue 3 application using Vue Router and dynamic layouts.

## 1. File Structure

Ensure the following structure under `src/`:

```
src/
├── pages/
│   ├── LoginPage.vue
│   ├── SignupPage.vue
│   ├── DashboardPage.vue
│   ├── CasePage.vue
│   └── CompletionPage.vue
├── components/
│   └── MainLayout.vue
└── router/
    └── index.ts
```

## 2. Install Dependencies

If not already installed, add Vue Router:

```pwsh
npm install vue-router@4
```

## 3. Router Setup

Create or update `src/router/index.ts`:

```ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { defineAsyncComponent } from 'vue';

// Layout wrapper for authenticated routes
import MainLayout from '@/components/MainLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: defineAsyncComponent(() => import('@/pages/LoginPage.vue'))
  },
  {
    path: '/signup',
    name: 'Signup',
    component: defineAsyncComponent(() => import('@/pages/SignupPage.vue'))
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: defineAsyncComponent(() => import('@/pages/DashboardPage.vue'))
      },
      {
        path: 'case/:id',
        name: 'Case',
        component: defineAsyncComponent(() => import('@/pages/CasePage.vue'))
      },
      {
        path: 'complete',
        name: 'Complete',
        component: defineAsyncComponent(() => import('@/pages/CompletionPage.vue'))
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Global navigation guard for authentication
router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth;
  const isAuthenticated = Boolean(localStorage.getItem('access_token'));
  if (requiresAuth && !isAuthenticated) {
    next({ name: 'Login' });
  } else if ((to.name === 'Login' || to.name === 'Signup') && isAuthenticated) {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
```

## 4. Layout Component

Create `src/components/MainLayout.vue`:

```vue
<template>
  <div>
    <header class="p-shadow-2 p-p-3">
      <h2>Reader Study</h2>
    </header>
    <main class="p-m-4">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// Main application layout
</script>
```

## 5. Placeholder Pages

Create simple placeholders under `src/pages/`:

```vue
<!-- LoginPage.vue -->
<template>
  <h1>Login Page</h1>
</template>
```

Repeat for `SignupPage.vue`, `DashboardPage.vue`, `CasePage.vue`, and `CompletionPage.vue` with appropriate titles.

## 6. Integration in main.ts

Ensure router is registered in `src/main.ts`:

```ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(router);
app.mount('#app');
```
