import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

/**
 * The home page is its own chunk so that /register does not download the hero. But the home page is also where the
 * QR code lands, so on the address "/" only, this starts fetching that chunk (and its styles) straight from the HTML,
 * in parallel with the main script, instead of waiting for the main script to ask for it.
 */
function preloadHomeOnRoot(): Plugin {
  return {
    name: 'nexus-preload-home-on-root',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        type Out = { fileName: string; facadeModuleId?: string | null; imports?: string[]; viteMetadata?: { importedCss?: Set<string> } }
        const chunks = Object.values(bundle) as unknown as Out[]
        const home = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/pages/Home.tsx'))
        if (!home) return
        const entry = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith('/index.html'))
        const already = new Set(entry?.imports ?? [])
        const scripts = [home.fileName, ...(home.imports ?? []).filter((f) => !already.has(f) && f !== entry?.fileName)]
        const styles = [...(home.viteMetadata?.importedCss ?? [])]
        const files = [...scripts.map((f) => ({ f: `/${f}`, css: false })), ...styles.map((f) => ({ f: `/${f}`, css: true }))]
        const code =
          `if(location.pathname==='/'){${JSON.stringify(files)}.forEach(function(x){var l=document.createElement('link');` +
          `l.rel=x.css?'stylesheet':'modulepreload';l.href=x.f;document.head.appendChild(l)})}`
        return [{ tag: 'script', children: code, injectTo: 'head' }]
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadHomeOnRoot()],
  // Tailwind v4 runs through its Vite plugin. An inline (empty) PostCSS config stops Vite from
  // searching parent folders, where an unrelated project's Tailwind v3 postcss.config.js can
  // otherwise be picked up and break the build.
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
