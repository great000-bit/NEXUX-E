import { useEffect } from 'react'
import { Button } from '../components/ds'

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page not found | NEXUS-E'
  }, [])
  return (
    <div className="py-16 text-center">
      <p className="font-display text-7xl font-semibold tracking-tight text-lime-500 sm:text-8xl">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-green-900 sm:text-3xl">This page could not be found</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-700">The link may be out of date. You can start again from the home page.</p>
      <div className="mt-8 flex justify-center">
        <Button to="/" variant="accent" icon="arrow-right">Back to home</Button>
      </div>
    </div>
  )
}
