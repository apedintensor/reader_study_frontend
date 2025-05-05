<template>
  <div class="login-container p-4">
    <Toast />
    <Card>
      <template #title>
        <span class="text-xl font-bold flex align-items-center">
          <i class="pi pi-sign-in mr-2"></i> Login
        </span>
      </template>
      <template #subtitle>
        <span class="text-sm text-600">Please enter your credentials to continue</span>
      </template>
      <template #content>
        <form @submit.prevent="handleLogin" class="p-fluid">
          <div class="field mb-4">
            <label for="email" class="font-medium block mb-2">Email</label>
            <span class="p-input-icon 100">
              <i class="pi pi-envelope"></i>
              <InputText 
                id="email" 
                type="email" 
                v-model="formData.email" 
                :class="{'p-invalid': submitted && !formData.email}"
                required
                placeholder="Enter your email"
              />
            </span>
          </div>

          <div class="field mb-4">
            <label for="password" class="font-medium block mb-2">Password</label>
            <span class="p-input-icon 100">
              <i class="pi pi-lock"></i>
              <Password 
                id="password" 
                v-model="formData.password" 
                :class="{'p-invalid': submitted && !formData.password}"
                :toggleMask="true"
                required
                placeholder="Enter your password"
              />
            </span>
          </div>

          <Button 
            type="submit" 
            :label="loading ? 'Logging in...' : 'Login'" 
            :loading="loading" 
            severity="primary"
            class="mb-4"
          />

          <Divider />

          <div class="text-center">
            <p class="text-600 mb-2">Don't have an account?</p>
            <router-link to="/signup" class="no-underline">
              <Button 
                type="button" 
                label="Sign Up" 
                severity="secondary" 
                outlined
                class="w-full"
              />
            </router-link>
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useUserStore } from '../stores/userStore';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Divider from 'primevue/divider';
import Toast from 'primevue/toast';
import apiClient from '../api';

const router = useRouter();
const toast = useToast();
const userStore = useUserStore();

const formData = reactive({
  email: '',
  password: ''
});
const submitted = ref(false);
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  submitted.value = true;
  try {
    const params = new URLSearchParams();
    params.append('username', formData.email);
    params.append('password', formData.password);

    const response = await apiClient.post('/api/auth/jwt/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.access_token) {
      const token = response.data.access_token;
      userStore.setToken(token);

      const userFetched = await userStore.fetchCurrentUser();

      if (userFetched) {
        toast.add({ severity: 'success', summary: 'Login Successful', life: 3000 });
        router.push('/');
      } else {
        toast.add({ severity: 'error', summary: 'Login Failed', detail: 'Could not fetch user details.', life: 3000 });
        userStore.logout();
      }
    } else {
      throw new Error('Login failed: No access token received');
    }
  } catch (error: any) {
    console.error("Login error:", error);
    const detail = error.response?.data?.detail || 'Login failed. Please check your credentials.';
    toast.add({ severity: 'error', summary: 'Login Failed', detail: detail, life: 3000 });
    userStore.clearAuth();
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  max-width: 450px;
  margin: 2rem auto;
}

:deep(.p-password-input) {
  width: 100%;
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}
</style>