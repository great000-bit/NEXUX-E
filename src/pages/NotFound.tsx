import { Button } from '../components/ds'
import { useMessages } from '../i18n/I18nProvider'
import { usePageInfo } from '../lib/pageInfo'

export default function NotFound() {
  const m = useMessages().notFound
  usePageInfo({ title: m.pageTitle, noindex: true })
  return (
    <div className="py-16 text-center">
      <p className="font-display text-7xl font-semibold tracking-tight text-lime-500 sm:text-8xl">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-green-900 sm:text-3xl">{m.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-700">{m.text}</p>
      <div className="mt-8 flex justify-center">
        <Button to="/" variant="accent" icon="arrow-right">{m.home}</Button>
      </div>
    </div>
  )
}
