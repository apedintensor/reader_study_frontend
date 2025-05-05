import './style.css'

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
    theme: { preset: Aura },  // Use Aura theme preset in styled mode
    ripple: true 
})
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
