import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadOnce } from '../lib/chunkReload'
import { messages } from '../i18n'

type State = { failed: boolean; stale: boolean }

/**
 * The last safety net. If anything in the page throws while rendering, or a script file cannot be loaded after a
 * new deploy, the person sees a clear message and a Reload button instead of a blank screen. A failed script load is
 * first retried with one automatic reload (guarded, so it can never loop).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, stale: false }

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, stale: isChunkLoadError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error)) reloadOnce()
    else console.error('The page failed to render', error instanceof Error ? error.name : 'unknown', info.componentStack?.split('\n')[1]?.trim())
  }

  render() {
    if (!this.state.failed) return this.props.children
    const t = messages().errorBoundary
    return (
      <div className="shell theme-dark grid min-h-dvh place-items-center px-5 py-10">
        <div role="alert" className="glass relative w-full max-w-md rounded-[var(--radius-xl)] p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">
            {this.state.stale ? t.staleTitle : t.failedTitle}
          </h1>
          <p className="mt-3 text-ink-700">
            {this.state.stale ? t.staleText : t.failedText} {t.kept}
          </p>
          <div className="mt-6 grid gap-3">
            <button type="button" className="btn btn-accent" onClick={() => window.location.reload()}>{t.reload}</button>
            <a className="btn btn-secondary" href="/">{t.home}</a>
          </div>
        </div>
      </div>
    )
  }
}
