<template>
  <div class="flex align-items-center justify-content-center min-h-screen bg-surface-50 px-4 py-8">
    <div class="signup-container">
      <Toast />
      <Card class="surface-card shadow-2 border-round p-4">
        <template #title>
          <div class="text-center mb-5">
            <div class="text-900 text-3xl font-medium mb-3">Create Account</div>
            <span class="text-600 font-medium">Join the reader study</span>
          </div>
        </template>
        <template #content>
          <form @submit.prevent="handleSignup" class="p-fluid">
            <div class="grid">
              <!-- Email Field -->
              <div class="col-12 mb-4">
                <div class="flex align-items-center surface-overlay border-round px-3 py-2 gap-2">
                  <i class="pi pi-envelope text-500" />
                  <InputText
                    v-model="formData.email"
                    placeholder="Email"
                    class="w-full border-none shadow-none"
                    required
                  />
                </div>
              </div>

              <!-- Password Field -->
              <div class="col-12 mb-4">
                <div class="flex align-items-center surface-overlay border-round px-3 py-2 gap-2">
                  <i class="pi pi-lock text-500" />
                  <Password
                    v-model="formData.password"
                    placeholder="Password"
                    :toggleMask="true"
                    :feedback="true"
                    class="w-full border-none shadow-none"
                    required
                  />
                </div>
              </div>
            </div>
            <div class="grid">
              <div class="col-12 md:col-6 mb-4">
                <span class="p-float-label">
                  <Dropdown 
                    id="gender" 
                    v-model="formData.gender" 
                    :options="genders" 
                    class="w-full"
                    required 
                  />
                  <label for="gender">Gender</label>
                </span>
              </div>

              <div class="col-12 md:col-6 mb-4">
                <span class="p-float-label">
                  <InputNumber 
                    id="exp" 
                    v-model="formData.years_experience" 
                    :min="0" 
                    :step="1"
                    showButtons
                    class="w-full" 
                    required
                  />
                  <label for="exp">Years Clinical Experience</label>
                </span>
              </div>

              <div class="col-12 md:col-6 mb-4">
                <span class="p-float-label">
                  <InputNumber 
                    id="dermExp" 
                    v-model="formData.years_derm_experience" 
                    :min="0" 
                    :step="1"
                    showButtons
                    class="w-full" 
                    required
                  />
                  <label for="dermExp">Years Dermatology Experience</label>
                </span>
              </div>

              <div class="col-12 mb-4">
                <span class="p-float-label">
                  <Dropdown 
                    id="role" 
                    v-model="formData.role_id" 
                    :options="roles" 
                    optionLabel="name" 
                    optionValue="id" 
                    class="w-full"
                    :loading="rolesLoading"
                    required 
                  />
                  <label for="role">Professional Role</label>
                </span>
              </div>

              <div class="col-12">
                <Button 
                  type="submit" 
                  :label="loading ? 'Creating account...' : 'Create account'" 
                  :loading="loading"
                  severity="primary"
                  class="w-full p-3 mb-4"
                />

                <div class="text-center">
                  <Divider align="center">
                    <span class="text-600 font-medium">Already have an account?</span>
                  </Divider>
                  <router-link to="/login" class="no-underline">
                    <Button 
                      type="button" 
                      label="Sign in instead" 
                      severity="secondary" 
                      outlined
                      class="w-full p-3"
                    />
                  </router-link>
                </div>
              </div>
            </div>
          </form>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'; // Import onMounted
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import Card from 'primevue/card';
import Toast from 'primevue/toast';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import apiClient from '../api';

// Define Role interface based on RoleRead schema
interface Role {
    id: number;
    name: string;
}

const router = useRouter();
const toast = useToast();

const formData = reactive({
  email: '',
  password: '',
  age_bracket: null as string | null,
  gender: null as string | null,
  years_experience: null as number | null,
  years_derm_experience: null as number | null,
  role_id: null as number | null
});

const loading = ref(false);
const rolesLoading = ref(false); // Loading state for roles dropdown
const roles = ref<Role[]>([]); // To store fetched roles

// Static data for other dropdowns
const genders = ref(['Male', 'Female', 'Other', 'Prefer not to say']);

// Fetch roles when the component mounts
onMounted(async () => {
  rolesLoading.value = true;
  try {
    const response = await apiClient.get<Role[]>('/api/roles/'); // Added /api prefix to match OpenAPI spec
    roles.value = response.data;
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    toast.add({ severity: 'error', summary: 'Error', detail: 'Could not load roles.', life: 3000 });
  } finally {
    rolesLoading.value = false;
  }
});

const handleSignup = async () => {
  loading.value = true;
  try {
    // Ensure required fields are not null before sending
    const payload = {
      ...formData,
      // FastAPI Users expects these defaults, but we provide them
      is_active: true,
      is_superuser: false,
      is_verified: false, // Assuming verification is handled separately
    };

    // Use the correct endpoint from openapi.json
    await apiClient.post('/api/auth/register/register', payload);

    toast.add({ severity: 'success', summary: 'Signup Successful', detail: 'Please log in.', life: 3000 });
    router.push('/login');

  } catch (error: any) {
    console.error("Signup error:", error);
    let detail = 'Signup failed. Please check your input.';
    if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
            // Handle simple string errors like "REGISTER_USER_ALREADY_EXISTS"
            detail = error.response.data.detail.replace(/_/g, ' ').toLowerCase();
            detail = detail.charAt(0).toUpperCase() + detail.slice(1) + '.';
        } else if (Array.isArray(error.response.data.detail)) {
            // Handle FastAPI validation errors (HTTP 422)
            detail = error.response.data.detail.map((err: any) => `${err.loc.join('.')} - ${err.msg}`).join('; ');
        } else if (typeof error.response.data.detail === 'object' && error.response.data.detail.code === 'REGISTER_INVALID_PASSWORD') {
             // Handle specific password error structure
             detail = `Password validation failed: ${error.response.data.detail.reason}`;
        } else if (typeof error.response.data.detail === 'object') {
             // Fallback for other object details
             detail = JSON.stringify(error.response.data.detail);
        }
    }
    toast.add({ severity: 'error', summary: 'Signup Failed', detail: detail, life: 5000 });
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.signup-container {
  width: 100%;
  max-width: 600px;
}

:deep(.p-card) {
  background: var(--surface-card);
  border-radius: var(--border-radius);
}

:deep(.p-inputnumber-input) {
  width: 100%;
}

:deep(.p-password),
:deep(.p-dropdown) {
  width: 100%;
}

@media screen and (max-width: 576px) {
  .signup-container {
    max-width: 100%;
  }
}
</style>