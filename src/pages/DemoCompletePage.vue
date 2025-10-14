<template>
  <div class="u-page u-page-standard text-center">
    <Card class="p-4">
      <template #title>
        🎉 Demo Completed
      </template>
      <template #content>
        <p class="mb-3">Congrats on completing the warm-up! You can practice more or start your first game.</p>
        <div class="flex justify-content-center gap-2">
          <Button label="Practice More" icon="pi pi-refresh" @click="practiceMore" />
          <Button label="Start Game" severity="success" icon="pi pi-play" @click="startGame" />
        </div>
      </template>
    </Card>
  </div>
  </template>

<script setup lang="ts">
import Card from 'primevue/card';
import Button from 'primevue/button';
import { useRouter } from 'vue-router';
import { useCaseStore } from '../stores/caseStore';
import { useGamesStore } from '../stores/gamesStore';
const router = useRouter();
const caseStore = useCaseStore();
const gamesStore = useGamesStore();

async function practiceMore(){
  if (!caseStore.cases.length) {
    await caseStore.loadCases();
  }
  const pool = caseStore.cases;
  if (pool && pool.length) {
    const rand = pool[Math.floor(Math.random() * pool.length)];
    router.push({ path: `/case/${rand.id}`, query: { demo: '1', again: '1' } });
  } else {
    router.push({ name: 'dashboard', query: { demo: 'again' } });
  }
}

async function startGame(){
  try {
    const result = await gamesStore.advanceToNext();
    if (result.status === 'exhausted' || !result.assignment) {
      router.push({ name: 'dashboard' });
      return;
    }
    router.push({ path: `/case/${result.assignment.case_id}` });
  } catch (e) {
    router.push({ name: 'dashboard' });
  }
}
</script>

<style scoped>
.u-page-standard { max-width: 980px; margin: 0 auto; }
</style>