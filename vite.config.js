import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor code into its own chunks.
        // Firebase is the bulk of the old monolithic index bundle —
        // pulling it out lets it cache independently of app code, and the
        // browser fetches vendor + app chunks in parallel.
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
          ],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
