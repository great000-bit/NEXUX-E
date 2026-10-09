import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

/**
 * Some pages are their own chunks so that /register stays light: the home page, the directory and the profile page.
 * Each is also somewhere people land straight from a link or a QR code. On those addresses only, this starts fetching
 * the page's chunk (and its styles) straight from the HTML, in parallel with the main script, instead of waiting for
 * the main script to run and ask for it. That removes one full round trip from the first view of those pages.
 */
function preloadRouteChunks(): Plugin {
  const routes: { test: string; file: string }[] = [
    { test: "location.pathname==='/'", file: '/src/pages/Home.tsx' },
    { test: "location.pathname==='/experts'", file: '/src/pages/Directory.tsx' },
    { test: '/^\\/experts\\/[^/]+$/.test(location.pathname)', file: '/src/pages/ExpertProfile.tsx' },
  ]
  return {
    name: 'nexus-preload-route-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        type Out = { fileName: string; facadeModuleId?: string | null; imports?: string[]; viteMetadata?: { importedCss?: Set<string> } }
        const chunks = Object.values(bundle) as unknown as Out[]
        const entry = chunks.find((c) => c.facadeModuleId?.split('\\').join('/').endsWith('/index.html'))
        const already = new Set(entry?.imports ?? [])
        const tags = []
        for (const route of routes) {
          const chunk = chunks.find((c) => c.facadeModuleId?.split('\\').join('/').endsWith(route.file))
          if (!chunk) continue
          const scripts = [chunk.fileName, ...(chunk.imports ?? []).filter((f) => !already.has(f) && f !== entry?.fileName)]
          const styles = [...(chunk.viteMetadata?.importedCss ?? [])]
          const files = [...scripts.map((f) => ({ f: `/${f}`, css: false })), ...styles.map((f) => ({ f: `/${f}`, css: true }))]
          const code =
            `if(${route.test}){${JSON.stringify(files)}.forEach(function(x){var l=document.createElement('link');` +
            `l.rel=x.css?'stylesheet':'modulepreload';l.href=x.f;document.head.appendChild(l)})}`
          tags.push({ tag: 'script', children: code, injectTo: 'head' as const })
        }
        return tags
      },
    },
  }
}

/**
 * Opens the connection to the database host while the page is still loading, so the first directory or
 * profile request does not wait for a DNS lookup and a secure handshake. The address comes from the build's own
 * environment (VITE_SUPABASE_URL), so a staging build points at staging and never mentions production.
 */
function preconnectDatabase(): Plugin {
  let origin = ''
  let base = ''
  let key = ''
  return {
    name: 'nexus-preconnect-database',
    configResolved(config) {
      base = String(config.env.VITE_SUPABASE_URL ?? '')
      key = String(config.env.VITE_SUPABASE_ANON_KEY ?? '')
      try {
        origin = new URL(base).origin
      } catch {
        origin = ''
      }
    },
    transformIndexHtml() {
      if (!origin) return
      const tags: { tag: string; attrs?: Record<string, string>; children?: string; injectTo: 'head' | 'head-prepend' }[] = [
        { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head-prepend' },
      ]
      // On a profile address and on the plain directory address, ask for the data right now, in parallel with the main
      // script, instead of after it has downloaded and run. The page picks the answer up (src/lib/rest.ts, window.__early).
      // The address is built exactly as rpcGetUrl builds it. Both values are the public ones that already ship in the script.
      if (key) {
        const code =
          '(function(){var p=location.pathname,n,a,m=/^\\/experts\\/(NEX-\\d{6})$/.exec(p);' +
          "if(m){n='directory_profile';a=[['p_expert_id',m[1]]]}" +
          "else if(p==='/experts'&&!location.search){n='directory_search';a=[['p_sort','name'],['p_limit','12'],['p_offset','0']]}" +
          'else return;' +
          `var q=new URLSearchParams({apikey:${JSON.stringify(key)}});a.forEach(function(x){q.set(x[0],x[1])});` +
          `var u=${JSON.stringify(base)}+'/rest/v1/rpc/'+n+'?'+q.toString();` +
          'try{window.__early={url:u,response:fetch(u)}}catch(e){}})()'
        tags.push({ tag: 'script', children: code, injectTo: 'head' })
      }
      return tags
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadRouteChunks(), preconnectDatabase()],
  // Tailwind v4 runs through its Vite plugin. An inline (empty) PostCSS config stops Vite from
  // searching parent folders, where an unrelated project's Tailwind v3 postcss.config.js can
  // otherwise be picked up and break the build.
  css: { postcss: { plugins: [] } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
