import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import DashboardPage from '../pages/DashboardPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import SignupPage from '../pages/SignupPage.vue';
import CasePage from '../pages/CasePage.vue';
import ReviewPage from '../pages/ReviewPage.vue';
import GameReportPage from '../pages/GameReportPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true }
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
    },    {
      path: '/case/:id',
      name: 'case',
      component: CasePage,
      meta: { requiresAuth: true }
    },
    {
      path: '/case/:id/review',
      name: 'review',
      component: ReviewPage,
      meta: { requiresAuth: true }
    }
    ,{
      path: '/game/report/:block',
      name: 'game-report',
      component: GameReportPage,
      meta: { requiresAuth: true }
    }
  ]
});

// Navigation guard
router.beforeEach((to, _from, next) => {
  const userStore = useUserStore();
  
  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    next({ name: 'login' });
  } else {
    next();
  }
});

export default router;
