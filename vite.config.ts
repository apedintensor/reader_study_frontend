import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  server: {
    allowedHosts: ['af06-194-223-5-201.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // IMPORTANT: Do NOT rewrite; backend actually serves /api/* paths.
        // Leaving the prefix intact avoids 404s (previous rewrite stripped it).
      }
    }
  },
  base: '/',
  build: {
    target: 'es2020',
    sourcemap: false, // avoid inline sourceMappingURL (can trigger CSP complaints if inlined)
    minify: 'esbuild',
    rollupOptions: {
      // Ensure no dynamic import meta url constructions that could induce eval-like patterns
      output: {
        inlineDynamicImports: false
      }
    }
  },
  esbuild: {
    // Strip console.* in production to reduce surface
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}))
