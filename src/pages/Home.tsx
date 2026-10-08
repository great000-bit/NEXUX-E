import { Link } from 'react-router-dom'

const STEPS = [
  { n: '1', title: 'Scan', body: 'Scan the QR code on the flier with your phone camera.' },
  { n: '2', title: 'Register', body: 'Complete a short form. It takes about 90 seconds.' },
  { n: '3', title: 'Verify', body: 'Build your full profile and upload evidence later.' },
  { n: '4', title: 'Be found', body: 'Get matched with relevant opportunities across Nigeria and beyond.' },
]

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden rounded-[2rem] bg-green-900 px-6 py-12 text-white shadow-lg sm:px-10 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-green-700/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl"
        />
        <p className="relative text-xs font-bold uppercase tracking-[0.22em] text-lime-500">
          Join the founding experts · Benin 2026
        </p>
        <h1 className="relative mt-4 text-[2.15rem] font-semibold sm:text-5xl">
          Don&rsquo;t just be qualified.
          <span className="block text-lime-500">Be found.</span>
        </h1>
        <p className="relative mt-5 max-w-md text-base text-white/80 sm:text-lg">
          Register once as a Nigerian environmental professional and be discovered for projects, research and
          development finance.
        </p>
        <Link to="/register" className="btn btn-accent relative mt-8 w-full sm:w-auto">
          Register now
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M4 10h12m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className="relative mt-3 text-sm text-white/70">90 seconds. One professional profile. More opportunities.</p>
      </section>

      <section aria-labelledby="how" className="mt-14">
        <h2 id="how" className="text-2xl font-semibold text-green-900 sm:text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="card flex gap-4 p-5" style={{ borderRadius: 'var(--radius-lg)' }}>
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-green-100 font-display text-lg font-semibold text-green-800">
                {s.n}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-green-900">{s.title}</h3>
                <p className="mt-1 text-[0.95rem] text-ink-700">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-[1.5rem] bg-green-100 p-6">
        <p className="font-display text-lg italic text-green-900">
          &ldquo;Building a discoverable, evidence-based network of Nigerian environmental expertise.&rdquo;
        </p>
      </section>

      <div className="mt-10 flex flex-col items-center gap-4">
        <Link to="/register" className="btn btn-primary w-full sm:w-auto sm:px-12">
          Register
        </Link>
        <p className="text-sm text-ink-700">
          Already registered?{' '}
          <Link to="/verify" className="font-bold text-green-800 underline underline-offset-4">
            Verify your profile
          </Link>
        </p>
        <p className="text-sm text-ink-700">
          Looking for an expert?{' '}
          <Link to="/experts" className="font-bold text-green-800 underline underline-offset-4">
            Search the directory
          </Link>
        </p>
      </div>
    </div>
  )
}
