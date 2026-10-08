import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './Dashboard'
import Verification from './Verification'
import Review from './Review'

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-bold transition ${
    isActive ? 'bg-green-900 text-white' : 'text-green-800 hover:bg-green-100'
  }`

/** Signed-in admin area: Registrations, the Verification queue, and the review screen. */
export default function AdminArea({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <nav aria-label="Admin sections" className="flex gap-1">
          <NavLink to="/admin" end className={tab}>Registrations</NavLink>
          <NavLink to="/admin/verification" className={tab}>Verification</NavLink>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-500">Signed in as {email}</span>
          <button className="btn btn-ghost !min-h-10 !px-4" onClick={onSignOut}>Sign out</button>
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
