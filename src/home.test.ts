import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { heroMotionAllowed, nextIndex, particleCount, type MotionInputs } from './lib/motion.ts'
import { ABOUT, AUDIENCE, CTA, DIRECTORY, HERO, HERO_NODES, HOW, MEMBERSHIP_STRIP, PRIVACY, STEPS, TAGLINES, WHY } from './pages/home/content.ts'
import { EXPERTISE } from './lib/options.ts'

// Tests for the redesign: the motion rules, the words on the home page, and the design-system guardrails.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name)
    return e.isDirectory() ? walk(rel) : [rel]
  })
// The icon map lives in a .tsx file that Node cannot import here, so read it as text.
const EXPERTISE_ICON: Record<string, string> = Object.fromEntries(
  [...read('src/components/icons.tsx').matchAll(/^ {2}'([^']+)': '([a-z-]+)',$/gm)].map((m) => [m[1], m[2]]),
)
const sources = walk('src').filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f))

// ---------- Motion ----------

// A phone or tablet (no desktop-width screen with a fine pointer), and a laptop or desktop.
const calm: MotionInputs = { reducedMotion: false, saveData: false, cores: 8, memoryGb: 8, hidden: false, desktopPointer: false }
const desktop: MotionInputs = { ...calm, desktopPointer: true }

test('the hero animates for everyone except reduced motion, data saver and very weak phones', () => {
  assert.equal(heroMotionAllowed(calm), true)
  assert.equal(heroMotionAllowed({ ...calm, cores: undefined, memoryGb: undefined }), true, 'unknown hardware is trusted')
  assert.equal(heroMotionAllowed({ ...calm, reducedMotion: true }), false, 'prefers reduced motion')
  assert.equal(heroMotionAllowed({ ...calm, saveData: true }), false, 'data saver is on')
  assert.equal(heroMotionAllowed({ ...calm, hidden: true }), true, 'a hidden tab pauses in place; it is not a reason to switch motion off')
  // Very weak phones: two cores or fewer, or 1 GB or less.
  assert.equal(heroMotionAllowed({ ...calm, cores: 2 }), false)
  assert.equal(heroMotionAllowed({ ...calm, cores: 1 }), false)
  assert.equal(heroMotionAllowed({ ...calm, memoryGb: 1 }), false)
  assert.equal(heroMotionAllowed({ ...calm, memoryGb: 0.5 }), false)
  assert.equal(heroMotionAllowed({ ...calm, cores: 3 }), true)
  assert.equal(heroMotionAllowed({ ...calm, cores: 4 }), true, 'an ordinary 4 core phone animates')
  assert.equal(heroMotionAllowed({ ...calm, memoryGb: 2 }), true)
})

test('core and memory counts never block a desktop-width screen with a fine pointer', () => {
  for (const cores of [undefined, 1, 2, 4, 8, 16]) {
    for (const memoryGb of [undefined, 0.25, 1, 2, 4, 8]) {
      assert.equal(heroMotionAllowed({ ...desktop, cores, memoryGb }), true, `cores ${cores}, memory ${memoryGb}`)
    }
  }
  // Only the two things a person chooses still stop it.
  assert.equal(heroMotionAllowed({ ...desktop, reducedMotion: true }), false)
  assert.equal(heroMotionAllowed({ ...desktop, saveData: true }), false)
})

test('star dust is capped at 60 on desktop and 25 on a phone', () => {
  assert.equal(particleCount(1280), 60)
  assert.equal(particleCount(640), 60)
  assert.equal(particleCount(639), 25)
  assert.equal(particleCount(360), 25)
})

test('the rotating tagline has three segments and wraps round', () => {
  assert.equal(TAGLINES.length, 3)
  assert.equal(nextIndex(0, 3), 1)
  assert.equal(nextIndex(2, 3), 0)
})

