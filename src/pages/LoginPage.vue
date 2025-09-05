<template>
  <div class="flex align-items-center justify-content-center min-h-screen u-page u-page-narrow">
    <div class="login-container">
      <Toast />
      <Card class="shadow-2">
        <template #title>
          <div class="text-center mb-5">
            <div class="text-900 text-3xl font-medium mb-3">Welcome Back</div>
            <span class="text-600 font-medium line-height-3">Sign in to continue to the Reader Study</span>
          </div>
        </template>
        <template #content>
          <form @submit.prevent="handleLogin" class="p-fluid">
            <!-- Email -->
            <div class="field mb-4">
              <div class="flex align-items-center surface-overlay border-round px-3 py-2 gap-2 input-shell">
                <i class="pi pi-envelope text-500" />
                <InputText
                  v-model="formData.email"
                  placeholder="Email"
                  class="w-full border-none shadow-none"
                  :class="{ 'p-invalid': submitted && !formData.email }"
                  aria-label="Email"
                  required
                />
              </div>
              <small v-if="submitted && !formData.email" class="p-error">Email is required</small>
            </div>

            <!-- Password -->
            <div class="field mb-4">
              <div class="flex align-items-center surface-overlay border-round px-3 py-2 gap-2 input-shell">
                <i class="pi pi-lock text-500" />
                <Password
                  v-model="formData.password"
                  placeholder="Password"
                  :toggleMask="true"
                  :feedback="false"
                  class="w-full border-none shadow-none"
                  :class="{ 'p-invalid': submitted && !formData.password }"
                  aria-label="Password"
                  required
                />
              </div>
              <small v-if="submitted && !formData.password" class="p-error">Password is required</small>
            </div>

            <div class="signin-btn-row">
              <Button 
                type="submit" 
                :label="loading ? 'Signing in...' : 'Sign in'" 
                :icon="loading ? 'pi pi-spinner pi-spin' : 'pi pi-sign-in'"
                :loading="loading" 
                severity="primary"
                class="p-3 w-11rem"
                :disabled="loading"
              />
            </div>

            <div class="text-center">
              <Divider align="center" class="auth-divider">
                <span class="divider-label">New here?</span>
              </Divider>
              <router-link to="/signup" class="no-underline">
                <Button 
                  type="button" 
                  label="Create an account" 
                  icon="pi pi-user-plus"
                  severity="secondary" 
                  outlined
                  class="w-full p-3"
                />
              </router-link>
            </div>
          </form>
        </template>
      </Card>
    </div>
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
.login-container { width:100%; max-width:450px; }

.signin-btn-row { display:flex; justify-content:center; margin-bottom:1.75rem; }

.auth-divider { margin-top:.5rem; }
/* Remove box look & use subtle inline label */
.divider-label { background: var(--surface-card, var(--auth-surface-bg)); padding:0 .6rem; font-size:.75rem; letter-spacing:0; text-transform:none; font-weight:500; color: var(--text-color-secondary); border-radius:2px; position:relative; z-index:1; }
:deep(.auth-divider .p-divider-content) { background: var(--surface-card, var(--auth-surface-bg))!important; padding:0 .25rem; position:relative; z-index:1; }
:deep(.auth-divider.p-divider-horizontal) { margin:1.25rem 0 1rem; }
/* Adjust pseudo line color */
:deep(.auth-divider.p-divider-horizontal:before),
:deep(.auth-divider.p-divider-horizontal:after) { border-top:1px solid var(--surface-border); }

/* Adaptive system theme (light/dark) using prefers-color-scheme to set base tokens if not already set globally */
@media (prefers-color-scheme: dark) {
  :root {
    --auth-surface-bg: #121416;
    --auth-input-bg: #262e38;
  }
}
@media (prefers-color-scheme: light) {
  :root {
    --auth-surface-bg: #ffffff;
    --auth-input-bg: #f3f5f7;
  }
}

/* Apply token fallbacks */
:deep(.p-card) { background: var(--surface-card, var(--auth-surface-bg)); }
.login-container .surface-overlay { background: var(--auth-input-bg); }

/* Bordered input shell for both email & password */
.input-shell { border:1px solid var(--surface-border); transition:border-color .15s, box-shadow .15s; }
.input-shell:focus-within { border-color: var(--primary-color); box-shadow:0 0 0 1px var(--primary-color); }

:deep(.p-password),
:deep(.p-password-input),
:deep(.p-inputtext) {
  width: 100%;
}

:deep(.p-card) {
  border-radius: var(--border-radius);
}

:deep(.p-input-icon-left) {
  width: 100%;
}

@media screen and (max-width: 576px) {
  .login-container {
    max-width: 100%;
  }
}
</style>

<style>
/* Ensure divider label blends in dark mode where underlying card differs */
body.dark .divider-label { color: var(--text-color-secondary); }
</style>