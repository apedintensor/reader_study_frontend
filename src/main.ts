import './style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice'; // Import ToastService
import Lara from '@primevue/themes/lara'; // Import the Lara preset
import 'primeicons/primeicons.css';                           // Icons

import App from './App.vue'
import router from './router/index.ts'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ToastService); // Add ToastService
// Configure PrimeVue with the theme preset
app.use(PrimeVue, {
  theme: {
    preset: Lara,
    options: {
      prefix: 'p', // Optional: customize prefix
      darkModeSelector: '.dark-mode', // Optional: customize dark mode selector
      cssLayer: false // Optional: disable CSS layer
    }
  }
});

app.mount('#app')
