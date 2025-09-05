<template>
  <div class="layout-wrapper">
    <Menubar class="layout-topbar">
      <template #start>
        <router-link to="/" class="flex align-items-center no-underline">
          <span class="text-xl font-bold text-primary">Reader Study</span>
        </router-link>
      </template>

      <template #end>
  <div class="flex align-items-center gap-3 min-w-max" v-if="isAuthenticated">
    <Button :icon="themeIcon" class="p-button-rounded p-button-text p-button-sm theme-toggle"
      :severity="isDark ? 'contrast' : 'secondary'"
      v-tooltip.left="themeTooltip"
      @click="toggleTheme" />
    <span class="text-sm whitespace-nowrap">
      <i class="pi pi-user mr-2"></i>{{ userEmail }}
    </span>
    <Button icon="pi pi-sign-out" 
      severity="secondary"
      text
      class="p-button-sm"
      v-tooltip.left="'Logout'"
      @click="handleLogout" />
  </div>
      </template>
    </Menubar>

    <div class="layout-main p-4">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import Menubar from 'primevue/menubar';
import Button from 'primevue/button';

const router = useRouter();
const userStore = useUserStore();

const isAuthenticated = computed(() => userStore.isAuthenticated);
const userEmail = computed(() => userStore.user?.email);

// Theme handling -------------------------------------------------
const THEME_KEY = 'color-scheme'; // 'light' | 'dark'
const isDark = ref(false);

function applyMode(mode: 'light'|'dark') {
  isDark.value = mode === 'dark';
  document.body.classList.toggle('dark-theme', isDark.value);
  document.body.classList.toggle('light-forced', !isDark.value); // prevent system dark override when user forces light
  localStorage.setItem(THEME_KEY, mode);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) as 'light'|'dark'|null;
  const system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyMode(saved || system);
}

const themeIcon = computed(() => isDark.value ? 'pi pi-moon' : 'pi pi-sun');
const themeTooltip = computed(() => isDark.value ? 'Dark mode (click to switch to Light)' : 'Light mode (click to switch to Dark)');

function toggleTheme() {
  applyMode(isDark.value ? 'light' : 'dark');
}

onMounted(() => initTheme());

const handleLogout = async () => {
  await userStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.layout-wrapper { min-height:100vh; background: var(--bg-surface-ground); transition: background .3s, color .3s; }

body.dark-theme { color-scheme: dark; }

/* Topbar uses surface-card which shifts automatically in dark mode via tokens */

.layout-topbar {
  position: sticky;
  top: 0;
  z-index: 999;
  padding: 0.5rem 2rem;
  background: var(--surface-card);
  box-shadow: 0 2px 4px rgba(0,0,0,.1);
}

.layout-main {
  padding-bottom: 2rem;
}

:deep(.p-menubar) {
  background: transparent;
  border: none;
  border-radius: 0;
}


:deep(.p-button.p-button-icon-only) {
  width: 2rem;
  padding: 0.5rem 0;
}

:deep(.p-button.p-button-icon-only .p-button-icon) {
  margin: 0;
}

/* Force higher contrast for user email in dark mode */
body.dark-theme .layout-topbar span.text-sm { color: #ffffff; }
</style>
