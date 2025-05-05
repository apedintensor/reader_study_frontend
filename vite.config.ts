import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: { // Add server configuration
    proxy: {
      // Proxy requests starting with /api to your backend server
      '/api': {
        target: 'http://localhost:8000', // Your backend API address
        changeOrigin: true,
        // Optional: rewrite path if your backend doesn't expect /api prefix
        rewrite: (path) => path.replace(/^\/api/, '') // <-- Enable rewrite
      }
    }
  }
})
