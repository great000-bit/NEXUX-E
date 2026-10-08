# NEXUS-E design system

A dark green, glass-and-solid system built from the conference flier. Everything lives in `src/index.css` (tokens, surfaces, glass, buttons, fields) and `src/components` (the parts). The home page adds `src/pages/home/home.css` (hero) and `sections.css` (scroll sections), which load only with the home page.

Two rules decide almost every choice:

1. **Glass is for containers and marketing cards. Inputs and forms are always solid and high contrast.**
2. **The page must be fast on weak mobile data and kind to cheap phones.** Motion, blur and video are extras that switch off when the device is struggling.

## 1. Tokens

Three layers, as in a normal design-token graph: reference tokens, then semantic tokens, then components.

### Reference tokens (`@theme` in `index.css`)

Sampled from the flier (`docs/flier.jpg`) and then extended with a night shell.

| Token | Value | Source |
| --- | --- | --- |
| `green-900` | `#06361E` | Wordmark and footer bands on the flier |
| `green-800` | `#0B4A2A` | Section bars |
| `green-700` | `#0A663F` | Logo emblem |
| `green-500` | `#62AA2A` | "Verified" pill and checkmarks |
| `lime-500` | `#C5DC3F` | Headline accent |
| `blue-600` | `#0B7CD0` | Logo "E" and water icons |
| `green-100` | `#E6F2D0` | Light panels |
| `night-950` | `#03110A` | The page shell |
| `night-900` | `#051A10` | Raised dark surfaces, the footer |
| `night-800` | `#082316` | Toasts, hero node icons |
| `sage-300` / `mint-200` | `#A9C4B0` / `#D5ECC4` | Light masses in the hero |

Radii: `sm 8px`, `md 14px`, `lg 20px`, `xl 28px`, `2xl 32px`. The hero card uses 28 px on phones and 32 px from 640 px up.
Shadows: `sm`, `md`, `lg` (deep green tinted). Glass and the admin sheet add their own deeper shadows.
Spacing: a 4 px base (Tailwind multiplies it). Section rhythm is `py-14` on phones and `py-24` from 640 px.

### Semantic tokens (per surface)

Pages use one set of colour names (`text-green-900`, `text-ink-700`, `border-line`, `.btn-primary` and so on). What those names mean depends on the surface they sit on:

| Surface | Class | Text and lines |
| --- | --- | --- |
| The night shell | `.theme-dark` (on the layout root) | Headings `#F1F8E6`, body `#CBDACF`, muted `#9FB6A6`, lines white at 14 and 24 percent, focus ring lime, primary button lime |
| Any solid light panel | `.theme-light`, `.card`, `.sheet` | The original dark ink on white, focus ring blue, primary button deep green |

Because these are CSS custom properties, a light panel placed inside the dark shell restores the light values for everything inside it. That is why every existing page works on the new shell without per-page colour edits. Anything small and self-contained that can appear on either surface (notices, status badges, the error summary) carries `theme-light` itself.

### Typography

- Headings and display numbers: **Sora**, weight 600, tracking from -0.03em (headings) to -0.045em (the hero).
- Text: **Manrope**, 16 px base, 1.6 line height.
- Never Inter. Fraunces was removed; if a pull quote is ever added it should use Sora.
- Fluid scale: hero `clamp(2.5rem, 1.35rem + 5.1vw, 5rem)`, section titles `clamp(1.75rem, 1.2rem + 2.4vw, 3rem)`, lead text `clamp(1rem, 0.95rem + 0.3vw, 1.175rem)`.
- Fonts are Latin and Latin Extended only, served from `/public/fonts` (about 90 KB for both families) and **preloaded** in `index.html`.

### Motion