test('hero effects switch on only through data-motion, so the poster is exactly the still state', () => {
  const css = read('src/pages/home/home.css')
  const animated = [...css.matchAll(/animation\s*:[^;]+;/g)].map((m) => m[0])
  assert.ok(animated.length > 8)
  // Every animation in the hero sheet is guarded by the data-motion switch, apart from the tagline text and the segment fills,
  // which only render when the tagline is shown and which the global reduced-motion rule also stops.
  const unguarded = css.split('}').filter((rule) => /animation\s*:/.test(rule) && !/data-motion='on'/.test(rule) && !/hero-tagline-(title|text)|hero-seg|@keyframes/.test(rule))
  assert.deepEqual(unguarded.map((r) => r.trim().slice(0, 60)), [])
  assert.match(read('src/index.css'), /@media \(prefers-reduced-motion: reduce\)/)
})

test('the star dust canvas stops when scrolled away or hidden, and is only mounted when motion is allowed', () => {
  const dust = read('src/pages/home/StarDust.tsx')
  assert.match(dust, /IntersectionObserver/)
  assert.match(dust, /document\.hidden/)
  assert.match(dust, /Math\.min\(window\.devicePixelRatio/)
  assert.match(read('src/pages/home/Hero.tsx'), /\{motion && <StarDust \/>\}/)
})

// ---------- The words on the page ----------

const allCopy = JSON.stringify({ HERO, HERO_NODES, TAGLINES, MEMBERSHIP_STRIP, ABOUT, HOW, WHY, AUDIENCE, PRIVACY, DIRECTORY, CTA, STEPS })

test('the headline, buttons and corner nodes are exactly the ones asked for', () => {
  assert.equal(HERO.eyebrow, 'Join the founding experts')
  assert.equal(HERO.subline, 'Register once as an environmental professional and be discovered for projects, research and development finance.')
  assert.equal(HERO.headlineA, "Don't just be qualified.")
  assert.equal(HERO.headlineB, 'Be found.')
  assert.equal(HERO.small, '90 seconds. One professional profile. More opportunities.')
  assert.deepEqual(HERO_NODES.map((n) => n.label), ['ESIA and Safeguards', 'Climate Change and Carbon', 'Water and Hydrogeology', 'Biodiversity and Ecosystems'])
  assert.deepEqual(TAGLINES.map((t) => t.title), ['Be found.', 'Be verified.', 'Be engaged.'])
  const hero = read('src/pages/home/Hero.tsx')
  assert.match(hero, />Register now</)
  assert.match(hero, />Verify my profile</)
  assert.match(hero, /See how it works/)
})

test('the membership strip lists bodies a person can add, and never reads as partners', () => {
  assert.equal(MEMBERSHIP_STRIP.lead, 'Add your professional memberships to your profile')
  assert.deepEqual(MEMBERSHIP_STRIP.items, ['NES', 'IEPN', 'NSE', 'NIA', 'NITP', 'NIM', 'IUCN'])
  assert.doesNotMatch(allCopy, /partner|endorse|trusted by|as seen/i)
})

test('no invented numbers: the only figure in the page copy is 90 (seconds); "Benin 2026" is gone', () => {
  const digits = allCopy.match(/\d+/g) ?? []
  assert.deepEqual([...new Set(digits)].sort(), ['90'])
  assert.doesNotMatch(allCopy, /benin/i)
  assert.doesNotMatch(allCopy, /testimonial|\bstars?\b|\d+\s*(\+|%|k\b)/i)
})

test('the eighteen areas of expertise each have an icon, and the page says eighteen', () => {
  assert.equal(EXPERTISE.length, 18)
  for (const name of EXPERTISE) assert.ok(EXPERTISE_ICON[name], `${name} has no icon`)
  assert.equal(new Set(Object.values(EXPERTISE_ICON)).size, 18, 'each icon is different')
})

test('the four steps and the who-finds-you list are the ones on the flier', () => {
  assert.deepEqual(STEPS.map((s) => s.title), ['Scan', 'Register', 'Verify', 'Be found'])
  assert.deepEqual(AUDIENCE.items.map((a) => a.label), ['Projects', 'Consultancies', 'Research', 'Government', 'Industry', 'Development finance', 'International opportunities'])
  assert.equal(WHY.items.length, 3)
})

test('no em or en dashes anywhere in the new or restyled source', () => {
  const dash = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`)
  const offenders = sources.filter((f) => dash.test(read(f)))
  assert.deepEqual(offenders, [])
  assert.ok(!dash.test(read('index.html')))
})

// ---------- Structure ----------

test('home sections appear in the order asked for', () => {
  const src = read('src/pages/home/HomeSections.tsx')
  const order = ['<About />', '<Expertise />', '<HowItWorks />', '<WhyRegister />', '<WhoFindsYou />', '<Privacy />', '<DirectoryTeaser />', '<Faq />', '<FinalCta />']
  const at = order.map((o) => src.indexOf(o))
  assert.ok(at.every((i) => i > 0), 'every section is rendered')
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in the right order')
  for (const id of ['about', 'expertise', 'how-it-works', 'why-register', 'who-finds-you', 'privacy', 'directory']) {
    assert.match(src, new RegExp(`id="${id}"`), id)
  }
})

test('the navigation has the right links, a Register button in the mobile sheet, and no admin link', () => {
  const nav = read('src/components/Navbar.tsx')
  for (const label of ['How it works', 'Expertise', 'Who finds you', 'Privacy']) assert.match(nav, new RegExp(`label: '${label}'`))
  assert.match(nav, /to="\/experts"/)
  assert.match(nav, /to="\/verify"/)
  assert.match(nav, />Register now</)
  assert.doesNotMatch(nav, /(to|href)=["'{`]+\/admin/, 'no link to the admin (the string only detects the admin route)')
  assert.match(nav, /aria-expanded/)
  assert.match(nav, /Escape/)
  assert.doesNotMatch(read('src/components/Footer.tsx'), /admin/i)
  assert.doesNotMatch(read('src/pages/NotFound.tsx'), /\/admin/)
})

