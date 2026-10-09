import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Register from './pages/Register'
import Registered from './pages/Registered'
import NotFound from './pages/NotFound'
import { Spinner } from './components/ui'

// The home page and the admin area are separate chunks, so the registration route stays light.
// The home chunk is preloaded only when the address is "/" (see vite.config.ts), so a QR visitor does not wait for it.
const Home = lazy(() => import('./pages/Home'))
const Admin = lazy(() => import('./pages/admin/Admin'))
// The verification pages are not on the way to registering, so they load when someone goes there.
const Verify = lazy(() => import('./pages/Verify'))
const VerifyDashboard = lazy(() => import('./pages/VerifyDashboard'))

// The directory loads the database client, which registration does not need. Keeping it out of the main
// bundle keeps the registration page as light as it was on a weak connection.
const Directory = lazy(() => import('./pages/Directory'))
const ExpertProfile = lazy(() => import('./pages/ExpertProfile'))
// A placeholder as tall as the screen keeps the footer below the fold while a page arrives, so nothing jumps when it appears.
const loading = <div className="grid min-h-[85svh] place-items-center"><Spinner label="Loading" /></div>

/** Holds the hero's place while its code arrives, so nothing jumps when it appears. */
const heroPlaceholder = (
  <div className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6" aria-hidden="true">
    <div className="rounded-[28px] border border-white/5 bg-night-950" style={{ minHeight: 'calc(100svh - 6rem)' }} />
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Suspense fallback={heroPlaceholder}><Home /></Suspense>} />
        <Route path="register" element={<Register />} />
        <Route path="registered" element={<Registered />} />
        <Route path="verify" element={<Suspense fallback={loading}><Verify /></Suspense>} />
        <Route path="verify/dashboard" element={<Suspense fallback={loading}><VerifyDashboard /></Suspense>} />
        <Route path="experts" element={<Suspense fallback={loading}><Directory /></Suspense>} />
        <Route path="experts/:expertId" element={<Suspense fallback={loading}><ExpertProfile /></Suspense>} />
        <Route
          path="admin/*"
          element={
            <Suspense fallback={loading}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
