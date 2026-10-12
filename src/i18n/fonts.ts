// The font for a script is fetched only when a language that needs it is on screen. Every Latin script language
// (English, French, Portuguese, Swahili, Oromo and the rest) uses the fonts already shipped with the site, so nothing here runs
// for them. Amharic is the one language that needs the Ethiopic script.
import type { FontScript } from './locales'

export async function loadScriptFont(font: FontScript): Promise<void> {
  if (font === 'arabic') {
    await Promise.all([
      import('@fontsource/noto-sans-arabic/arabic-400.css'),
      import('@fontsource/noto-sans-arabic/arabic-600.css'),
      import('@fontsource/noto-sans-arabic/arabic-700.css'),
    ])
  }
  if (font === 'ethiopic') {
    await Promise.all([
      import('@fontsource/noto-sans-ethiopic/ethiopic-400.css'),
      import('@fontsource/noto-sans-ethiopic/ethiopic-600.css'),
      import('@fontsource/noto-sans-ethiopic/ethiopic-700.css'),
    ])
  }
}