test('AOS is loaded only by the home sections, so no other route downloads it', () => {
  const users = sources.filter((f) => /from 'aos|aos\/dist/.test(read(f)))
  assert.deepEqual(users.map((f) => f.replace(/\\/g, '/')).sort(), ['src/pages/home/HomeSections.tsx', 'src/pages/home/aos.ts'])
  const aos = read('src/pages/home/aos.ts')
  assert.match(aos, /once: true/)
  assert.match(aos, /prefersReducedMotion/)
  for (const f of ['src/pages/Register.tsx', 'src/pages/Registered.tsx', 'src/pages/Verify.tsx', 'src/App.tsx', 'src/main.tsx']) {
    assert.doesNotMatch(read(f), /aos/i, f)
  }
})

test('the home page and its sections are separate chunks that load after the headline', () => {
  const app = read('src/App.tsx')
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/Home'\)\)/)
  const home = read('src/pages/Home.tsx')
  assert.match(home, /lazy\(\(\) => import\('\.\/home\/HomeSections'\)\)/)
  assert.match(home, /requestIdleCallback/)
  assert.match(read('vite.config.ts'), /location\.pathname==='\/'/)
})

test('the headline is real text and nothing above the fold is an image or a video', () => {
  const hero = read('src/pages/home/Hero.tsx')
  assert.match(hero, /<h1 className="hero-title">/)
  assert.doesNotMatch(hero, /<img|<video|<picture|url\(/)
  assert.doesNotMatch(read('src/pages/home/home.css'), /url\(/)
})

// ---------- Design guardrails ----------

test('fonts: Sora for headings and Manrope for text, Inter never, both preloaded', () => {
  const css = read('src/index.css')
  assert.match(css, /--font-display: 'Sora Variable'/)
  assert.match(css, /--font-sans: 'Manrope Variable'/)
  for (const f of sources) assert.doesNotMatch(read(f), /\bInter\b/, f)
  const html = read('index.html')
  assert.match(html, /rel="preload" href="\/fonts\/sora-latin\.woff2"/)
  assert.match(html, /rel="preload" href="\/fonts\/manrope-latin\.woff2"/)
  assert.doesNotMatch(css, /fontsource|Fraunces/i)
  for (const f of ['sora-latin', 'sora-latin-ext', 'manrope-latin', 'manrope-latin-ext']) assert.ok(fs.existsSync(path.join(root, `public/fonts/${f}.woff2`)), f)
})

test('no purple or violet anywhere in the colours', () => {
  const css = ['src/index.css', 'src/pages/home/home.css', 'src/pages/home/sections.css'].map(read).join('\n')
  const hues: number[] = []
  for (const m of css.matchAll(/#([0-9a-f]{6})\b/gi)) hues.push(hue(m[1].match(/../g)!.map((h) => Number.parseInt(h, 16)) as [number, number, number]))
  for (const m of css.matchAll(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)/g)) hues.push(hue([+m[1], +m[2], +m[3]]))
  const purple = hues.filter((h) => h >= 255 && h <= 315)
  assert.deepEqual(purple, [])
})

function hue([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  if (max === min) return -1 // a grey has no hue
  const d = max - min
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return (h * 60 + 360) % 360
}

test('glass has a solid fallback, blur is kept off grids, and the registration form stays solid', () => {
  const css = read('src/index.css')
  assert.match(css, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/)
  assert.match(css, /backdrop-filter: blur\(18px\)/)
  assert.match(css, /\.glass-flat/)
  const sections = read('src/pages/home/HomeSections.tsx')
  // The eighteen expertise cards and the audience tiles never blur.
  assert.match(sections, /<GlassCard as="div" flat hover className="expertise-card/)
  assert.match(sections, /<GlassCard flat hover className="flex h-full items-center/)
  // Inputs and the registration panel are solid, not glass.
  assert.doesNotMatch(read('src/components/fields.tsx'), /glass/)
  assert.doesNotMatch(read('src/pages/Register.tsx'), /glass/)
})

test('headings keep a sensible order: one h1 per page, then h2, then h3', () => {
  const hero = read('src/pages/home/Hero.tsx')
  assert.equal((hero.match(/<h1/g) ?? []).length, 1)
  const sections = read('src/pages/home/HomeSections.tsx')
  assert.doesNotMatch(sections, /<h1/)
  assert.match(read('src/components/ds/Section.tsx'), /<h2 /)
})

test('every icon is decorative unless it has a label, and nothing uses an emoji as an icon', () => {
  const icons = read('src/components/icons.tsx')
  assert.match(icons, /aria-hidden=\{label \? undefined : true\}/)
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
  assert.deepEqual(sources.filter((f) => emoji.test(read(f))), [])
})

test('brand files for the favicon, the share image and the light logo exist and are linked', () => {
  const html = read('index.html')
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'og-image.png']) {
    assert.ok(fs.existsSync(path.join(root, 'public', f)), f)
    assert.ok(html.includes(`/${f}`), `${f} is linked`)
  }
  assert.ok(fs.existsSync(path.join(root, 'public/logo-mark-light.svg')))
  assert.match(html, /og:image" content="https:\/\/register\.nexuse\.org\/og-image\.png"/)
  assert.match(html, /twitter:card" content="summary_large_image"/)
})

test('the registration form, its fields and its logic were not touched by the redesign', () => {
  // The look changed (shell, step indicator), but these files hold the behaviour and must not mention the new system.
  for (const f of ['src/lib/form.ts', 'src/lib/api.ts', 'src/lib/portal.ts', 'src/lib/directory.ts']) {
    assert.doesNotMatch(read(f), /theme-dark|glass|aos/i, f)
  }
})

// ---------- Fixes found by Lighthouse ----------

test('lazy pages hold a full screen of space while they load, so the footer never jumps', () => {
  const app = read('src/App.tsx')
  assert.match(app, /const loading = <div className="grid min-h-\[85svh\]/)
  assert.doesNotMatch(app, /fallback=\{<div className="grid place-items-center py-24"/)
  assert.match(read('src/pages/Directory.tsx'), /min-h-\[26rem\]/)
})

test('the logo link is named by its visible wordmark, and the emblem beside it is decorative', () => {
  assert.doesNotMatch(read('src/components/Navbar.tsx'), /aria-label="NEXUS-E home"/)
  assert.match(read('src/components/Navbar.tsx'), /<span className="sr-only">Home page<\/span>/)
  assert.match(read('src/components/Logo.tsx'), /decorative/)
})

test('the unselected dropdown text is dark enough to read (the placeholder colour passes AA)', () => {
  assert.match(read('src/components/fields.tsx'), /color: value \? undefined : '#66746b'/)
  assert.doesNotMatch(read('src/components/fields.tsx'), /#75827a/)
})
