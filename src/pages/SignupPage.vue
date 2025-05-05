<template>
  <div class="signup-container">
    <Toast />
    <Card>
      <template #title>Sign Up</template>
      <template #content>
        <form @submit.prevent="handleSignup">
          <div class="p-fluid">
            <div class="p-field mb-4">
              <label for="email">Email</label>
              <InputText id="email" type="email" v-model="formData.email" required />
            </div>
            <div class="p-field mb-4">
              <label for="password">Password</label>
              <Password id="password" v-model="formData.password" required toggleMask :feedback="true" />
            </div>
            <div class="p-field mb-4">
              <label for="age">Age Bracket</label>
              <Dropdown id="age" v-model="formData.age_bracket" :options="ageBrackets" placeholder="Select Age Bracket" required />
            </div>
            <div class="p-field mb-4">
              <label for="gender">Gender</label>
              <Dropdown id="gender" v-model="formData.gender" :options="genders" placeholder="Select Gender" required />
            </div>
            <div class="p-field mb-4">
              <label for="exp">Years Clinical Experience</label>
              <InputNumber id="exp" v-model="formData.years_experience" mode="decimal" :min="0" required />
            </div>
            <div class="p-field mb-4">
              <label for="dermExp">Years Dermatology Experience</label>
              <InputNumber id="dermExp" v-model="formData.years_derm_experience" mode="decimal" :min="0" required />
            </div>
            <div class="p-field mb-4">
              <label for="role">Role</label>
              <!-- Use fetched roles -->
              <Dropdown id="role" v-model="formData.role_id" :options="roles" optionLabel="name" optionValue="id" placeholder="Select Role" required :loading="rolesLoading" />
            </div>
            <Button type="submit" label="Sign Up" :loading="loading" />
          </div>
        </form>
         <div class="mt-4 text-center">
          Already have an account? <router-link to="/login">Log in</router-link>
        </div>
      </template>
    </Card>
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
const ageBrackets = ref(['18-29', '30-39', '40-49', '50-59', '60+']);
const genders = ref(['Male', 'Female', 'Other', 'Prefer not to say']);

// Fetch roles when the component mounts
onMounted(async () => {
  rolesLoading.value = true;
  try {
    const response = await apiClient.get<Role[]>('/roles/'); // Fetch roles from API
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
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 0; /* Add padding for scroll */
}

:deep(.p-card) {
  width: 100%;
  max-width: 500px; /* Wider card for more fields */
}
</style>