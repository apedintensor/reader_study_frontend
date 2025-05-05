<template>
  <div class="layout-wrapper">
    <Menubar class="layout-topbar">
      <template #start>
        <router-link to="/" class="flex align-items-center no-underline">
          <span class="text-xl font-bold text-primary">Reader Study</span>
        </router-link>
      </template>

      <template #end>
        <div class="flex align-items-center gap-3" v-if="isAuthenticated">
          <span class="text-sm">
            <i class="pi pi-user mr-2"></i>{{ userEmail }}
          </span>
          <Button icon="pi pi-sign-out" 
                  severity="secondary"
                  text
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
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import Menubar from 'primevue/menubar';
import Button from 'primevue/button';

const router = useRouter();
const userStore = useUserStore();

const isAuthenticated = computed(() => userStore.isAuthenticated);
const userEmail = computed(() => userStore.user?.email);

const handleLogout = async () => {
  await userStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.layout-wrapper {
  min-height: 100vh;
  background: var(--surface-ground);
}

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
</style>
