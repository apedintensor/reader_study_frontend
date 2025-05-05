<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MainLayout from './components/MainLayout.vue'

const route = useRoute()

// Determine if the current route requires the main layout
const showLayout = computed(() => route.meta.requiresAuth)
</script>

<template>
  <template v-if="showLayout">
    <MainLayout>
      <router-view />
    </MainLayout>
  </template>
  <router-view v-else />
</template>

<style scoped>
/* Remove or adjust default styles if needed */
</style>
