import './styles/tokens.css'
import './styles/utilities.css'
import './base.css'

// Early theme init (before Vue mounts) so unauth pages pick correct mode
try {
    const KEY = 'color-scheme';
    const saved = localStorage.getItem(KEY); // 'light' | 'dark'
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && systemDark)) {
        document.body.classList.add('dark-theme');
    } else if (saved === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-forced');
    }
} catch { /* ignore */ }

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import ToastService from 'primevue/toastservice'

// Import Aura theme preset
import Aura from '@primevue/themes/aura'

// Import only icons CSS - no theme CSS imports needed for PrimeVue 4 styled mode
import 'primeicons/primeicons.css'                     // icons
import 'primeflex/primeflex.css'                       // utility classes

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, { 
    theme: { 
        preset: Aura,
        // Use body.dark-theme class to trigger dark palette
        options: { darkModeSelector: 'body.dark-theme' }
    },
    ripple: true 
})
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
