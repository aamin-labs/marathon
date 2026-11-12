import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The browser keeps the app's data per address, so the port must never change.
  server: { port: 5180, strictPort: true },
})
