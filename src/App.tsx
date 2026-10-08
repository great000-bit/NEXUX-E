import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Register from './pages/Register'
import Registered from './pages/Registered'
import NotFound from './pages/NotFound'
import Verify from './pages/Verify'
import VerifyDashboard from './pages/VerifyDashboard'
import { Spinner } from './components/ui'

// The admin area is only for staff, so keep it out of the public bundle.
const Admin = lazy(() => import('./pages/admin/Admin'))

// The directory loads the database client, which registration does not need. Keeping it out of the main
// bundle keeps the registration page as light as it was on a weak connection.
const Directory = lazy(() => import('./pages/Directory'))
const ExpertProfile = lazy(() => import('./pages/ExpertProfile'))
const loading = <div className="grid place-items-center py-24"><Spinner label="Loading" /></div>

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="register" element={<Register />} />
        <Route path="registered" element={<Registered />} />
        <Route path="verify" element={<Verify />} />
        <Route path="verify/dashboard" element={<VerifyDashboard />} />
        <Route path="experts" element={<Suspense fallback={loading}><Directory /></Suspense>} />
        <Route path="experts/:expertId" element={<Suspense fallback={loading}><ExpertProfile /></Suspense>} />
        <Route
          path="admin/*"
          element={
            <Suspense fallback={<div className="grid place-items-center py-24"><Spinner label="Loading" /></div>}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