| Token | Value |
| --- | --- |
| `--dur-1` | 150 ms (press, hover colour) |
| `--dur-2` | 240 ms (hover lift, focus ring) |
| `--dur-3` | 420 ms (page enter, sheets) |
| `--dur-4` | 700 ms (hero entrance, scroll reveals use 650 ms) |
| `--ease` | `cubic-bezier(0.22, 0.61, 0.36, 1)` (default) |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` (rare, for a small pop) |

## 2. Glass

```
.glass       white 7%  fill, 1px white 14% border, inner highlight, soft shadow, backdrop blur 18px (14px on phones)
.glass-flat  the same look with no blur
.glass-strong  10% fill and an 18% border
```

- **Blur budget.** A screen should hold only a handful of blurred elements: the nav pill, one or two cards, the hero eyebrow and the secondary button. The hero itself uses **no filter blur at all**: its light masses are radial gradients. Grids and lists (the 15 expertise cards, the audience tiles, the directory results) use `.glass-flat`. Never blur a large scrolling list.
- **Fallback.** `@supports not (backdrop-filter ...)` turns every `.glass` into a solid dark green (`rgb(9 38 25 / 0.94)`), so text stays readable where blur is missing.
- **Unlayered CSS beats Tailwind utilities.** `.glass` and the hero classes are plain CSS, so do not try to override their `display` or `background` with a utility on the same element. Wrap or add a class instead.

## 3. Components (`src/components`)

| Component | File | Notes |
| --- | --- | --- |
| Button | `ds/Button.tsx` | `primary` (lime on dark, deep green on light), `secondary` (glass), `ghost`, `accent` (always lime). Renders a router `Link`, an `a` or a `button` with one look. 48 px minimum height. Press moves 1 px, hover lifts 1 px. |
| GlassCard | `ds/GlassCard.tsx` | `flat` removes blur, `hover` adds the lift. Radius 28 px. |
| Chip | `ds/Chip.tsx`, `.chip` | A small glass pill with an optional icon. |
| Section | `ds/Section.tsx` | Eyebrow, `h2`, lead, then content, with `scroll-mt-28` so anchors clear the sticky header. |
| Badge | `ds/Badge.tsx` | Neutral label. |
| Verified badge | `VerifiedBadge.tsx` | Lime on the shell, soft green on a light panel. Always has a check icon, never colour alone. |
| Status badge | `StatusBadge.tsx` | The five verification statuses, each with its own icon. |
| Navbar | `Navbar.tsx` | Floating glass pill (desktop), hamburger and glass sheet below 1024 px. The pill becomes more opaque with a shadow after 24 px of scroll. The sheet locks page scroll, moves focus in, closes on Escape, and keeps Register now and Verify my profile at the bottom. |
| Footer | `Footer.tsx` | Light logo, tagline, links, the configured contact address, copyright, and a quiet developer credit ("Designed and built by Great Emman-Wori" with a glass "Contact developer" pill that opens in a new tab with `rel="noopener noreferrer"`). No Admin link: staff open `/admin` by typing the address. |
| Input, Select, Checkbox, Radio | `fields.tsx` (`TextField`, `SelectField`, `CheckList`, `RadioList`, `ConsentBox`) | **Always solid**, white fill, 1 px `#6F8277` border (3.5 to 1 against white), 16 px text, 48 px height. Errors add an icon and text, not just red. |
| Toast | `ds/Toast.tsx` | A solid night-green confirmation with a lime check. |
| Error summary | `ui.tsx` (`ErrorSummary`) | Lists what to fix with links that jump to each field. |
| Notice, Spinner, ProgressBar | `ui.tsx` | The progress bar is one lime segment per step. |
| Logo | `Logo.tsx` | `onDark` uses the light emblem and wordmark. `public/logo-mark-light.svg` is the same mark as a file. |
| Icons | `icons.tsx` | One 24 px line set (1.6 px round strokes) for the 15 expertise areas, the steps, the audiences and the interface. Decorative unless given a label. |

