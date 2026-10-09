// After a new version is deployed, an open tab can ask for a script file that no longer exists. The page then
// needs one fresh load. These helpers decide when that reload is allowed, so it can never turn into a loop.

const KEY = 'nexus-chunk-reload-at'
/** One automatic reload per this many milliseconds. A second failure inside the window shows the error screen instead. */
export const RELOAD_WINDOW_MS = 60_000

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** True for the errors a browser raises when a lazy script or style file cannot be fetched. */
export function isChunkLoadError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '')
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed/i.test(text)
}

/**
 * Records a reload and returns true if one is allowed now. Returns false if one already happened inside the window,
 * or if the session store is unavailable (private mode, blocked storage): without a record we cannot prove it is not a loop.
 */
export function claimReload(store: Store | null, now: number = Date.now()): boolean {
  if (!store) return false
  try {
    const last = Number(store.getItem(KEY))
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) return false
    store.setItem(KEY, String(now))
    return true
  } catch {
    return false
  }
}

export function sessionStore(): Store | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Reloads the page once if allowed. Returns whether it did. */
export function reloadOnce(): boolean {
  if (!claimReload(sessionStore())) return false
  window.location.reload()
  return true
}
