<template>
  <div class="dashboard-page p-4">
    <Card>
      <template #title>Dashboard</template>
      <template #content>
        <p v-if="userStore.user">Welcome, {{ userStore.user.email }}!</p>
        <p>This is your dashboard. You can view your progress here.</p>
        <!-- Add more dashboard elements here -->
        <Button label="Start Next Case" icon="pi pi-arrow-right" @click="startNextCase" class="mt-4" />
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useCaseStore } from '../stores/caseStore';
import Card from 'primevue/card';
import Button from 'primevue/button';
import { computed } from 'vue'; // Import computed

const router = useRouter();
const userStore = useUserStore();
const caseStore = useCaseStore();

const startNextCase = () => {
  // Ensure cases are loaded before trying to find the next one
  if (caseStore.cases.length === 0) {
    console.log("Cases not loaded yet, attempting to load...");
    // Optionally add a loading indicator here
    caseStore.loadCases().then(() => {
      findAndNavigate(); // Try again after loading
    });
  } else {
    findAndNavigate();
  }
};

const findAndNavigate = () => {
  // Find the first case that is not in the completedCases list
  const nextCase = caseStore.cases.find(c => !caseStore.completedCases.includes(c.id));

  if (nextCase) {
    console.log(`Navigating to next available case: ${nextCase.id}`);
    router.push(`/case/${nextCase.id}`);
  } else {
    // Handle case where there are no more cases or all are complete
    console.log("No more uncompleted cases available.");
    router.push('/complete'); // Redirect to completion page
  }
};

// Fetch user data if not already present (e.g., on page refresh)
if (!userStore.user) {
  userStore.fetchCurrentUser();
}
// Load cases when dashboard is accessed
caseStore.loadCases();

</script>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  margin: auto;
}
</style>