Brand files are generated by `npm run brand` (`scripts/generate-brand.mjs`): the light mark, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` and the 1200 by 630 `og-image.png`.

## 4. Motion rules

1. **Nothing important waits for an animation.** The hero headline is real text, painted at once, and is the largest element, so it is the page's LCP. Only the eyebrow, subline and buttons fade up.
2. **The hero animates for everyone except people who ask for less** (`src/lib/motion.ts`): `prefers-reduced-motion` (on Windows this follows the "Show animations in Windows" setting), explicit Data Saver, and very weak phones (2 or fewer cores, or 1 GB or less of memory). Core and memory counts **never** block a screen that is at least 1024 px wide with a fine pointer: most real laptops report 4 cores or fewer, and an earlier rule that stopped the hero at 4 cores left real PCs on the still poster. A hidden tab does not switch motion off; the looping animations pause in place and resume. Otherwise the hero shows the still poster: the same picture with nothing moving, no canvas and no timers. `data-motion="on"` is the only switch, and every hero animation is under it. Test the gate on real hardware without spoofing; spoofing the core count hid this bug.
3. **Pause what is off screen.** The star dust canvas stops when scrolled away or hidden, runs at a pixel ratio of at most 1.5, and has about 60 particles on desktop and 25 on a phone.
4. **Only transforms and opacity move.** The light masses drift with `transform` over 31 to 44 seconds. No layout properties animate, apart from the nodes' 3 px float, which is a margin change on an absolutely positioned element.
5. **Scroll reveals use AOS** with one shared configuration (`src/pages/home/aos.ts`): 650 ms, `ease-out-cubic`, `once: true`, offset 60 px, disabled entirely for reduced motion. Presets: `fadeUp`, `fadeIn`, `softZoom`, with a stagger of 70 ms per item (capped at 8). AOS and its stylesheet are imported **only** by the home sections, so no other route downloads them.
6. **Never animate form fields or admin tables.**
7. `prefers-reduced-motion: reduce` also collapses every remaining CSS animation and transition to nothing.

### Hero motion (hero-motion release)

Visuals and motion only; everything below lives in `src/pages/home` and is switched by the same `data-motion` rule.

- **Text reels** (`Reel.tsx`, `src/lib/reels.ts`): the four corner labels, the phone chips and the floating hook lines are fixed-size windows (overflow hidden, soft mask at the top and bottom) holding a vertical strip. A change spins the strip downward with Web Animations (`translateY` only): fast ease in, an overshoot, a springy settle, 720 to 880 ms. Two or three other items from the pool pass by, pre-blurred in place (the blur is a static style on those items, never animated). Each slot has its own timer of 4 to 7 seconds; a shared `ReelBoard` keeps spins at least a second apart so the reels stop one after another, and `planSpin` never repeats an item in a row and never shows the same text in two slots. Timers stop when the hero is off screen (IntersectionObserver) or the tab is hidden. A hidden tab pauses the looping hero animations in place (`data-paused`) rather than switching motion off, so coming back never replays the entrance. Reduced motion swaps the text instantly with no spin; data saver keeps the first text.
- **Which slots show where:** phones 4 chips (2 by 2); tablets 2 upper nodes; laptops 4 nodes plus one hook line; 1280 px wide and 820 px tall or more, a second hook line. `scripts/hero-audit.js` checks that no item touches the headline, subline, buttons or small print and that the longest text of each pool fits its window.
- **Tagline** (`Tagline.tsx`): moves by itself every 4 seconds in a loop. The three segments fill in step (`transform: scaleX`), the title and line slide up and blur out while the next rises in. Fixed height. Bottom right on tablets and up, centred under the buttons on phones. Static first item with motion off. It has no click handling.
- **Aurora** (`home.css`): three oversized layers (light mint and sage, mid green, deep green), softened inside their gradients, on seamless loops of 38, 31 and 24 seconds. Transform and opacity only; no blur filter is ever animated. The scrim keeps the text readable at every point of the loop.
- **Pointer:** a mouse gets a glow that follows it (moved by transform) and a small parallax on nodes and hook lines. Touch screens get neither.
- **LCP:** the headline paints in the first frame and is the largest text block, so it is the LCP element. The subline slides in without fading, so it never becomes the LCP.

### Desktop network background (hero-network release)

A single canvas behind the hero text: glowing lime nodes (#C6F135) run quickly along thin, low-opacity green lines on an invisible 48 px circuit grid, sometimes turning a right angle. When two come within 150 px a right-angle link draws between them, a short pulse runs along it, and it fades (1.1 s). A mouse links to the nodes within 170 px for 0.7 s.

- **Where it runs:** only when `(min-width: 1024px) and (pointer: fine)` **and** the hero may animate (so never with reduced motion or data saver; core and memory counts never block it). Below that nothing is mounted and the chunk is never downloaded; phones and tablets are exactly as before.
- **Loading:** `NetworkBackground.tsx` is a lazy chunk (about 2 KB gzipped), requested only after the page is idle, so it cannot touch the LCP.
- **Code:** `src/lib/network.ts` (geometry, link rules, node count: 40 to 60 by width), `src/lib/networkSim.ts` (the simulation, no DOM, tested in Node), `NetworkBackground.tsx` (drawing, pointer, visibility).
- **Performance rules:** one canvas and one requestAnimationFrame loop; it stops when scrolled out of view (IntersectionObserver) or the tab is hidden; resize-safe (debounced rebuild). The glow is a stamped sprite, never a blur. Pixel ratio is capped at 1 (the brief allowed up to 2): on a machine without a GPU, 2x halved the frame rate and 1.5x still dropped frames, while 1x held 60 frames a second with no long tasks.
- **Readability:** the canvas sits under the hero scrim, takes no pointer events, and the lines stay faint.

## 5. Accessibility

- AA contrast everywhere, audited by `src/design.test.ts` (headings, body, muted, lime, buttons, the faded end of "Be found.", hero small print, footer, field borders).
- One `h1` per page, then `h2` for sections and `h3` for cards.
- Visible focus on every control: a 3 px ring in lime on the shell and blue on a light panel, animated, with a transparent outline so forced-colours mode still shows it.
- Tap targets are at least 44 px. The hero tagline is not interactive (it moves by itself), so it has no tap targets.
- Skip link, labelled landmarks, `aria-expanded` on the menu button, and decorative layers marked `aria-hidden`.

## 6. Performance

- The home page is its own chunk, preloaded only when the address is `/`. `/register` does not download the hero.
- Below-the-fold sections are a second chunk that loads after the first paint (idle callback, or on first scroll).
- The directory teaser uses plain `fetch` rather than the database client.
- Budget for the registration route: no more than about 10 percent more JavaScript plus CSS (gzip) than before the redesign. The recorded baseline was 116,026 bytes.
- Fonts: preloaded, subset, `font-display: swap`.

## 7. Adding to the system

- New text on the shell: use the semantic names (`text-green-900`, `text-ink-700`, `text-ink-500`); they already mean the right thing.
- New solid panel: add `card` (or `theme-light`).
- New marketing card: `GlassCard`, and pass `flat` if it is one of many.
- New animation on the home page: use an AOS preset, and keep it under `data-motion` if it is in the hero.
- Copy comes from the flier and the PRD only. No invented numbers, quotes or client names, and no em dashes.
