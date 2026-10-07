import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tailwind v4 runs through its Vite plugin. An inline (empty) PostCSS config stops Vite from
  // searching parent folders, where an unrelated project's Tailwind v3 postcss.config.js can
  // otherwise be picked up and break the build.
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
