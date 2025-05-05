<template>
  <div>
    <!-- Add a PrimeVue Topbar/Menubar component here later if needed -->
    <header>
      <!-- Placeholder for top navigation -->
      <p>Top Bar Placeholder</p>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// No script needed for now
</script>

<style scoped>
header {
  background-color: #f0f0f0;
  padding: 1rem;
  margin-bottom: 1rem;
}
main {
  padding: 1rem;
}
</style>
