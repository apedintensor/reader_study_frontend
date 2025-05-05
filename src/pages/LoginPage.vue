<template>
  <div class="login-container">
    <Toast />
    <Card>
      <template #title>Login</template>
      <template #content>
        <form @submit.prevent="handleLogin">
          <div class="p-fluid">
            <div class="p-field mb-4">
              <label for="email">Email</label>
              <InputText id="email" type="email" v-model="email" required />
            </div>
            <div class="p-field mb-4">
              <label for="password">Password</label>
              <Password id="password" v-model="password" required :feedback="false" toggleMask />
            </div>
            <Button type="submit" label="Login" :loading="loading" />
          </div>
        </form>
        <div class="mt-4 text-center">
          Don't have an account? <router-link to="/signup">Sign up</router-link>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import apiClient from '../api';
import { useUserStore } from '../stores/userStore'; // Import user store

const router = useRouter();
const toast = useToast();
const userStore = useUserStore(); // Use the store

const email = ref('');
const password = ref('');
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('username', email.value);
    params.append('password', password.value);

    const response = await apiClient.post('/api/auth/jwt/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.access_token) {
      const token = response.data.access_token;
      userStore.setToken(token); // Store token using the action

      // Fetch user details after successful login
      const userFetched = await userStore.fetchCurrentUser();

      if (userFetched) {
        toast.add({ severity: 'success', summary: 'Login Successful', life: 3000 });
        router.push('/dashboard'); // Navigate to dashboard
      } else {
         // If fetching user failed even after login, show error and clear auth
         toast.add({ severity: 'error', summary: 'Login Failed', detail: 'Could not fetch user details.', life: 3000 });
         userStore.logout(); // Clear potentially bad state
      }
    } else {
      throw new Error('Login failed: No access token received');
    }
  } catch (error: any) {
    console.error("Login error:", error);
    const detail = error.response?.data?.detail || 'Login failed. Please check your credentials.';
    toast.add({ severity: 'error', summary: 'Login Failed', detail: detail, life: 3000 });
    userStore.clearAuth(); // Clear any partial auth state on error
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh; /* Adjust as needed */
}

/* Optional: Limit card width */
:deep(.p-card) {
  width: 100%;
  max-width: 400px;
}
</style>