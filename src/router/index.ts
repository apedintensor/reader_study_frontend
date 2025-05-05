import { defineAsyncComponent } from 'vue' // Import defineAsyncComponent from vue
import { createRouter, createWebHistory } from 'vue-router' // Keep other imports from vue-router
import HomePage from '../pages/HomePage.vue'

// Lazy load components
const LoginPage = defineAsyncComponent(() => import('../pages/LoginPage.vue'))
const SignupPage = defineAsyncComponent(() => import('../pages/SignupPage.vue'))
const DashboardPage = defineAsyncComponent(() => import('../pages/DashboardPage.vue'))
const CasePage = defineAsyncComponent(() => import('../pages/CasePage.vue'))
const CompletionPage = defineAsyncComponent(() => import('../pages/CompletionPage.vue'))

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: { requiresAuth: true } // Add meta field
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage
    },
    {
      path: '/signup',
      name: 'signup',
      component: SignupPage
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true } // Add meta field
    },
    {
      path: '/case/:id',
      name: 'case',
      component: CasePage,
      props: true, // Pass route params as props
      meta: { requiresAuth: true } // Add meta field
    },
    {
      path: '/complete',
      name: 'complete',
      component: CompletionPage,
      meta: { requiresAuth: true } // Add meta field
    },
    // Fallback redirect (keep at the end)
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
