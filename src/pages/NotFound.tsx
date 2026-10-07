import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-6xl font-semibold text-green-800">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-green-900">This page could not be found</h1>
      <p className="mt-2 text-ink-700">The link may be out of date. You can start again from the home page.</p>
      <Link to="/" className="btn btn-primary mt-8">Back to home</Link>
    </div>
  )
}
