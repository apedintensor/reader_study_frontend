<template>
  <div>
    <Menubar :model="items" />
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Menubar from 'primevue/menubar';

// Placeholder items for the menubar
const items = ref([
  {
    label: 'Dashboard',
    icon: 'pi pi-fw pi-home',
    command: () => { /* navigate to dashboard */ }
  },
  {
    label: 'Logout',
    icon: 'pi pi-fw pi-power-off',
    command: () => { /* handle logout */ }
  }
]);
</script>

<style scoped>
main {
  padding: 1rem;
}
/* Remove default header styles if they exist */
header {
  display: none;
}
</style>
