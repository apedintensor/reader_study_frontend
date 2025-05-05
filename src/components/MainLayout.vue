<template>
  <div>
    <Menubar :model="items" />
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'; // Import watch
import { useRouter } from 'vue-router'; // Import useRouter
import Menubar from 'primevue/menubar';
import { useUserStore } from '../stores/userStore'; // Import user store

const router = useRouter(); // Get router instance
const userStore = useUserStore(); // Get user store instance

// Define menu items reactively
const items = ref();

// Function to update menu items based on auth state
const updateMenuItems = () => {
  if (userStore.isAuthenticated) {
    items.value = [
      {
        label: 'Dashboard',
        icon: 'pi pi-fw pi-home',
        command: () => {
          router.push('/dashboard'); // Navigate to dashboard
        }
      },
      // Add other authenticated navigation items here
      {
        label: 'Logout',
        icon: 'pi pi-fw pi-power-off',
        command: () => {
          userStore.logout(); // Call logout action from store
          router.push('/login'); // Redirect to login page
        }
      }
    ];
  } else {
    // Menu items for unauthenticated users (e.g., only Login/Signup)
    items.value = [
       {
        label: 'Login',
        icon: 'pi pi-fw pi-sign-in',
        command: () => { router.push('/login'); }
      },
      {
        label: 'Sign Up',
        icon: 'pi pi-fw pi-user-plus',
        command: () => { router.push('/signup'); }
      }
      // Add other public navigation items here if needed
    ];
  }
};

// Watch for changes in authentication state and update menu
watch(() => userStore.isAuthenticated, updateMenuItems, { immediate: true });

</script>

<style scoped>
main {
  padding: 1rem;
}
/* Ensure Menubar is visible and styled */
:deep(.p-menubar) {
    border-radius: 0; /* Optional: remove border radius */
    border-bottom: 1px solid var(--p-surface-border);
}
</style>
