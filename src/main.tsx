import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { reloadOnce } from './lib/chunkReload'
import { I18nProvider } from './i18n/I18nProvider'
import { initI18n } from './i18n'

// After a deploy, an open tab may ask for a script or style file that no longer exists. Vite raises this event
// for it. One fresh load fixes it (the guard in reloadOnce means it can never loop; if a second failure follows,
// the error screen takes over). The registration form keeps its progress in sessionStorage, so it survives the reload.
window.addEventListener('vite:preloadError', (event) => {
  // Offline is not a stale deploy: a reload would only show the browser's offline page. Let the page show its own message.
  if (navigator.onLine === false) return
  if (reloadOnce()) event.preventDefault()
})

// A visitor who chose another language earlier has it ready before the first paint, so the page never flashes English.
initI18n().then((initial) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <I18nProvider initial={initial}>
            <App />
          </I18nProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
})
