// The font for a script is fetched only when a language that needs it is on screen. English, French and Portuguese
// use the fonts already shipped with the site, so nothing here runs for them.
import type { FontScript } from './locales'

export async function loadScriptFont(font: FontScript): Promise<void> {
  if (font === 'arabic') {
    await Promise.all([
      import('@fontsource/noto-sans-arabic/arabic-400.css'),
      import('@fontsource/noto-sans-arabic/arabic-600.css'),
      import('@fontsource/noto-sans-arabic/arabic-700.css'),
    ])
  }
}
