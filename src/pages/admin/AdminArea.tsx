import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './Dashboard'
import Verification from './Verification'
import Review from './Review'

const tab = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold transition ${
    isActive ? 'bg-green-900 text-white' : 'text-green-800 hover:bg-green-100'
  }`

/** Signed-in admin area: Registrations, the Verification queue, and the review screen. */
export default function AdminArea({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Admin sections" className="flex gap-1">
          <NavLink to="/admin" end className={tab}>Registrations</NavLink>
          <NavLink to="/admin/verification" className={tab}>Verification</NavLink>
        </nav>
        <div className="flex min-w-0 items-center justify-between gap-3 text-sm sm:justify-end">
          <span className="min-w-0 truncate text-ink-500" title={email}>Signed in as {email}</span>
          <button className="btn btn-ghost !min-h-11 flex-none whitespace-nowrap !px-4" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="verification" element={<Verification />} />
        <Route path="verification/:expertId" element={<Review />} />
      </Routes>
    </div>
  )
}
